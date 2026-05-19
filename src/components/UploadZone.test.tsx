import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { UploadZone } from './UploadZone'

describe('UploadZone', () => {
  it('renders drop zone and browse button', () => {
    render(<UploadZone />)
    expect(screen.getByText(/drop your file/i)).toBeInTheDocument()
    expect(screen.getByText(/browse files/i)).toBeInTheDocument()
  })

  it('shows accepted file types', () => {
    render(<UploadZone />)
    expect(screen.getByText(/requirements\.txt/i)).toBeInTheDocument()
    expect(screen.getByText(/poetry\.lock/i)).toBeInTheDocument()
    expect(screen.getByText(/packages\.lock\.json/i)).toBeInTheDocument()
  })

  it('rejects files with wrong extension and shows error', async () => {
    render(<UploadZone />)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [new File(['x'], 'setup.py')] } })
    expect(await screen.findByText(/only requirements\.txt.*poetry\.lock.*packages\.lock\.json/i)).toBeInTheDocument()
  })
})
