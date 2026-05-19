import type { APIRoute } from 'astro'
import { runAnalysis } from '../../lib/analysis'

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
  const labelRaw = formData.get('label')
  const label = typeof labelRaw === 'string' ? labelRaw.trim() : ''

  if (!filename.endsWith('.txt') && !filename.endsWith('.lock') && filename !== 'packages.lock.json') {
    return new Response(JSON.stringify({ error: 'Only requirements.txt, poetry.lock, and packages.lock.json files are accepted' }), {
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
    const analysis = await runAnalysis(filename, content, label || undefined)
    return redirect(`/analysis/${analysis.id}`, 303)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Analysis failed'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
