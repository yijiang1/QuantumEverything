"""
Daily share prices for the listed companies in the directory, plus a simple
quantum stock index built from them.

Prices come from two free sources that need no API key:

    1. Yahoo Finance's public chart endpoint (daily closes)
    2. Stooq's CSV download, used for a ticker when Yahoo fails

Each run merges new closes into the history already in stocks.json, so a day
when both sources fail loses nothing. History is kept from the first run on.

The index ("Quantum pure-play index") is equal weight and chained daily: each
day it moves by the average daily return of the pure-play constituents that
traded that day and the day before. It starts at 100 on the first date in the
stored history. Big tech and suppliers are shown with prices but left out of
the index, since quantum is a small part of their business.

This is a reading aid, not a financial product. Prices are daily closes and can
be a day or more behind.
"""

from __future__ import annotations

import csv
import io
import time
from datetime import date, datetime, timedelta, timezone

import httpx

# Categories whose share price mostly reflects quantum work.
PURE_PLAY_CATEGORIES = {"hardware", "software", "networking_security", "sensing"}

YAHOO_HOSTS = ["https://query1.finance.yahoo.com", "https://query2.finance.yahoo.com"]
STOOQ_URL = "https://stooq.com/q/d/l/"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    "Accept": "application/json,text/csv,*/*",
}

FIRST_RANGE = "2y"     # how far back to fetch when a ticker has no history yet
UPDATE_RANGE = "3mo"   # later runs only need recent closes
MAX_YEARS = 10         # safety cap on stored history

# Yahoo and Stooq symbols differ from the plain ticker on non-US exchanges.
YAHOO_SUFFIX = {"LSE": ".L", "TSX": ".TO", "XETRA": ".DE", "EPA": ".PA", "ASX": ".AX"}
STOOQ_SUFFIX = {"NYSE": ".us", "NASDAQ": ".us", "NYSE American": ".us"}


# ── Listings ──────────────────────────────────────────────────────────────────

def listings(companies: list[dict]) -> dict[str, dict]:
    """One entry per traded security, keyed by ticker."""
    out: dict[str, dict] = {}
    for c in companies:
        t = (c.get("ticker") or "").strip().upper()
        if not t:
            continue
        entry = out.setdefault(t, {
            "ticker": t,
            "exchange": c.get("exchange") or "",
            "companies": [],
            "name": c["name"],
            "pure_play": False,
        })
        entry["companies"].append(c["slug"])
        if c.get("category") in PURE_PLAY_CATEGORIES:
            entry["pure_play"] = True
    return out


# ── Sources ───────────────────────────────────────────────────────────────────

def parse_yahoo(payload: dict) -> tuple[list[list], str]:
    """Return ([[YYYY-MM-DD, close], ...], currency) from a v8 chart response."""
    result = (payload.get("chart") or {}).get("result") or []
    if not result:
        err = (payload.get("chart") or {}).get("error")
        raise ValueError(f"no chart result{f': {err}' if err else ''}")
    r = result[0]
    meta = r.get("meta") or {}
    offset = int(meta.get("gmtoffset") or 0)
    stamps = r.get("timestamp") or []
    closes = ((r.get("indicators") or {}).get("quote") or [{}])[0].get("close") or []
    currency = meta.get("currency") or ""
    scale = 1.0
    if currency in ("GBp", "GBX"):  # London quotes in pence
        currency, scale = "GBP", 0.01
    rows: dict[str, float] = {}
    for ts, close in zip(stamps, closes):
        if close is None:
            continue
        day = datetime.fromtimestamp(ts + offset, tz=timezone.utc).date().isoformat()
        rows[day] = close * scale
    if not rows:
        raise ValueError("chart had no closes")
    return sorted([d, v] for d, v in rows.items()), currency


def parse_stooq(text: str) -> list[list]:
    """Return [[YYYY-MM-DD, close], ...] from a Stooq daily CSV."""
    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames or "Close" not in reader.fieldnames:
        raise ValueError("not a Stooq price CSV")
    rows = []
    for row in reader:
        try:
            rows.append([row["Date"], float(row["Close"])])
        except (KeyError, TypeError, ValueError):
            continue
    if not rows:
        raise ValueError("CSV had no closes")
    return sorted(rows)


def fetch_yahoo(client: httpx.Client, ticker: str, exchange: str, rng: str) -> tuple[list[list], str]:
    symbol = ticker + YAHOO_SUFFIX.get(exchange, "")
    last_err: Exception | None = None
    for host in YAHOO_HOSTS:
        try:
            r = client.get(f"{host}/v8/finance/chart/{symbol}",
                           params={"range": rng, "interval": "1d"})
            r.raise_for_status()
            return parse_yahoo(r.json())
        except Exception as e:  # noqa: BLE001 - try the next host
            last_err = e
    raise RuntimeError(f"Yahoo: {last_err}")


def fetch_stooq(client: httpx.Client, ticker: str, exchange: str) -> tuple[list[list], str]:
    suffix = STOOQ_SUFFIX.get(exchange)
    if not suffix:
        raise RuntimeError(f"Stooq: no symbol mapping for {exchange or 'unknown exchange'}")
    try:
        r = client.get(STOOQ_URL, params={"s": f"{ticker.lower()}{suffix}", "i": "d"})
        r.raise_for_status()
        return parse_stooq(r.text), "USD"
    except Exception as e:  # noqa: BLE001
        raise RuntimeError(f"Stooq: {e}") from e


