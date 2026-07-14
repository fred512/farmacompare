/**
 * useFarmacias
 * Busca farmácias próximas e gerencia seleção.
 */

import type { Farmacia } from '~/types'

const REDES_MAIS_CONSULTADAS = [
  'pague menos',
  'drogasil',
  'droga raia',
  'drogaria pacheco',
  'panvel',
  'ultrafarma',
]

function nomeNormalizado(nome: string) {
  return nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

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

  const farmaciasMaisConsultadas = computed(() =>
    farmacias.value.filter((farmacia) => {
      const nome = nomeNormalizado(farmacia.nome)
      return REDES_MAIS_CONSULTADAS.some(rede => nome.includes(rede))
    })
  )

  const todasSelecionadas = computed(() =>
    farmacias.value.length > 0 && selecionadas.value.size === farmacias.value.length
  )

  function selecionarTodas() {
    selecionadas.value = new Set(farmacias.value.map(f => f.id))
  }

  function desmarcarTodas() {
    selecionadas.value = new Set()
  }

  function selecionarMaisConsultadas() {
    selecionadas.value = new Set(farmaciasMaisConsultadas.value.map(f => f.id))
  }

  return {
    farmacias,
    selecionadas,
    farmaciasAtivas,
    farmaciasMaisConsultadas,
    nomesAtivos,
    todasSelecionadas,
    carregando,
    erro,
    raio,
    buscarProximas,
    toggleFarmacia,
    selecionarTodas,
    desmarcarTodas,
    selecionarMaisConsultadas,
  }
}
