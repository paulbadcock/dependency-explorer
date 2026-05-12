import { describe, it, expect } from 'vitest'
import { execFileNoThrow } from './execFileNoThrow'

describe('execFileNoThrow', () => {
  it('returns stdout on success', async () => {
    const result = await execFileNoThrow('node', ['-e', 'process.stdout.write("hello")'])
    expect(result.stdout).toBe('hello')
    expect(result.status).toBe(0)
  })

  it('returns stderr and non-zero status on failure', async () => {
    const result = await execFileNoThrow('node', ['-e', 'process.exit(1)'])
    expect(result.status).toBe(1)
  })

  it('returns notFound=true when the executable does not exist', async () => {
    const result = await execFileNoThrow('this-binary-does-not-exist-xyz', [])
    expect(result.notFound).toBe(true)
  })
})
