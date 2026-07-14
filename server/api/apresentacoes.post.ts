import type { ApresentacaoMedicamento, BuscaApresentacoesPayload, UnidadeDose } from '~/types'

const CATALOGOS = ['https://www.paguemenos.com.br']

export default defineEventHandler(async (event) => {
  const { query } = await readBody<BuscaApresentacoesPayload>(event)
  if (!query?.trim()) throw createError({ statusCode: 400, statusMessage: 'Informe o medicamento.' })

  const queryNormalizada = query.trim().replace(/[+&,/]+/g, ' ').replace(/\s+/g, ' ')
  const respostas = await Promise.allSettled(CATALOGOS.map(base => buscarCatalogo(base, queryNormalizada)))
  const unicos = new Map<string, ApresentacaoMedicamento>()
  for (const resposta of respostas) {
    if (resposta.status !== 'fulfilled') continue
    for (const item of resposta.value) unicos.set(item.ean, item)
  }
  return [...unicos.values()].slice(0, 12)
})

async function buscarCatalogo(base: string, query: string): Promise<ApresentacaoMedicamento[]> {
  const url = `${base}/api/catalog_system/pub/products/search?ft=${encodeURIComponent(query)}&_from=0&_to=19`
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
