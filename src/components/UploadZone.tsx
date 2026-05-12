import { useState, useRef } from 'react'

export function UploadZone() {
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function validateAndSubmit(file: File) {
    if (!file.name.endsWith('.txt') && !file.name.endsWith('.toml')) {
      setError('Only .txt and .toml files are accepted')
      return
    }
    setError(null)
    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    fetch('/api/analyze', { method: 'POST', body: formData })
      .then(res => {
        if (res.redirected) { window.location.href = res.url; return }
        return res.json().then((body: { error?: string }) => {
          setError(body.error ?? 'Upload failed')
          setUploading(false)
        })
      })
      .catch(() => { setError('Upload failed'); setUploading(false) })
  }

  return (
    <div>
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => {
          e.preventDefault()
          setDragging(false)
          const file = e.dataTransfer.files[0]
          if (file) validateAndSubmit(file)
        }}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
          dragging ? 'border-blue-400 bg-panel' : 'border-border bg-surface hover:border-muted'
        }`}
      >
        <div className="text-4xl mb-3">📄</div>
        <p className="text-muted text-sm mb-3">Drop your file here or</p>
        <button
          type="button"
          onClick={e => { e.stopPropagation(); inputRef.current?.click() }}
          className="px-4 py-1.5 rounded bg-panel border border-border text-sm hover:border-muted transition-colors"
        >
          {uploading ? 'Analysing…' : 'Browse files'}
        </button>
        <p className="text-muted text-xs mt-3">
          Accepts <code>requirements.txt</code> and <code>pyproject.toml</code>
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".txt,.toml"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) validateAndSubmit(f) }}
        />
      </div>
      {error && <p className="mt-2 text-sm text-red-text">{error}</p>}
    </div>
  )
}
