import type { Facility } from '../lib/data'

// Fixed categorical order (validated for colorblind separation as a 3-hue set).
// The label always sits next to the dot, so type never rests on color alone.
export const FACILITY_TYPES: Record<Facility['type'], { label: string; color: string }> = {
  government: { label: 'Government lab or center', color: '#257de0' },
  university: { label: 'University institute', color: '#f47230' },
  company: { label: 'Company site', color: '#00b894' },
}

export function TypeLabel({ type }: { type: Facility['type'] }) {
  const t = FACILITY_TYPES[type]
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
      <span className="w-2 h-2 rounded-full" style={{ background: t.color }} aria-hidden="true" />
      {t.label}
    </span>
  )
}
