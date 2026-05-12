import { execFile } from 'child_process'

export interface ExecResult {
  stdout: string
  stderr: string
  status: number
  notFound: boolean
}

export function execFileNoThrow(
  file: string,
  args: string[]
): Promise<ExecResult> {
  return new Promise(resolve => {
    execFile(file, args, { maxBuffer: 50 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err && (err as NodeJS.ErrnoException).code === 'ENOENT') {
        resolve({ stdout: '', stderr: '', status: -1, notFound: true })
        return
      }
      resolve({
        stdout: stdout ?? '',
        stderr: stderr ?? '',
        status: (err as NodeJS.ErrnoException & { code?: number })?.code ?? 0,
        notFound: false,
      })
    })
  })
}
