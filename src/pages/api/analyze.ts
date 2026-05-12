import type { APIRoute } from 'astro'
import { runAnalysis } from '../../lib/analysis'
import { PipAuditNotFoundError } from '../../lib/pip-audit'

export const POST: APIRoute = async ({ request, redirect }) => {
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid form data' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return new Response(JSON.stringify({ error: 'No file uploaded' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { name: filename } = file
  if (!filename.endsWith('.txt') && !filename.endsWith('.toml')) {
    return new Response(JSON.stringify({ error: 'Only .txt and .toml files are accepted' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const content = await file.text()
  if (!content.trim()) {
    return new Response(JSON.stringify({ error: 'File is empty' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const analysis = await runAnalysis(filename, content)
    return redirect(`/analysis/${analysis.id}`, 303)
  } catch (err) {
    if (err instanceof PipAuditNotFoundError) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const message = err instanceof Error ? err.message : 'Analysis failed'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
