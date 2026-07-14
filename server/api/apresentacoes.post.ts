import type { ApresentacaoMedicamento, BuscaApresentacoesPayload, UnidadeDose } from '~/types'

const CATALOGOS = ['https://www.paguemenos.com.br']

export default defineEventHandler(async (event) => {
  const { query, lojas = [] } = await readBody<BuscaApresentacoesPayload>(event)
  if (!query?.trim()) throw createError({ statusCode: 400, statusMessage: 'Informe o medicamento.' })

  const queryNormalizada = query.trim().replace(/[+&,/]+/g, ' ').replace(/\s+/g, ' ')
  const redesSelecionadas = lojas.length
    ? CATALOGOS.filter(base => lojas.some(loja => /pague.?menos/i.test(loja.nome) && base.includes('paguemenos')))
    : CATALOGOS
  const catalogos = redesSelecionadas.length ? redesSelecionadas : CATALOGOS
  const respostas = await Promise.allSettled(catalogos.map(base => buscarCatalogo(base, queryNormalizada)))
  const unicos = new Map<string, ApresentacaoMedicamento>()
  for (const resposta of respostas) {
    if (resposta.status !== 'fulfilled') continue
    for (const item of resposta.value) {
      const chave = chaveEquivalencia(item)
      if (!unicos.has(chave)) unicos.set(chave, item)
    }
  }
  return [...unicos.values()]
    .sort((a, b) => Number(ehGenerico(a)) - Number(ehGenerico(b)))
    .slice(0, 60)
})

async function buscarCatalogo(base: string, query: string): Promise<ApresentacaoMedicamento[]> {
  const url = `${base}/api/catalog_system/pub/products/search?ft=${encodeURIComponent(query)}&_from=0&_to=49`
  const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10_000) })
  if (!res.ok) return []
  const produtos = await res.json()
  if (!Array.isArray(produtos)) return []
  return produtos.flatMap((produto: any) => (produto.items || []).flatMap((item: any) => {
    const ean = String(item?.ean || item?.EAN || '')
    if (!/^\d{8,14}$/.test(ean)) return []
    const nome = String(produto.productName || '').trim()
    const quantidadeMatch = nome.match(/(?:com\s+)?(\d+)\s*(cápsulas?|comprimidos?|ml|sachês?)/i)
    const quantidade = Number(quantidadeMatch?.[1] || 1)
    const unidade = unidadeDaApresentacao(quantidadeMatch?.[2] || '')
    return [{
      ean,
      nome,
      principiosAtivos: String(produto['Princípio Ativo']?.[0] || query),
      dosagem: String(produto.Dosagem?.[0] || extrairDosagem(nome)),
      marca: String(produto.brand || ''),
      fabricante: String(produto.Fabricante?.[0] || produto.brand || ''),
      formaFarmaceutica: unidade,
      quantidade,
      unidade,
      registroMs: produto['Registro MS']?.[0],
      url: produto.link ? new URL(produto.link, base).toString() : undefined,
    } satisfies ApresentacaoMedicamento]
  }))
}

function unidadeDaApresentacao(texto: string): UnidadeDose {
  const value = texto.toLowerCase()
  if (value.startsWith('cáps')) return 'cápsula'
  if (value.startsWith('comprim')) return 'comprimido'
  if (value === 'ml') return 'ml'
  if (value.startsWith('sach')) return 'sachê'
  return 'unidade'
}

function extrairDosagem(nome: string) {
  return nome.match(/\d+(?:[,.]\d+)?\s*(?:mg|mcg|g|ml)(?:\s*\+\s*\d+(?:[,.]\d+)?\s*(?:mg|mcg|g|ml))?/gi)?.join(' + ') || ''
}

function ehGenerico(item: ApresentacaoMedicamento) {
  return /gen[eé]rico|\bgn\b/i.test(item.nome)
}

function chaveEquivalencia(item: ApresentacaoMedicamento) {
  const principio = item.principiosAtivos.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  const dose = item.dosagem.toLowerCase().replace(/\s+/g, '')
  return `${principio}|${dose}|${item.quantidade}|${item.unidade}`
}
