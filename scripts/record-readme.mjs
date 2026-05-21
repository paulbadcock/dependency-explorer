// Requires: npm install --no-save playwright && npx playwright install chromium
// Requires: brew install ffmpeg
// Dev server must be running at http://localhost:4321

import { chromium } from 'playwright'
import { execFileSync } from 'child_process'
import { readdirSync, renameSync, unlinkSync, readFileSync, statSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const SCREENSHOTS = path.join(ROOT, 'screenshots')
const FIXTURES = path.join(ROOT, 'fixtures')
const BASE_URL = 'http://localhost:4321'

function jitter(ms) { return ms + Math.floor(Math.random() * 400 - 200) }

// ── Pre-seed requirements-new.txt (not part of the recording) ──────────────
const newContent = readFileSync(path.join(FIXTURES, 'requirements-new.txt'))
const formData = new FormData()
formData.append(
  'file',
  new Blob([newContent], { type: 'text/plain' }),
  'requirements-new.txt'
)
const seedRes = await fetch(`${BASE_URL}/api/analyze`, {
  method: 'POST',
  body: formData,
  redirect: 'manual',
})
const newId = seedRes.headers.get('location')?.split('/analysis/')[1]
if (!newId) throw new Error('Pre-seed failed — no Location header from /api/analyze')
console.log('✓ pre-seeded requirements-new.txt →', newId)

// ── Recording ──────────────────────────────────────────────────────────────
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  recordVideo: { dir: SCREENSHOTS, size: { width: 1280, height: 800 } },
})
const page = await context.newPage()

// 0s — Home page
await page.goto(BASE_URL, { waitUntil: 'networkidle' })
await page.mouse.move(400, 400, { steps: 10 })
await page.waitForTimeout(jitter(1500))

// ~3s — Upload requirements-old.txt
await page.mouse.move(640, 290, { steps: 25 })
await page.waitForTimeout(jitter(500))
const input = page.locator('input[type="file"]')
await input.setInputFiles(path.join(FIXTURES, 'requirements-old.txt'))

// Wait for analysis page
await page.waitForURL('**/analysis/**', { timeout: 60000 })
await page.waitForLoadState('networkidle', { timeout: 60000 })

// ~6s — Hold on header stats (87 CVEs, 4 major behind, 2 EOL)
await page.mouse.move(640, 75, { steps: 15 })
await page.waitForTimeout(jitter(2500))

// ~9s — Click the requests row to open right panel with version timeline + CVEs
await page.locator('text=requests').first().click()
await page.waitForTimeout(jitter(1500))

// ~14s — Scroll the right panel (CVE list) — mouse wheel over right half of screen
await page.mouse.move(900, 500, { steps: 10 })
await page.mouse.wheel(0, 200)
await page.waitForTimeout(jitter(800))
await page.mouse.wheel(0, 200)
await page.waitForTimeout(jitter(800))
await page.mouse.wheel(0, 200)
await page.waitForTimeout(jitter(2000))

// ~20s — Click Compare button, wait for dropdown, click requirements-new entry
await page.click('#compare-toggle')
await page.waitForSelector('#compare-menu', { state: 'visible' })
await page.waitForTimeout(jitter(700))
await page.click(`#compare-menu a[href*="${newId}"]`)

// ~25s — Compare page loads
await page.waitForURL('**/compare/**', { timeout: 30000 })
await page.waitForLoadState('networkidle', { timeout: 30000 })
await page.waitForTimeout(jitter(2000))

// ~30s — Scroll compare table to show CVE counts changing row by row
await page.mouse.move(640, 400, { steps: 10 })
await page.mouse.wheel(0, 150)
await page.waitForTimeout(jitter(900))
await page.mouse.wheel(0, 150)
await page.waitForTimeout(jitter(900))
await page.mouse.wheel(0, 120)
await page.waitForTimeout(jitter(900))

// ~38s — Hold on sqlalchemy row (critical → warning)
await page.waitForTimeout(jitter(2000))

await context.close()
await browser.close()

// Rename Playwright's UUID webm
const webms = readdirSync(SCREENSHOTS)
  .filter(f => f.endsWith('.webm') && !f.startsWith('tour-'))
  .sort()
if (!webms.length) throw new Error(`No .webm recording found in ${SCREENSHOTS} — did Playwright record correctly?`)
const webmPath = path.join(SCREENSHOTS, webms.at(-1))
const outWebm = path.join(SCREENSHOTS, 'tour-readme.webm')
renameSync(webmPath, outWebm)
console.log('✓ recorded tour-readme.webm')

// Convert webm → GIF, two-pass palette for quality, 960px wide to keep size sane
const gifPath = path.join(SCREENSHOTS, 'tour-readme.gif')
const palettePath = path.join(SCREENSHOTS, 'palette.png')

execFileSync('ffmpeg', [
  '-y', '-i', outWebm,
  '-vf', 'fps=10,scale=960:-1:flags=lanczos,palettegen=max_colors=128',
  '-update', '1',
  palettePath,
], { stdio: 'inherit' })

execFileSync('ffmpeg', [
  '-y', '-i', outWebm, '-i', palettePath,
  '-filter_complex', 'fps=10,scale=960:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5',
  gifPath,
], { stdio: 'inherit' })

unlinkSync(outWebm)
unlinkSync(palettePath)
console.log('✓ screenshots/tour-readme.gif')
console.log('  size:', (statSync(gifPath).size / 1024 / 1024).toFixed(1), 'MB')
