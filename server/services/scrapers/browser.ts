import { chromium, type Browser } from 'playwright'

let browserPromise: Promise<Browser> | undefined

export function getBrowser() {
  browserPromise ||= chromium.launch({ headless: true })
  return browserPromise
}

export async function withPage<T>(action: (page: import('playwright').Page) => Promise<T>) {
  const browser = await getBrowser()
  const context = await browser.newContext({
    locale: 'pt-BR',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
  })
  try {
    return await action(await context.newPage())
  } finally {
    await context.close()
  }
}
