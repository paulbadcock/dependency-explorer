import { defineMiddleware } from 'astro:middleware'
import { initDb, ensureSchema } from './lib/cache'

let schemaReady = false

export const onRequest = defineMiddleware(async (context, next) => {
  const env = context.locals.runtime?.env
  if (env?.DB) {
    initDb(env.DB)
    if (!schemaReady) {
      await ensureSchema()
      schemaReady = true
    }
  }
  return next()
})
