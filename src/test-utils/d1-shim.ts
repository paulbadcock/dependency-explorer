import Database from 'better-sqlite3'

// Creates a D1Database-compatible object backed by an in-memory better-sqlite3
// instance. Used only in tests — never imported in production code.
export function createD1Shim(): D1Database {
  const sqlite = new Database(':memory:')

  function makeStatement(sql: string) {
    let boundValues: unknown[] = []

    const stmt = {
      bind(...values: unknown[]) {
        boundValues = values
        return stmt
      },
      async first<T>(): Promise<T | null> {
        return (sqlite.prepare(sql).get(...(boundValues as Parameters<typeof sqlite.prepare>)) as T | undefined) ?? null
      },
      async all<T>(): Promise<{ results: T[] }> {
        return { results: sqlite.prepare(sql).all(...(boundValues as Parameters<typeof sqlite.prepare>)) as T[] }
      },
      async run(): Promise<{ meta: { changes: number } }> {
        const info = sqlite.prepare(sql).run(...(boundValues as Parameters<typeof sqlite.prepare>))
        return { meta: { changes: info.changes } }
      },
    }
    return stmt
  }

  return {
    prepare(sql: string) {
      return makeStatement(sql) as ReturnType<D1Database['prepare']>
    },
    // Run multi-statement DDL by splitting on semicolons and preparing each
    async exec(sql: string) {
      sql.split(';').map(s => s.trim()).filter(Boolean).forEach(s => sqlite.prepare(s).run())
      return { count: 0, duration: 0 } as ReturnType<D1Database['exec']> extends Promise<infer R> ? R : never
    },
    async batch() {
      return [] as ReturnType<D1Database['batch']> extends Promise<infer R> ? R : never
    },
    async dump() {
      return new ArrayBuffer(0)
    },
  } as unknown as D1Database
}
