import { defineMiddleware } from 'astro:middleware'
import { env } from 'cloudflare:workers'
import { initDb, ensureSchema } from './lib/cache'

let schemaReady = false

export const onRequest = defineMiddleware(async (context, next) => {
  if (env?.DB) {
    initDb(env.DB)
    if (!schemaReady) {
      await ensureSchema()
      schemaReady = true
    }
  }
  return next()
})
