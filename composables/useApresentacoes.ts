import type { ApresentacaoMedicamento } from '~/types'

export function useApresentacoes() {
  const apresentacoes = ref<ApresentacaoMedicamento[]>([])
  const selecionada = ref<ApresentacaoMedicamento | null>(null)
  const carregando = ref(false)
  const erro = ref('')

  async function buscar(query: string) {
    carregando.value = true
    erro.value = ''
    selecionada.value = null
    apresentacoes.value = []
    try {
      apresentacoes.value = await $fetch<ApresentacaoMedicamento[]>('/api/apresentacoes', {
        method: 'POST', body: { query },
      })
      if (!apresentacoes.value.length) erro.value = 'Nenhuma apresentação com EAN confirmado foi encontrada.'
    } catch (e: any) {
      erro.value = e?.data?.statusMessage || 'Não foi possível buscar apresentações.'
    } finally {
      carregando.value = false
    }
  }

  return { apresentacoes, selecionada, carregando, erro, buscar }
}
