import type { APIRoute } from 'astro'
import { analysisGet } from '../../../lib/analysis'
import { analysisDelete, analysisUpdateLabel } from '../../../lib/cache'

export const GET: APIRoute = async ({ params }) => {
  try {
    const analysis = await analysisGet(params.id!)
    if (!analysis) {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return new Response(JSON.stringify(analysis), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch {
    return new Response(JSON.stringify({ error: 'Database error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

export const PATCH: APIRoute = async ({ params, request }) => {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const label = (body as { label?: unknown })?.label
  if (typeof label !== 'string') {
    return new Response(JSON.stringify({ error: 'label must be a string' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const MAX_LABEL_LENGTH = 200
  if (label.length > MAX_LABEL_LENGTH) {
    return new Response(JSON.stringify({ error: `label must be ${MAX_LABEL_LENGTH} characters or fewer` }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const changes = await analysisUpdateLabel(params.id!, label)
    if (changes === 0) {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return new Response(JSON.stringify({ label: label.trim() || null }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch {
    return new Response(JSON.stringify({ error: 'Database error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

export const DELETE: APIRoute = async ({ params }) => {
  try {
    const changes = await analysisDelete(params.id!)
    if (changes === 0) {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return new Response(null, { status: 204 })
  } catch {
    return new Response(JSON.stringify({ error: 'Database error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
