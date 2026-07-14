import type { ApresentacaoMedicamento, BuscaPrecoPayload, Farmacia, RespostaPrecos, ResultadoPreco } from '~/types'
import { withPage } from '../services/scrapers/browser'
import { getCachedPrice, setCachedPrice } from '../services/price-cache'

interface RedeConfig { base: string; playwright?: boolean }

const REDES: Array<[RegExp, RedeConfig]> = [
  [/drogasil/i, { base: 'https://www.drogasil.com.br', playwright: true }],
  [/droga.?raia/i, { base: 'https://www.drogaraia.com.br', playwright: true }],
  [/pague.?menos/i, { base: 'https://www.paguemenos.com.br' }],
  [/pacheco/i, { base: 'https://www.pacheco.com.br' }],
  [/ultrafarma/i, { base: 'https://www.ultrafarma.com.br' }],
  [/panvel/i, { base: 'https://www.panvel.com' }],
]

export default defineEventHandler(async (event) => {
  const body = await readBody<BuscaPrecoPayload>(event)
  if (!body.ean || !body.apresentacao) throw createError({ statusCode: 400, statusMessage: 'Escolha uma apresentação com EAN confirmado.' })
  if (!body.farmacias?.length) throw createError({ statusCode: 400, statusMessage: 'Selecione ao menos uma farmácia próxima.' })

  const lojasRecebidas: Farmacia[] = body.lojas?.length
    ? body.lojas
    : body.farmacias.map((nome, index) => ({ id: String(index), nome, endereco: '', distancia_m: 0, aberta: true }))
  const lojas = deduplicarLojas(lojasRecebidas)

  const consultas = await mapWithConcurrency(lojas, 3, async loja => {
    const cacheIdentity = `${loja.nome}:${loja.id}`
    const cached = getCachedPrice(body.ean!, cacheIdentity)
    if (cached) return { result: cached, cached: true }
    const result = await consultar(loja, body.ean!, body.apresentacao!)
    setCachedPrice(body.ean!, cacheIdentity, result)
    return { result, cached: false }
  })

  return {
    produto_normalizado: body.apresentacao.nome,
    apresentacao: formatarApresentacao(body.apresentacao),
    resultados: consultas.map(item => item.result),
    fonte: consultas.every(item => item.cached) ? 'cache' : 'real',
    timestamp: Date.now(),
  } satisfies RespostaPrecos
})

async function consultar(loja: Farmacia, ean: string, apresentacao: ApresentacaoMedicamento): Promise<ResultadoPreco> {
  const rede = REDES.find(([pattern]) => pattern.test(loja.nome))?.[1]
  try {
    if (rede) {
      const result = rede.playwright
        ? await consultarComNavegador(loja, rede, ean, apresentacao)
        : await consultarVtex(loja, rede, ean, apresentacao)
      return result || indisponivel(loja, apresentacao, `${rede.base}/busca?q=${ean}`)
    }
    if (loja.website && websitePublico(loja.website)) {
      return await consultarSiteGenerico(loja, ean, apresentacao) || indisponivel(loja, apresentacao, loja.website)
    }
    return indisponivel(loja, apresentacao)
  } catch (error) {
    console.warn(`[precos] ${loja.nome}: preço não confirmado`, error)
    return indisponivel(loja, apresentacao, rede ? `${rede.base}/busca?q=${ean}` : loja.website)
  }
}

async function consultarVtex(loja: Farmacia, rede: RedeConfig, ean: string, apresentacao: ApresentacaoMedicamento) {
  let products: any[] | null = null
  for (let attempt = 0; attempt < 2 && !products; attempt++) {
    try {
      const response = await fetch(`${rede.base}/api/catalog_system/pub/products/search?fq=alternateIds_Ean:${encodeURIComponent(ean)}`, {
        headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(10_000),
      })
      if (response.ok) products = await response.json()
    } catch {}
  }
  if (!products) return null
  const item = products.flatMap(product => product.items || []).find(productItem => String(productItem.ean || '') === ean)
  if (!item) return null
  const seller = item.sellers?.find((entry: any) => entry.commertialOffer?.IsAvailable) || item.sellers?.[0]
  const offer = seller?.commertialOffer
  const preco = offer?.IsAvailable && Number(offer.Price) > 0 ? Number(offer.Price) : null
  const product = products.find(product => product.items?.includes(item))
  return montarResultado(loja, apresentacao, preco, product?.link || `${rede.base}/busca?q=${ean}`)
}

