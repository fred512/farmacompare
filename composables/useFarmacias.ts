/**
 * useFarmacias
 * Busca farmácias próximas e gerencia seleção.
 */

import type { Farmacia } from '~/types'

export function useFarmacias() {
  const farmacias = ref<Farmacia[]>([])
  const selecionadas = ref<Set<string>>(new Set())
  const carregando = ref(false)
  const erro = ref('')

  // Raio padrão: 3km (configurável via nuxt.config)
  const config = useRuntimeConfig()
  const raio = ref<number>(Number(config.public.defaultRadius) || 3000)

  async function buscarProximas(lat: number, lng: number) {
    carregando.value = true
    erro.value = ''
    farmacias.value = []

    try {
      const data = await $fetch<Farmacia[]>('/api/farmacias-proximas', {
        method: 'POST',
        body: { lat, lng, raio: raio.value }
      })
      farmacias.value = data
      // Seleciona todas por padrão
      selecionadas.value = new Set(data.map(f => f.id))
    } catch (e: any) {
      erro.value = e?.data?.statusMessage || 'Erro ao buscar farmácias próximas.'
    } finally {
      carregando.value = false
    }
  }

  function toggleFarmacia(id: string) {
    if (selecionadas.value.has(id)) {
      // Não permite desmarcar a última
      if (selecionadas.value.size <= 1) return
      selecionadas.value.delete(id)
    } else {
      selecionadas.value.add(id)
    }
    // Força reatividade do Set
    selecionadas.value = new Set(selecionadas.value)
  }

  const farmaciasAtivas = computed(() =>
    farmacias.value.filter(f => selecionadas.value.has(f.id))
  )

  const nomesAtivos = computed(() =>
    farmaciasAtivas.value.map(f => f.nome)
  )

  return {
    farmacias,
    selecionadas,
    farmaciasAtivas,
    nomesAtivos,
    carregando,
    erro,
    raio,
    buscarProximas,
    toggleFarmacia,
  }
}
