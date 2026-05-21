import { chromium } from 'playwright'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const BASE_URL = 'http://localhost:4321'
const SCREENSHOTS = path.join(ROOT, 'screenshots')
const FIXTURES = path.join(ROOT, 'fixtures')

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
const page = await context.newPage()

// Home page
await page.goto(BASE_URL, { waitUntil: 'networkidle' })
await page.screenshot({ path: path.join(SCREENSHOTS, 'home.png') })
console.log('✓ home.png')

// Analysis page — upload the old fixture
const input1 = page.locator('input[type="file"]')
await input1.setInputFiles(path.join(FIXTURES, 'requirements-old.txt'))
await page.waitForURL('**/analysis/**', { timeout: 60000 })
await page.waitForLoadState('networkidle', { timeout: 60000 })
await page.screenshot({ path: path.join(SCREENSHOTS, 'analysis.png') })
console.log('✓ analysis.png')

const id1 = page.url().split('/analysis/')[1]
console.log('  id1:', id1)

// Upload the new fixture for compare
await page.goto(BASE_URL, { waitUntil: 'networkidle' })
const input2 = page.locator('input[type="file"]')
await input2.setInputFiles(path.join(FIXTURES, 'requirements-new.txt'))
await page.waitForURL('**/analysis/**', { timeout: 60000 })
await page.waitForLoadState('networkidle', { timeout: 60000 })

const id2 = page.url().split('/analysis/')[1]
console.log('  id2:', id2)

// Compare page
await page.goto(`${BASE_URL}/compare/${id1}/${id2}`, { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForLoadState('networkidle', { timeout: 30000 })
await page.screenshot({ path: path.join(SCREENSHOTS, 'compare.png') })
console.log('✓ compare.png')

await browser.close()
console.log('All screenshots captured.')
