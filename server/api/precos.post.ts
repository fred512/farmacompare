import type { ApresentacaoMedicamento, BuscaPrecoPayload, Farmacia, RespostaPrecos, ResultadoPreco } from '~/types'
import { withPage } from '../services/scrapers/browser'
import { getCachedPrice, setCachedPrice } from '../services/price-cache'

interface RedeConfig { base: string; playwright?: boolean }

const REDES: Array<[RegExp, RedeConfig]> = [
  [/drogasil/i, { base: 'https://www.drogasil.com.br', playwright: true }],
  [/droga.?raia/i, { base: 'https://www.drogaraia.com.br', playwright: true }],
  [/pague.?menos/i, { base: 'https://www.paguemenos.com.br' }],
  [/pacheco/i, { base: 'https://www.pacheco.com.br', playwright: true }],
  [/ultrafarma/i, { base: 'https://www.ultrafarma.com.br' }],
  [/panvel/i, { base: 'https://www.panvel.com' }],
]

export default defineEventHandler(async (event) => {
  const body = await readBody<BuscaPrecoPayload>(event)
  if (!body.apresentacao) throw createError({ statusCode: 400, statusMessage: 'Escolha uma apresentação para comparar.' })
  if (!body.farmacias?.length) throw createError({ statusCode: 400, statusMessage: 'Selecione ao menos uma farmácia próxima.' })

  const lojasRecebidas: Farmacia[] = body.lojas?.length
    ? body.lojas
    : body.farmacias.map((nome, index) => ({ id: String(index), nome, endereco: '', distancia_m: 0, aberta: true }))
  const lojas = deduplicarLojas(lojasRecebidas)

  const consultas = await mapWithConcurrency(lojas, 3, async loja => {
    const cacheIdentity = `${loja.nome}:${loja.id}`
    const chaveProduto = chaveEquivalencia(body.apresentacao!)
    const cached = getCachedPrice(chaveProduto, cacheIdentity)
    if (cached) return { result: cached, cached: true }
    const result = await consultar(loja, body.query || body.apresentacao!.principiosAtivos, body.apresentacao!)
    setCachedPrice(chaveProduto, cacheIdentity, result)
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

async function consultar(loja: Farmacia, query: string, apresentacao: ApresentacaoMedicamento): Promise<ResultadoPreco> {
  const rede = REDES.find(([pattern]) => pattern.test(loja.nome))?.[1]
  try {
    if (rede) {
      const result = rede.playwright
        ? await consultarComNavegador(loja, rede, query, apresentacao)
        : await consultarVtex(loja, rede, query, apresentacao)
      return result || indisponivel(loja, apresentacao, `${rede.base}/busca?q=${encodeURIComponent(query)}`)
    }
    if (loja.website && websitePublico(loja.website)) {
      return await consultarSiteGenerico(loja, query, apresentacao) || indisponivel(loja, apresentacao, loja.website)
    }
    return indisponivel(loja, apresentacao)
  } catch (error) {
    console.warn(`[precos] ${loja.nome}: preço não confirmado`, error)
    return indisponivel(loja, apresentacao, rede ? `${rede.base}/busca?q=${encodeURIComponent(query)}` : loja.website)
  }
}

async function consultarVtex(loja: Farmacia, rede: RedeConfig, query: string, apresentacao: ApresentacaoMedicamento) {
  let products: any[] | null = null
  for (let attempt = 0; attempt < 2 && !products; attempt++) {
    try {
      const response = await fetch(`${rede.base}/api/catalog_system/pub/products/search?ft=${encodeURIComponent(query)}&_from=0&_to=49`, {
        headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(10_000),
      })
      if (response.ok) products = await response.json()
    } catch {}
  }
  if (!products) return null
  const melhor = melhorOfertaEquivalente(products, apresentacao)
  if (!melhor) return null
  const { product, item, preco, promocao } = melhor
  const apresentacaoEncontrada = { ...apresentacao, marca: String(product.brand || apresentacao.marca) }
  return montarResultado(
    loja,
    apresentacaoEncontrada,
    promocao?.preco ?? preco,
    product?.link || `${rede.base}/busca?q=${encodeURIComponent(query)}`,
    promocao ? { precoOriginal: preco, promocao: promocao.descricao, quantidadePromocional: promocao.quantidade } : undefined,
  )
}

async function consultarComNavegador(loja: Farmacia, rede: RedeConfig, query: string, apresentacao: ApresentacaoMedicamento) {
  return withPage(async page => {
    const response = await page.request.get(`${rede.base}/api/catalog_system/pub/products/search?ft=${encodeURIComponent(query)}&_from=0&_to=49`, { timeout: 15_000, headers: { Referer: `${rede.base}/` } })
    if (response.ok()) {
      const products: any[] = await response.json()
      const melhor = melhorOfertaEquivalente(products, apresentacao)
      if (melhor) {
        const detalhes = melhor.promocao
          ? { precoOriginal: melhor.preco, promocao: melhor.promocao.descricao, quantidadePromocional: melhor.promocao.quantidade }
          : undefined
        return montarResultado(loja, { ...apresentacao, marca: melhor.product.brand || apresentacao.marca }, melhor.promocao?.preco ?? melhor.preco, melhor.product.link, detalhes)
      }
    }
    await page.goto(`${rede.base}/busca?q=${encodeURIComponent(query)}`, { waitUntil: 'domcontentloaded', timeout: 25_000 })
    await page.waitForTimeout(2500)
    const cards = page.locator('article, [data-testid*="product" i], [class*="product-card" i], [class*="ProductCard" i]')
    for (let index = 0; index < Math.min(await cards.count(), 80); index++) {
      const card = cards.nth(index)
      const texto = await card.innerText().catch(() => '')
      if (!equivalente(texto, apresentacao)) continue
      const precos = [...texto.matchAll(/R\$\s*([\d.]+,\d{2})/g)].map(match => Number(match[1].replace(/\./g, '').replace(',', '.'))).filter(value => value > 0)
      if (!precos.length) continue
      const link = await card.locator('a').first().getAttribute('href').catch(() => null)
      const url = link ? new URL(link, rede.base).toString() : page.url()
      const preco = Math.min(...precos)
      const quantidade = /2\s+por/i.test(texto) ? 2 : undefined
      return montarResultado(loja, apresentacao, preco, url, quantidade ? { promocao: 'Preço promocional exibido no site', quantidadePromocional: quantidade } : undefined)
    }
    return null
  })
}

async function consultarSiteGenerico(loja: Farmacia, query: string, apresentacao: ApresentacaoMedicamento) {
  const base = new URL(loja.website!)
  const urls = [...new Set([
    new URL(`/busca?q=${encodeURIComponent(query)}`, base).toString(),
    new URL(`/search?q=${encodeURIComponent(query)}`, base).toString(),
    new URL(`/?s=${encodeURIComponent(query)}`, base).toString(),
  ])]
  return withPage(async page => {
    for (const url of urls) {
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15_000 })
        const structured = extrairJsonLdExato(await page.locator('script[type="application/ld+json"]').allTextContents(), apresentacao.ean)
        if (structured?.preco) return montarResultado(loja, apresentacao, structured.preco, structured.url || page.url())
        const body = await page.locator('body').innerText({ timeout: 5_000 })
        if (!equivalente(body, apresentacao)) continue
        const match = body.match(/R\$\s*([\d.]+,\d{2})/)
        const preco = match ? Number(match[1].replace(/\./g, '').replace(',', '.')) : null
        if (preco && preco > 0) return montarResultado(loja, apresentacao, preco, page.url())
      } catch {}
    }
    return null
  })
}

function montarResultado(
  loja: Farmacia,
  apresentacao: ApresentacaoMedicamento,
  preco: number | null,
  url?: string,
  detalhes?: Pick<ResultadoPreco, 'precoOriginal' | 'promocao' | 'quantidadePromocional'>,
): ResultadoPreco {
  return {
    farmaciaId: loja.id, farmacia: loja.nome, preco, disponivel: preco !== null, tipo: 'produto exato', marca: apresentacao.marca, url,
    precoUnitario: preco === null ? null : preco / Math.max(apresentacao.quantidade, 1), unidade: apresentacao.unidade,
    confiabilidade: preco === null ? 'indisponivel' : 'online_sem_loja', consultadoEm: new Date().toISOString(),
    ...detalhes,
  }
}

function melhorOfertaEquivalente(products: any[], apresentacao: ApresentacaoMedicamento) {
  const ofertas: Array<{ product: any; item: any; preco: number; promocao: ReturnType<typeof extrairPromocao> }> = []
  for (const product of products) {
    if (!equivalente(String(product.productName || product.productTitle || ''), apresentacao)) continue
    for (const item of product.items || []) {
      for (const seller of item.sellers || []) {
        const offer = seller.commertialOffer
        const preco = offer?.IsAvailable && Number(offer.Price) > 0 ? Number(offer.Price) : 0
        if (!preco) continue
        ofertas.push({ product, item, preco, promocao: extrairPromocao(offer, preco) })
      }
    }
  }
  return ofertas.sort((a, b) => (a.promocao?.preco ?? a.preco) - (b.promocao?.preco ?? b.preco))[0]
}

function equivalente(texto: string, apresentacao: ApresentacaoMedicamento) {
  const nome = normalizar(texto).replace(/\s+/g, ' ')
  const dosesEsperadas = extrairDoses(apresentacao.dosagem || apresentacao.nome)
  const dosesEncontradas = extrairDoses(nome)
  if (dosesEsperadas.length && (dosesEsperadas.length !== dosesEncontradas.length || dosesEsperadas.some((dose, index) => dose !== dosesEncontradas[index]))) return false
  const quantidade = apresentacao.quantidade
  if (quantidade <= 1) return true
  const unidade = apresentacao.unidade === 'comprimido' ? 'comprim' : apresentacao.unidade === 'cápsula' ? 'caps' : apresentacao.unidade
  return new RegExp(`(?:com\\s+)?${quantidade}\\s*(?:${unidade}|unidade)`, 'i').test(nome)
}

function extrairDoses(value: string) {
  return (normalizar(value).match(/\d+(?:[,.]\d+)?\s*(?:mg|mcg|g|ml)/g) || [])
    .map(dose => dose.replace(/\s+/g, '').replace(',', '.'))
    .sort()
}

function chaveEquivalencia(item: ApresentacaoMedicamento) {
  const principio = normalizar(item.principiosAtivos || '').replace(/[^a-z0-9]+/g, ' ').trim()
  const dose = normalizar(item.dosagem || '').replace(/\s+/g, '')
  return `${principio}|${dose}|${item.quantidade}|${item.unidade}`
}

function normalizar(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function extrairPromocao(offer: any, preco: number) {
  const nomes = (offer?.Teasers || [])
    .map((teaser: any) => String(teaser?.['<Name>k__BackingField'] || teaser?.name || ''))
    .filter(Boolean)

  for (const descricao of nomes) {
    const segunda = descricao.match(/(\d+(?:[,.]\d+)?)\s*%?\s*(?:de\s+)?desconto\s+na\s+segunda/i)
    if (segunda) {
      const desconto = Number(segunda[1].replace(',', '.')) / 100
      if (desconto > 0 && desconto <= 1) {
        return { preco: arredondar((preco + preco * (1 - desconto)) / 2), quantidade: 2, descricao }
      }
    }
    const levePague = descricao.match(/leve\s+(\d+)\D+pague\s+(\d+)/i)
    if (levePague) {
      const leve = Number(levePague[1])
      const pague = Number(levePague[2])
      if (leve > pague && pague > 0) return { preco: arredondar(preco * pague / leve), quantidade: leve, descricao }
    }
  }
  return null
}

function arredondar(value: number) {
  return Math.round(value * 100) / 100
}

function indisponivel(loja: Farmacia, apresentacao: ApresentacaoMedicamento, url?: string) {
  return montarResultado(loja, apresentacao, null, url)
}

function formatarApresentacao(item: ApresentacaoMedicamento) {
  return `${item.dosagem ? `${item.dosagem} · ` : ''}${item.quantidade} ${item.unidade}${item.quantidade === 1 ? '' : 's'}${item.ean ? ` · EAN de referência ${item.ean}` : ''}`
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
