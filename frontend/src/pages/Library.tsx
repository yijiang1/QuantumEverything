import { useState, useEffect, useCallback, useRef } from 'react'
import { Upload, FileText, ExternalLink, Trash2, Search, X } from 'lucide-react'

interface LibraryPaper {
  id: number
  title: string
  authors: string
  year: string
  tags: string
  notes: string
  filename: string
  original_filename: string
  created_at: number
}

function TagBadge({ tag }: { tag: string }) {
  return (
    <span className="text-xs px-2 py-0.5 rounded-full border border-teal-200 bg-teal-50 text-teal-700">
      {tag}
    </span>
  )
}

export default function Library() {
  const [papers, setPapers] = useState<LibraryPaper[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  // Upload form state
  const [showForm, setShowForm] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [authors, setAuthors] = useState('')
  const [year, setYear] = useState('')
  const [tags, setTags] = useState('')
  const [notes, setNotes] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadPapers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ ...(search && { search }) })
      const res = await fetch(`/api/library?${params}`)
      setPapers(await res.json())
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => { loadPapers() }, [loadPapers])

  useEffect(() => {
    const t = setTimeout(() => loadPapers(), 300)
    return () => clearTimeout(t)
  }, [search]) // eslint-disable-line react-hooks/exhaustive-deps

  const resetForm = () => {
    setFile(null)
    setTitle('')
    setAuthors('')
    setYear('')
    setTags('')
    setNotes('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleFileChange = (f: File | null) => {
    setFile(f)
    if (f && !title) {
      // Prefill title from filename, minus extension
      setTitle(f.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' '))
    }
  }

  const handleUpload = async () => {
    if (!file || !title.trim()) return
    setUploading(true)
    try {
      const body = new FormData()
      body.append('file', file)
      body.append('title', title)
      body.append('authors', authors)
      body.append('year', year)
      body.append('tags', tags)
      body.append('notes', notes)
      const res = await fetch('/api/library/upload', { method: 'POST', body })
      if (!res.ok) throw new Error(await res.text())
      resetForm()
      setShowForm(false)
      loadPapers()
    } catch (err) {
      alert(`Upload failed: ${err}`)
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this paper and its PDF?')) return
    await fetch(`/api/library/${id}`, { method: 'DELETE' })
    setPapers(prev => prev.filter(p => p.id !== id))
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Paper Library</h1>
          <p className="text-gray-500 text-sm">Local PDFs, tagged for quick reference</p>
        </div>
        <button
          onClick={() => setShowForm(s => !s)}
          className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-500 px-4 py-2 rounded-lg text-sm transition-colors shrink-0"
        >
          {showForm ? <X className="w-4 h-4" /> : <Upload className="w-4 h-4" />}
          {showForm ? 'Cancel' : 'Add PDF'}
        </button>
      </div>

      {/* Upload form */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              onChange={e => handleFileChange(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 file:cursor-pointer cursor-pointer"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Title *"
              className="bg-gray-100 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-teal-500"
            />
            <input
              value={authors}
              onChange={e => setAuthors(e.target.value)}
              placeholder="Authors"
              className="bg-gray-100 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-teal-500"
            />
            <input
              value={year}
              onChange={e => setYear(e.target.value)}
              placeholder="Year"
              className="bg-gray-100 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-teal-500"
            />
            <input
              value={tags}
              onChange={e => setTags(e.target.value)}
              placeholder="Tags (comma-separated, e.g. QEC, superconducting)"
              className="bg-gray-100 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-teal-500"
            />
          </div>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            rows={2}
            className="w-full bg-gray-100 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-teal-500"
          />
          <button
            onClick={handleUpload}
            disabled={!file || !title.trim() || uploading}
            className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 px-4 py-2 rounded-lg text-sm transition-colors"
          >
            <Upload className="w-4 h-4" />
            {uploading ? 'Uploading…' : 'Save to Library'}
          </button>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search title, authors, notes…"
          className="w-full bg-white border border-gray-300 rounded-lg pl-9 pr-4 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-teal-500"
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center text-gray-500 py-12">Loading…</div>
      ) : papers.length === 0 ? (
        <div className="text-center text-gray-500 py-16">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="mb-1">No papers in your library yet.</p>
          <p className="text-sm">Click "Add PDF" to upload one.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {papers.map(p => {
            const tagList = p.tags ? p.tags.split(',').map(t => t.trim()).filter(Boolean) : []
            return (
              <div
                key={p.id}
                className="bg-white border border-gray-200 hover:border-gray-300 rounded-xl p-4 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium text-gray-900 leading-snug">{p.title}</h3>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 flex-wrap">
                      {p.authors && <span className="truncate max-w-xs">{p.authors}</span>}
                      {p.year && <><span>·</span><span>{p.year}</span></>}
                    </div>
                    {tagList.length > 0 && (
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        {tagList.map(t => <TagBadge key={t} tag={t} />)}
                      </div>
                    )}
                    {p.notes && (
                      <p className="text-sm text-gray-500 mt-2">{p.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <a
                      href={`/api/library/${p.id}/pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-teal-600 px-3 py-1.5 rounded-lg border border-gray-300 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Open PDF
                    </a>
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="flex items-center justify-center text-gray-400 hover:text-red-600 w-8 h-8 rounded-lg hover:bg-gray-100 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
