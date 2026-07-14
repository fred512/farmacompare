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
  const respostasIniciais = await Promise.allSettled(catalogos.map(base => buscarCatalogo(base, queryNormalizada)))
  const itensIniciaisBrutos = respostasIniciais.flatMap(resposta => resposta.status === 'fulfilled' ? resposta.value : [])
  // Só converte um nome comercial (ex.: Diamicron/Galvus) para princípio ativo
  // quando a marca do catálogo realmente coincide com o texto pesquisado. Antes,
  // o primeiro princípio retornado era aplicado a todos os itens e podia trocar
  // anlodipino por hidroclorotiazida em pesquisas pelo próprio princípio ativo.
  const consultaNormalizada = normalizar(queryNormalizada)
  const produtoDaMarca = itensIniciaisBrutos.find(item => {
    const marca = normalizar(item.marca || '')
    return marca.length >= 4
      && (consultaNormalizada === marca || consultaNormalizada.startsWith(`${marca} `))
      && normalizar(item.principiosAtivos) !== consultaNormalizada
  })
  const principioPrincipal = produtoDaMarca?.principiosAtivos
  const principiosIdentificados = principioPrincipal ? [principioPrincipal] : []
  const palavrasDaMarca = normalizar(query).split(' ').filter(parte => /^[a-z]{3,}$/.test(parte) && !['comprimidos', 'capsulas'].includes(parte))
  const itensIniciais = principioPrincipal
    ? itensIniciaisBrutos
        .filter(item => mesmosPrincipios(principioPrincipal, item.principiosAtivos) || (normalizar(item.principiosAtivos) === normalizar(queryNormalizada) && palavrasDaMarca.every(parte => normalizar(item.nome).includes(parte))))
        .map(item => normalizar(item.principiosAtivos) === normalizar(queryNormalizada) ? { ...item, principiosAtivos: principioPrincipal } : item)
    : itensIniciaisBrutos
  const respostasExpandidas = await Promise.allSettled(
    principiosIdentificados.flatMap(principio => catalogos.map(base => buscarCatalogo(base, principio)))
  )
  const itensExpandidos = respostasExpandidas
    .flatMap(resposta => resposta.status === 'fulfilled' ? resposta.value : [])
    .filter(item => principiosIdentificados.some(principio => mesmosPrincipios(principio, item.principiosAtivos)))
  const dosesSolicitadas = extrairDoses(query)
  const unicos = new Map<string, ApresentacaoMedicamento>()
  for (const item of [...itensIniciais, ...itensExpandidos]) {
    if (dosesSolicitadas.length && !mesmasDoses(dosesSolicitadas, extrairDoses(item.nome))) continue
    const chave = chaveEquivalencia(item)
    if (!unicos.has(chave)) unicos.set(chave, item)
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
      principiosAtivos: String(produto.NomeSubstanciaPrincipioAtivo?.[0] || produto['Princípio Ativo']?.[0] || query),
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

function extrairDoses(value: string) {
  return (normalizar(value).match(/\d+(?:[,.]\d+)?\s*(?:mg|mcg|g|ml)/g) || [])
    .map(dose => dose.replace(/\s+/g, '').replace(',', '.'))
    .sort()
}

function mesmasDoses(a: string[], b: string[]) {
  return a.length === b.length && a.every((dose, index) => dose === b[index])
}

function mesmosPrincipios(a: string, b: string) {
  const palavrasIgnoradas = new Set(['cloridrato', 'de', 'do', 'da', 'e'])
  const partes = (value: string) => normalizar(value).split(' ').filter(parte => parte && !palavrasIgnoradas.has(parte)).sort()
  const esquerda = partes(a)
  const direita = partes(b)
  return esquerda.length === direita.length && esquerda.every((parte, index) => parte === direita[index])
}

function normalizar(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}
