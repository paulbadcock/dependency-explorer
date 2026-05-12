import type { APIRoute } from 'astro'
import { analysisGet } from '../../../lib/analysis'
import { analysisDelete } from '../../../lib/cache'

export const GET: APIRoute = ({ params }) => {
  const analysis = analysisGet(params.id!)
  if (!analysis) {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  return new Response(JSON.stringify(analysis), {
    headers: { 'Content-Type': 'application/json' },
  })
}

export const DELETE: APIRoute = ({ params }) => {
  analysisDelete(params.id!)
  return new Response(null, { status: 204 })
}
