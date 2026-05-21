// Requires: npm install --no-save playwright && npx playwright install chromium
// Requires: brew install ffmpeg
// Dev server must be running at http://localhost:4321

import { chromium } from 'playwright'
import { execFileSync } from 'child_process'
import { readdirSync, renameSync, unlinkSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const SCREENSHOTS = path.join(ROOT, 'screenshots')
const FIXTURES = path.join(ROOT, 'fixtures')
const BASE_URL = 'http://localhost:4321'

function jitter(ms) { return ms + Math.floor(Math.random() * 400 - 200) }

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: SCREENSHOTS, size: { width: 1280, height: 720 } },
})
const page = await context.newPage()

// 0s — Home page, cursor idles near upload zone
await page.goto(BASE_URL, { waitUntil: 'networkidle' })
await page.mouse.move(200, 200, { steps: 10 })
await page.waitForTimeout(jitter(1000))
await page.mouse.move(640, 290, { steps: 30 })
await page.waitForTimeout(jitter(800))

// ~2s — Upload via hidden file input
const input = page.locator('input[type="file"]')
await input.setInputFiles(path.join(FIXTURES, 'requirements-old.txt'))

// ~4s — "Analysing…" spinner; wait for redirect to analysis page
await page.waitForURL('**/analysis/**', { timeout: 60000 })
await page.waitForLoadState('networkidle', { timeout: 60000 })

// ~6s — Hold on header stats (87 CVEs badge)
await page.mouse.move(640, 75, { steps: 15 })
await page.waitForTimeout(jitter(2000))

// ~8s — Slow scroll through package list
await page.mouse.move(250, 400, { steps: 15 })
await page.mouse.wheel(0, 120)
await page.waitForTimeout(jitter(700))
await page.mouse.wheel(0, 120)
await page.waitForTimeout(jitter(700))
await page.mouse.wheel(0, 100)
await page.waitForTimeout(jitter(700))

// ~12s — Freeze on package list with red CVE badges
await page.waitForTimeout(jitter(1500))

await context.close()
await browser.close()

// Playwright saves webm with a UUID filename — find and rename
const webms = readdirSync(SCREENSHOTS)
  .filter(f => f.endsWith('.webm') && !f.startsWith('tour-'))
  .sort()
const webmPath = path.join(SCREENSHOTS, webms.at(-1))
const outWebm = path.join(SCREENSHOTS, 'tour-linkedin.webm')
renameSync(webmPath, outWebm)
console.log('✓ recorded tour-linkedin.webm')

// Convert webm → H.264 MP4 (faststart = streamable from first byte)
const outMp4 = path.join(SCREENSHOTS, 'tour-linkedin.mp4')
execFileSync('ffmpeg', [
  '-y', '-i', outWebm,
  '-c:v', 'libx264',
  '-movflags', 'faststart',
  '-pix_fmt', 'yuv420p',
  outMp4,
], { stdio: 'inherit' })
unlinkSync(outWebm)
console.log('✓ screenshots/tour-linkedin.mp4')
