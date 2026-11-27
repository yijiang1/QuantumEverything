export interface Company {
  slug: string
  name: string
  category: string
  platforms: string[]
  country: string
  founded: string
  website: string
  ticker: string
  exchange: string
  status: string
  parent: string
  description: string
  aliases: string[]
  is_public: boolean
}

export const CATEGORY_LABELS: Record<string, string> = {
  hardware:            'Hardware',
  big_tech:            'Big Tech',
  software:            'Software',
  enabling:            'Components & Control',
  networking_security: 'Networking & Security',
  sensing:             'Sensing',
}

export const CATEGORY_STYLES: Record<string, string> = {
  hardware:            'bg-indigo-50 text-indigo-700 border-indigo-200',
  big_tech:            'bg-blue-50 text-blue-700 border-blue-200',
  software:            'bg-teal-50 text-teal-700 border-teal-200',
  enabling:            'bg-amber-50 text-amber-700 border-amber-200',
  networking_security: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  sensing:             'bg-rose-50 text-rose-700 border-rose-200',
}

export const PLATFORM_LABELS: Record<string, string> = {
  superconducting: 'Superconducting',
  trapped_ion:     'Trapped ion',
  neutral_atom:    'Neutral atom',
  photonic:        'Photonic',
  spin:            'Silicon spin',
  topological:     'Topological',
  annealing:       'Annealing',
  bosonic:         'Bosonic / cat',
  diamond:         'Diamond NV',
}
