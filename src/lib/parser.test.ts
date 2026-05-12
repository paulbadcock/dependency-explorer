// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { parseDirectDepNames, toRequirementsTxt } from './parser'

const REQUIREMENTS_TXT = `
# a comment
requests>=2.28.0
fastapi==0.100.0
  httpx
-r other.txt
--index-url https://example.com
`

const PYPROJECT_TOML = `
[project]
name = "my-app"
dependencies = [
  "requests>=2.28.0",
  "fastapi[standard]==0.100.0",
  "httpx",
]
`

describe('parseDirectDepNames', () => {
  it('extracts names from requirements.txt, skipping comments and options', () => {
    expect(parseDirectDepNames('requirements.txt', REQUIREMENTS_TXT)).toEqual(['requests', 'fastapi', 'httpx'])
  })

  it('extracts names from pyproject.toml [project.dependencies]', () => {
    expect(parseDirectDepNames('pyproject.toml', PYPROJECT_TOML)).toEqual(['requests', 'fastapi', 'httpx'])
  })

  it('returns lowercase names', () => {
    expect(parseDirectDepNames('requirements.txt', 'Requests>=2.0\n')).toEqual(['requests'])
  })
})

describe('toRequirementsTxt', () => {
  it('returns requirements.txt content unchanged', () => {
    expect(toRequirementsTxt('requirements.txt', 'requests>=2.0\n')).toBe('requests>=2.0\n')
  })

  it('converts pyproject.toml to requirements.txt format', () => {
    const result = toRequirementsTxt('pyproject.toml', PYPROJECT_TOML)
    expect(result).toContain('requests>=2.28.0')
    expect(result).toContain('fastapi[standard]==0.100.0')
    expect(result).toContain('httpx')
  })
})