# ── History and metrics ──────────────────────────────────────────────────────

def merge_history(old: list[list], new: list[list]) -> list[list]:
    """Union by date; new closes win. Capped at MAX_YEARS."""
    merged = {d: v for d, v in old}
    merged.update({d: v for d, v in new})
    rows = sorted([d, round(float(v), 4)] for d, v in merged.items())
    if rows:
        cutoff = (date.fromisoformat(rows[-1][0]) - timedelta(days=365 * MAX_YEARS)).isoformat()
        rows = [r for r in rows if r[0] >= cutoff]
    return rows


def _close_on_or_before(history: list[list], day: str) -> float | None:
    found = None
    for d, v in history:
        if d > day:
            break
        found = v
    return found


def _pct(now: float, then: float | None) -> float | None:
    if not then:
        return None
    return round((now / then - 1) * 100, 2)


def changes(history: list[list]) -> dict:
    """Percent change over 1 day, 1 month, year to date and 1 year."""
    if not history:
        return {"1d": None, "1m": None, "ytd": None, "1y": None}
    last_day, last = history[-1]
    end = date.fromisoformat(last_day)
    first_day = history[0][0]

    def back(days: int) -> float | None:
        target = (end - timedelta(days=days)).isoformat()
        return _close_on_or_before(history, target) if first_day <= target else None

    prev_year_end = date(end.year - 1, 12, 31).isoformat()
    return {
        "1d": _pct(last, history[-2][1]) if len(history) > 1 else None,
        "1m": _pct(last, back(30)),
        "ytd": _pct(last, _close_on_or_before(history, prev_year_end) if first_day <= prev_year_end else None),
        "1y": _pct(last, back(365)),
    }


def build_index(histories: dict[str, list[list]]) -> list[list]:
    """Chained equal-weight index, 100 on the first date any constituent traded."""
    by_ticker = {t: dict(h) for t, h in histories.items() if h}
    days = sorted({d for h in by_ticker.values() for d in h})
    last: dict[str, float] = {}
    level = 100.0
    series = []
    for d in days:
        rets = [by_ticker[t][d] / last[t] - 1 for t in by_ticker if d in by_ticker[t] and last.get(t)]
        if rets:
            level *= 1 + sum(rets) / len(rets)
        for t, h in by_ticker.items():
            if d in h:
                last[t] = h[d]
        series.append([d, round(level, 2)])
    return series


# ── Entry point ───────────────────────────────────────────────────────────────

def refresh(companies: list[dict], previous: dict | None, offline: bool,
            client: httpx.Client | None = None) -> tuple[dict, dict]:
    """Return (stocks.json payload, run status)."""
    previous = previous or {}
    old_tickers = previous.get("tickers") or {}
    status = {"fetched": 0, "kept_old": 0, "failed": [], "sources": {}}
    tickers: dict[str, dict] = {}

    own_client = client is None and not offline
    if own_client:
        client = httpx.Client(headers=HEADERS, timeout=20, follow_redirects=True)
    try:
        for t, info in listings(companies).items():
            old = old_tickers.get(t) or {}
            history = old.get("history") or []
            currency = old.get("currency") or ""
            source = old.get("source") or ""
            if not offline:
                rng = UPDATE_RANGE if len(history) > 30 else FIRST_RANGE
                errors = []
                new: list[list] = []
                try:
                    new, currency = fetch_yahoo(client, t, info["exchange"], rng)
                    source = "Yahoo Finance"
                except Exception as e:  # noqa: BLE001
                    errors.append(str(e))
                    try:
                        new, cur = fetch_stooq(client, t, info["exchange"])
                        currency = currency or cur
                        source = "Stooq"
                    except Exception as e2:  # noqa: BLE001
                        errors.append(str(e2))
                if new:
                    history = merge_history(history, new)
                    status["fetched"] += 1
                    status["sources"][source] = status["sources"].get(source, 0) + 1
                else:
                    status["failed"].append({"ticker": t, "errors": errors[:2]})
                    if history:
                        status["kept_old"] += 1
                time.sleep(0.3)  # be polite to free endpoints

            tickers[t] = {
                **info,
                "currency": currency,
                "source": source,
                "last": history[-1][1] if history else None,
                "last_date": history[-1][0] if history else None,
                "change": changes(history),
                "history": history,
            }
    finally:
        if own_client and client is not None:
            client.close()

    constituents = sorted(t for t, v in tickers.items() if v["pure_play"] and v["history"])
    series = build_index({t: tickers[t]["history"] for t in constituents})
    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "index": {
            "name": "Quantum pure-play index",
            "method": "Equal weight, chained daily, 100 on the first date in the history",
            "constituents": constituents,
            "series": series,
            "last": series[-1][1] if series else None,
            "last_date": series[-1][0] if series else None,
            "change": changes(series),
        },
        "tickers": tickers,
    }
    return payload, status
