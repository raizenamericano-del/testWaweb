import { chromium } from 'playwright-core'

const url = process.argv[2] || 'http://127.0.0.1:8080/'
const out = process.argv[3] || '/home/user/shots/shot.png'
const wait = Number(process.argv[4] || 4000)
const w = Number(process.argv[5] || 1440)
const h = Number(process.argv[6] || 900)

const browser = await chromium.launch({ args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 })
const errors = []
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()) })
await page.goto(url, { waitUntil: 'networkidle' }).catch(() => {})
await page.waitForTimeout(wait)
await page.screenshot({ path: out })
console.log('errors:', errors.length)
errors.slice(0, 8).forEach((e) => console.log(' ', e.slice(0, 400)))
console.log('text:', (await page.textContent('#root').catch(() => '') || '').replace(/\s+/g, ' ').slice(0, 400))
await browser.close()