async function consultarComNavegador(loja: Farmacia, rede: RedeConfig, ean: string, apresentacao: ApresentacaoMedicamento) {
  return withPage(async page => {
    const response = await page.request.get(`${rede.base}/api/catalog_system/pub/products/search?fq=alternateIds_Ean:${encodeURIComponent(ean)}`, { timeout: 15_000, headers: { Referer: `${rede.base}/` } })
    if (response.ok()) {
      const products: any[] = await response.json()
      const item = products.flatMap(product => product.items || []).find(productItem => String(productItem.ean || '') === ean)
      const offer = item?.sellers?.find((entry: any) => entry.commertialOffer?.IsAvailable)?.commertialOffer
      if (item) return montarResultado(loja, apresentacao, offer?.Price || null, products[0]?.link || `${rede.base}/busca?q=${ean}`)
    }
    await page.goto(`${rede.base}/busca?q=${encodeURIComponent(ean)}`, { waitUntil: 'domcontentloaded', timeout: 20_000 })
    const body = await page.locator('body').innerText()
    if (!body.includes(ean)) return null
    const match = body.match(/R\$\s*([\d.]+,\d{2})/)
    const preco = match ? Number(match[1].replace(/\./g, '').replace(',', '.')) : null
    return preco ? montarResultado(loja, apresentacao, preco, page.url()) : null
  })
}

async function consultarSiteGenerico(loja: Farmacia, ean: string, apresentacao: ApresentacaoMedicamento) {
  const base = new URL(loja.website!)
  const urls = [...new Set([
    new URL(`/busca?q=${encodeURIComponent(ean)}`, base).toString(),
    new URL(`/search?q=${encodeURIComponent(ean)}`, base).toString(),
    new URL(`/?s=${encodeURIComponent(ean)}`, base).toString(),
  ])]
  return withPage(async page => {
    for (const url of urls) {
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15_000 })
        const structured = extrairJsonLdExato(await page.locator('script[type="application/ld+json"]').allTextContents(), ean)
        if (structured?.preco) return montarResultado(loja, apresentacao, structured.preco, structured.url || page.url())
        const body = await page.locator('body').innerText({ timeout: 5_000 })
        if (!body.includes(ean)) continue
        const match = body.match(/R\$\s*([\d.]+,\d{2})/)
        const preco = match ? Number(match[1].replace(/\./g, '').replace(',', '.')) : null
        if (preco && preco > 0) return montarResultado(loja, apresentacao, preco, page.url())
      } catch {}
    }
    return null
  })
}

function montarResultado(loja: Farmacia, apresentacao: ApresentacaoMedicamento, preco: number | null, url?: string): ResultadoPreco {
  return {
    farmaciaId: loja.id, farmacia: loja.nome, preco, disponivel: preco !== null, tipo: 'produto exato', marca: apresentacao.marca, url,
    precoUnitario: preco === null ? null : preco / Math.max(apresentacao.quantidade, 1), unidade: apresentacao.unidade,
    confiabilidade: preco === null ? 'indisponivel' : 'online_sem_loja', consultadoEm: new Date().toISOString(),
  }
}

function indisponivel(loja: Farmacia, apresentacao: ApresentacaoMedicamento, url?: string) {
  return montarResultado(loja, apresentacao, null, url)
}

function formatarApresentacao(item: ApresentacaoMedicamento) {
  return `${item.dosagem ? `${item.dosagem} · ` : ''}${item.quantidade} ${item.unidade}${item.quantidade === 1 ? '' : 's'} · EAN ${item.ean}`
}

function websitePublico(value: string) {
  try {
    const url = new URL(value)
    const host = url.hostname.toLowerCase()
    return ['http:', 'https:'].includes(url.protocol) && host !== 'localhost' && !host.endsWith('.local')
      && !/^(127\.|10\.|192\.168\.|169\.254\.|0\.|::1$)/.test(host) && !/^172\.(1[6-9]|2\d|3[01])\./.test(host)
  } catch { return false }
}

function extrairJsonLdExato(scripts: string[], ean: string): { preco: number; url?: string } | null {
  const visit = (value: any): { preco: number; url?: string } | null => {
    if (!value || typeof value !== 'object') return null
    if (Array.isArray(value)) {
      for (const item of value) { const found = visit(item); if (found) return found }
      return null
    }
    const codes = [value.gtin, value.gtin8, value.gtin12, value.gtin13, value.gtin14, value.sku].filter(Boolean).map(String)
    if (value['@type'] === 'Product' && codes.includes(ean)) {
      const offer = Array.isArray(value.offers) ? value.offers[0] : value.offers
      const preco = Number(String(offer?.price || offer?.lowPrice || '').replace(',', '.'))
      if (preco > 0) return { preco, url: value.url || offer?.url }
    }
    for (const child of Object.values(value)) { const found = visit(child); if (found) return found }
    return null
  }
  for (const script of scripts) { try { const found = visit(JSON.parse(script)); if (found) return found } catch {} }
  return null
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, action: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length)
  let cursor = 0
  async function worker() {
    while (cursor < items.length) { const index = cursor++; results[index] = await action(items[index]) }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

function deduplicarLojas(lojas: Farmacia[]) {
  const unique = new Map<string, Farmacia>()
  for (const loja of [...lojas].sort((a, b) => a.distancia_m - b.distancia_m)) {
    const rede = REDES.find(([pattern]) => pattern.test(loja.nome))?.[1]
    let key = rede?.base
    if (!key && loja.website) {
      try { key = new URL(loja.website).origin } catch {}
    }
    key ||= loja.nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\b(drogarias?|farmacias?)\b/g, '').trim()
    if (!unique.has(key)) unique.set(key, loja)
  }
  return [...unique.values()]
}
