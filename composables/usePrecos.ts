/**
 * usePrecos
 * Busca preços de um remédio nas farmácias selecionadas.
 */

import type { ApresentacaoMedicamento, Farmacia, RespostaPrecos, ResultadoPreco } from '~/types'

export function usePrecos() {
  const resultado = ref<RespostaPrecos | null>(null)
  const carregando = ref(false)
  const erro = ref('')
  const query = ref('')
  const sortAsc = ref(true)
  const historico = ref<string[]>([])

  // Carrega histórico do localStorage (client-side only)
  onMounted(() => {
    try {
      historico.value = JSON.parse(localStorage.getItem('fc_historico') || '[]')
    } catch {}
  })

  async function buscar(q: string, lojas: Farmacia[], apresentacao?: ApresentacaoMedicamento, cep?: string) {
    if (!q.trim() || !lojas.length) return

    query.value = q.trim()
    carregando.value = true
    erro.value = ''
    resultado.value = null

    // Salva no histórico
    historico.value = [q, ...historico.value.filter(h => h !== q)].slice(0, 8)
    try { localStorage.setItem('fc_historico', JSON.stringify(historico.value)) } catch {}

    try {
      resultado.value = await $fetch<RespostaPrecos>('/api/precos', {
        method: 'POST',
        body: { query: q.trim(), farmacias: lojas.map(loja => loja.nome), lojas, ean: apresentacao?.ean, apresentacao, cep }
      })
    } catch (e: any) {
      erro.value = e?.data?.statusMessage || 'Erro ao buscar preços. Tente novamente.'
    } finally {
      carregando.value = false
    }
  }

  const disponiveis = computed<ResultadoPreco[]>(() => {
    if (!resultado.value) return []
    const items = resultado.value.resultados.filter(r => r.disponivel && r.preco !== null)
    return [...items].sort((a, b) =>
      sortAsc.value ? (a.preco! - b.preco!) : (b.preco! - a.preco!)
    )
  })

  const indisponiveis = computed<ResultadoPreco[]>(() =>
    resultado.value?.resultados.filter(r => !r.disponivel || r.preco === null) || []
  )

  const melhorPreco = computed<ResultadoPreco | null>(() =>
    disponiveis.value[0] ?? null
  )

  const economia = computed<number>(() => {
    if (disponiveis.value.length < 2) return 0
    const max = Math.max(...disponiveis.value.map(r => r.preco!))
    const min = melhorPreco.value?.preco ?? max
    return Math.round((max - min) * 100) / 100
  })

  return {
    resultado,
    carregando,
    erro,
    query,
    sortAsc,
    historico,
    disponiveis,
    indisponiveis,
    melhorPreco,
    economia,
    buscar,
  }
}
