import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusBadge } from './StatusBadge'

describe('StatusBadge', () => {
  it('renders CVE count badge', () => {
    render(<StatusBadge type="cve" count={3} />)
    expect(screen.getByText('● 3 CVE')).toBeInTheDocument()
  })

  it('renders version-behind badge', () => {
    render(<StatusBadge type="versions" count={4} />)
    expect(screen.getByText('+4 ver')).toBeInTheDocument()
  })

  it('renders major-behind badge', () => {
    render(<StatusBadge type="major" />)
    expect(screen.getByText('⬆ MAJOR')).toBeInTheDocument()
  })

  it('renders healthy badge', () => {
    render(<StatusBadge type="healthy" />)
    expect(screen.getByText('✓')).toBeInTheDocument()
  })

  it('renders EOL badge with years', () => {
    render(<StatusBadge type="eol" years={3} />)
    expect(screen.getByText('☠ EOL 3yr')).toBeInTheDocument()
  })

  it('renders nothing when count is 0 for cve type', () => {
    const { container } = render(<StatusBadge type="cve" count={0} />)
    expect(container.firstChild).toBeNull()
  })
})
