// World map of facilities, drawn with Leaflet on OpenStreetMap tiles.
// Each facility is a dot colored by type, with a white ring so overlapping
// dots stay distinct; clicking a dot opens its name, place and type.
import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Facility } from '../lib/data'
import { FACILITY_TYPES } from './FacilityType'

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

export default function FacilitiesMap({ facilities, onSelect }: {
  facilities: Facility[]
  onSelect?: (slug: string) => void
}) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const layer = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    if (!el.current || map.current) return
    const m = L.map(el.current, { worldCopyJump: true, scrollWheelZoom: false, minZoom: 1 })
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(m)
    m.setView([30, 10], 2)
    layer.current = L.layerGroup().addTo(m)
    map.current = m
    return () => { m.remove(); map.current = null }
  }, [])

  useEffect(() => {
    const m = map.current
    const g = layer.current
    if (!m || !g) return
    g.clearLayers()
    const points: L.LatLngExpression[] = []
    for (const f of facilities) {
      if (typeof f.lat !== 'number' || typeof f.lon !== 'number') continue
      const t = FACILITY_TYPES[f.type]
      const marker = L.circleMarker([f.lat, f.lon], {
        radius: 7,
        color: '#ffffff',
        weight: 2,
        fillColor: t.color,
        fillOpacity: 1,
      })
      marker.bindTooltip(escapeHtml(f.name), { direction: 'top', offset: [0, -6] })
      marker.bindPopup(
        `<div style="font-size:13px;line-height:1.35">
          <strong>${escapeHtml(f.name)}</strong><br/>
          <span style="color:#6b7280">${escapeHtml(f.city)}</span><br/>
          <span style="color:#4b5563">${escapeHtml(t.label)}${f.open_access ? ' · open to outside researchers' : ''}</span>
        </div>`,
      )
      if (onSelect) marker.on('click', () => onSelect(f.slug))
      marker.addTo(g)
      points.push([f.lat, f.lon])
    }
    if (points.length === 1) m.setView(points[0], 6)
    else if (points.length > 1) m.fitBounds(L.latLngBounds(points), { padding: [24, 24], maxZoom: 6 })
  }, [facilities, onSelect])

  return (
    <div
      ref={el}
      className="h-72 sm:h-96 xl:h-[32rem] w-full rounded-xl border border-gray-200 overflow-hidden z-0 bg-gray-100"
      role="region"
      aria-label={`Map of ${facilities.length} facilities. The same facilities are listed below the map.`}
    />
  )
}
