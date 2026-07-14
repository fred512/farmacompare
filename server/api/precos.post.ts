import type { ApresentacaoMedicamento, BuscaPrecoPayload, RespostaPrecos, ResultadoPreco } from '~/types'
import { withPage } from '../services/scrapers/browser'
import { getCachedPrice, setCachedPrice } from '../services/price-cache'

interface RedeConfig { nome: string; base: string; playwright?: boolean }

const REDES: Array<[RegExp, RedeConfig]> = [
  [/drogasil/i, { nome: 'Drogasil', base: 'https://www.drogasil.com.br', playwright: true }],
  [/droga.?raia/i, { nome: 'Droga Raia', base: 'https://www.drogaraia.com.br', playwright: true }],
  [/pague.?menos/i, { nome: 'Farmácias Pague Menos', base: 'https://www.paguemenos.com.br' }],
  [/pacheco/i, { nome: 'Pacheco', base: 'https://www.pacheco.com.br' }],
  [/ultrafarma/i, { nome: 'Ultrafarma', base: 'https://www.ultrafarma.com.br' }],
  [/panvel/i, { nome: 'Panvel', base: 'https://www.panvel.com' }],
]

export default defineEventHandler(async (event) => {
  const body = await readBody<BuscaPrecoPayload>(event)
  if (!body.ean || !body.apresentacao) {
    throw createError({ statusCode: 400, statusMessage: 'Escolha uma apresentação com EAN confirmado.' })
  }
  if (!body.farmacias?.length) {
    throw createError({ statusCode: 400, statusMessage: 'Selecione ao menos uma farmácia próxima.' })
  }

  const consultas = await Promise.all(body.farmacias.map(async farmacia => {
    const cached = getCachedPrice(body.ean!, farmacia)
    if (cached) return { result: cached, cached: true }
    const result = await consultar(farmacia, body.ean!, body.apresentacao!)
    setCachedPrice(body.ean!, farmacia, result)
    return { result, cached: false }
  }))
  return {
    produto_normalizado: body.apresentacao.nome,
    apresentacao: formatarApresentacao(body.apresentacao),
    resultados: consultas.map(item => item.result),
    fonte: consultas.every(item => item.cached) ? 'cache' : 'real',
    timestamp: Date.now(),
  } satisfies RespostaPrecos
})

async function consultar(farmacia: string, ean: string, apresentacao: ApresentacaoMedicamento): Promise<ResultadoPreco> {
  const rede = REDES.find(([pattern]) => pattern.test(farmacia))?.[1]
  if (!rede) return indisponivel(farmacia, apresentacao)

  try {
    const resultado = rede.playwright
      ? await consultarComNavegador(farmacia, rede, ean, apresentacao)
      : await consultarVtex(farmacia, rede, ean, apresentacao)
    return resultado || indisponivel(farmacia, apresentacao, `${rede.base}/busca?q=${ean}`)
  } catch (error) {
    console.warn(`[precos] ${farmacia}: preço não confirmado`, error)
    return indisponivel(farmacia, apresentacao, `${rede.base}/busca?q=${ean}`)
  }
}

async function consultarVtex(farmacia: string, rede: RedeConfig, ean: string, apresentacao: ApresentacaoMedicamento) {
  const url = `${rede.base}/api/catalog_system/pub/products/search?fq=alternateIds_Ean:${encodeURIComponent(ean)}`
  const response = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) return null
  const products: any[] = await response.json()
  const item = products.flatMap(product => product.items || []).find(productItem => String(productItem.ean || '') === ean)
  if (!item) return null
  const seller = item.sellers?.find((entry: any) => entry.commertialOffer?.IsAvailable) || item.sellers?.[0]
  const offer = seller?.commertialOffer
  const preco = offer?.IsAvailable && Number(offer.Price) > 0 ? Number(offer.Price) : null
  const product = products.find(product => product.items?.includes(item))
  return montarResultado(farmacia, apresentacao, preco, product?.link || `${rede.base}/busca?q=${ean}`)
}

async function consultarComNavegador(farmacia: string, rede: RedeConfig, ean: string, apresentacao: ApresentacaoMedicamento) {
  return withPage(async page => {
    const apiUrl = `${rede.base}/api/catalog_system/pub/products/search?fq=alternateIds_Ean:${encodeURIComponent(ean)}`
    const response = await page.request.get(apiUrl, { timeout: 15_000, headers: { Referer: `${rede.base}/` } })
    if (response.ok()) {
      const products: any[] = await response.json()
      const item = products.flatMap(product => product.items || []).find(productItem => String(productItem.ean || '') === ean)
      const offer = item?.sellers?.find((entry: any) => entry.commertialOffer?.IsAvailable)?.commertialOffer
      if (item) return montarResultado(farmacia, apresentacao, offer?.Price || null, products[0]?.link || `${rede.base}/busca?q=${ean}`)
    }

    await page.goto(`${rede.base}/busca?q=${encodeURIComponent(ean)}`, { waitUntil: 'domcontentloaded', timeout: 20_000 })
    const body = await page.locator('body').innerText()
    if (!body.includes(ean)) return null
    const match = body.match(/R\$\s*([\d.]+,\d{2})/)
    const preco = match ? Number(match[1].replace(/\./g, '').replace(',', '.')) : null
    return montarResultado(farmacia, apresentacao, preco, page.url())
  })
}

function montarResultado(farmacia: string, apresentacao: ApresentacaoMedicamento, preco: number | null, url?: string): ResultadoPreco {
  return {
    farmacia, preco, disponivel: preco !== null, tipo: 'produto exato', marca: apresentacao.marca, url,
    precoUnitario: preco === null ? null : preco / Math.max(apresentacao.quantidade, 1),
    unidade: apresentacao.unidade,
    confiabilidade: preco === null ? 'indisponivel' : 'online_sem_loja',
    consultadoEm: new Date().toISOString(),
  }
}

function indisponivel(farmacia: string, apresentacao: ApresentacaoMedicamento, url?: string): ResultadoPreco {
  return montarResultado(farmacia, apresentacao, null, url)
}

function formatarApresentacao(item: ApresentacaoMedicamento) {
  return `${item.dosagem ? `${item.dosagem} · ` : ''}${item.quantidade} ${item.unidade}${item.quantidade === 1 ? '' : 's'} · EAN ${item.ean}`
}
