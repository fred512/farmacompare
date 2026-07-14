<script setup lang="ts">
const config = useRuntimeConfig()
const geo = useGeolocation()
const {
  farmacias, selecionadas, farmaciasAtivas, farmaciasMaisConsultadas, nomesAtivos,
  todasSelecionadas, carregando: farmCarregando, erro: farmErro, raio,
  buscarProximas, toggleFarmacia, selecionarTodas, desmarcarTodas, selecionarMaisConsultadas,
} = useFarmacias()
const { resultado, carregando: precoCarregando, erro, disponiveis, indisponiveis, melhorPreco, economia, sortAsc, historico, buscar } = usePrecos()
const {
  apresentacoes: opcoesApresentacao,
  selecionada: apresentacaoSelecionada,
  carregando: apresentacaoCarregando,
  erro: apresentacaoErro,
  buscar: buscarApresentacoes,
} = useApresentacoes()

const searchQuery = ref('')
const cep = ref('')
const inputRef = ref<HTMLInputElement>()
const mostrarTodasFarmacias = ref(false)
const tema = ref<'light' | 'dark'>('light')

function aplicarTema(value: 'light' | 'dark') {
  tema.value = value
  document.documentElement.dataset.theme = value
  localStorage.setItem('fc_tema', value)
}

function alternarTema() {
  aplicarTema(tema.value === 'dark' ? 'light' : 'dark')
}

onMounted(() => {
  const salvo = localStorage.getItem('fc_tema')
  const preferido = salvo === 'light' || salvo === 'dark'
    ? salvo
    : window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  aplicarTema(preferido)
})

const farmaciasVisiveis = computed(() =>
  mostrarTodasFarmacias.value || !farmaciasMaisConsultadas.value.length
    ? farmacias.value
    : farmaciasMaisConsultadas.value
)
const resultsRef = ref<HTMLElement>()

// Raio options — padrão 3km
const raioOpcoes = [
  { label: '500m', val: 500 },
  { label: '1 km', val: 1000 },
  { label: '3 km', val: 3000 },
  { label: '5 km', val: 5000 },
]

// Quando localização fica disponível, busca farmácias
watch(() => geo.coords.value, async (coords) => {
  if (coords) await buscarProximas(coords.lat, coords.lng)
})

// Ao mudar raio, rebusca
watch(raio, async () => {
  if (geo.coords.value) await buscarProximas(geo.coords.value.lat, geo.coords.value.lng)
})

async function handleBuscar() {
  if (!searchQuery.value.trim()) return
  await buscarApresentacoes(searchQuery.value, farmaciasAtivas.value)
}

async function compararSelecionada() {
  if (!apresentacaoSelecionada.value || !nomesAtivos.value.length) return
  await buscar(searchQuery.value, farmaciasAtivas.value, apresentacaoSelecionada.value, cep.value)
  await nextTick()
  resultsRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

async function aplicarCep() {
  if (cep.value.replace(/\D/g, '').length !== 8) return
  await geo.buscarCep(cep.value)
}

async function reiniciarPesquisa() {
  inputRef.value?.focus()
  searchQuery.value = ''
  resultado.value = null
  erro.value = ''
  opcoesApresentacao.value = []
  apresentacaoSelecionada.value = null
  apresentacaoErro.value = ''
  sortAsc.value = true
  await nextTick()
  inputRef.value?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  requestAnimationFrame(() => inputRef.value?.focus({ preventScroll: true }))
}

const comparacaoSemPreco = computed(() => Boolean(resultado.value && !disponiveis.value.length && indisponiveis.value.length))

watch(() => geo.cepSugerido.value, (value) => {
  if (value && !cep.value) cep.value = value
})

function distanciaFarmacia(nomeFarmacia: string): string {
  const f = farmacias.value.find(f =>
    f.nome.toLowerCase().includes(nomeFarmacia.toLowerCase()) ||
    nomeFarmacia.toLowerCase().includes(f.nome.toLowerCase())
  )
  if (!f) return ''
  return f.distancia_m < 1000 ? `${f.distancia_m}m` : `${(f.distancia_m / 1000).toFixed(1)}km`
}

// Loading steps animados
const loadingSteps = computed(() => {
  const farms = nomesAtivos.value.slice(0, 4)
  return [...farms.map(f => `Consultando ${f}…`), 'Comparando preços…']
})

const loadingStep = ref(0)
let loadingInterval: ReturnType<typeof setInterval>

const presentationProgress = ref(0)
const presentationSeconds = ref(0)
let presentationInterval: ReturnType<typeof setInterval> | undefined

const presentationStatus = computed(() => {
  if (presentationSeconds.value < 3) return 'Conectando ao catálogo…'
  if (presentationSeconds.value < 8) return 'Procurando apresentações e EANs…'
  return 'O catálogo ainda está respondendo…'
})

watch(apresentacaoCarregando, (loading) => {
  if (presentationInterval) clearInterval(presentationInterval)
  if (!loading) {
    presentationProgress.value = 100
    return
  }

  const startedAt = Date.now()
  presentationProgress.value = 6
  presentationSeconds.value = 0
  presentationInterval = setInterval(() => {
    const elapsed = (Date.now() - startedAt) / 1000
    presentationSeconds.value = Math.floor(elapsed)
    presentationProgress.value = Math.min(92, Math.round(8 + 84 * (1 - Math.exp(-elapsed / 5))))
  }, 250)
})

watch(precoCarregando, (val) => {
  if (val) {
    loadingStep.value = 0
    loadingInterval = setInterval(() => {
      loadingStep.value = (loadingStep.value + 1) % loadingSteps.value.length
    }, 700)
  } else {
    clearInterval(loadingInterval)
  }
})

onUnmounted(() => {
  clearInterval(loadingInterval)
  if (presentationInterval) clearInterval(presentationInterval)
})

useSeoMeta({
  title: 'FarmaCompare — Menor preço de remédios perto de você',
  description: 'Compare preços de medicamentos nas farmácias mais próximas de você em tempo real.',
})
</script>

<template>
  <div>
    <header>
      <div class="logo-mark">
        <svg viewBox="0 0 24 24">
          <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c.55 0 1 .45 1 1v3h3c.55 0 1 .45 1 1s-.45 1-1 1h-3v3c0 .55-.45 1-1 1s-1-.45-1-1v-3H8c-.55 0-1-.45-1-1s.45-1 1-1h3V7c0-.55.45-1 1-1z"/>
        </svg>
      </div>
      <span class="logo-name">Farma<span>Compare</span></span>
      <button
        type="button"
        class="theme-toggle"
        :aria-label="tema === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'"
        :title="tema === 'dark' ? 'Modo claro' : 'Modo escuro'"
        @click="alternarTema"
      >
        <svg v-if="tema === 'dark'" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4V2m0 20v-2m8-8h2M2 12h2m13.66-5.66 1.42-1.42M4.92 19.08l1.42-1.42m11.32 0 1.42 1.42M4.92 4.92l1.42 1.42M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z"/></svg>
        <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 15.2A9 9 0 0 1 8.8 3.2 9 9 0 1 0 20.8 15.2Z"/></svg>
        <span>{{ tema === 'dark' ? 'Claro' : 'Escuro' }}</span>
      </button>
    </header>

    <main>
      <!-- Localização -->
      <div class="card">
        <div class="label">Localização</div>

        <LocationBar
          :status="geo.status.value"
          :endereco="geo.enderecoLegivel.value"
          :erro="geo.erro.value"
          @ativar="geo.pedir()"
        />

        <div v-if="geo.status.value === 'success' || (geo.status.value === 'error' && cep)" class="cep-row">
          <span>Usar outro CEP</span>
          <input v-model="cep" inputmode="numeric" maxlength="9" placeholder="00000-000" @keyup.enter="aplicarCep">
          <button type="button" :disabled="cep.replace(/\D/g, '').length !== 8" @click="aplicarCep">Atualizar local</button>
        </div>

        <!-- Raio -->
        <div v-if="geo.status.value === 'success'" class="raio-wrap">
          <div class="label">Raio de busca</div>
          <div class="raio-row">
            <button
              v-for="op in raioOpcoes"
              :key="op.val"
              class="raio-btn"
              :class="{ active: raio === op.val }"
              @click="raio = op.val"
            >
              {{ op.label }}
            </button>
          </div>
        </div>

        <!-- Farmácias próximas -->
        <div v-if="geo.status.value === 'success'" class="near-section">
          <div class="label">
            <span v-if="farmCarregando" class="spinner-sm" />
            Farmácias próximas
            <span v-if="farmacias.length" class="count">{{ farmacias.length }} encontradas</span>
          </div>

          <div v-if="farmCarregando" class="near-loading">
            Buscando farmácias no raio de {{ raio >= 1000 ? (raio / 1000).toFixed(0) + ' km' : raio + 'm' }}…
          </div>

          <div v-if="!farmCarregando && farmErro" class="near-error">{{ farmErro }} Mantivemos os últimos resultados encontrados.</div>

          <div v-if="!farmCarregando && farmacias.length" class="selection-tools">
            <div class="selection-summary">
              <span><strong>{{ selecionadas.size }}</strong> de {{ farmacias.length }} selecionadas</span>
              <span v-if="!selecionadas.size" class="selection-warning">Escolha ao menos uma</span>
            </div>
            <div class="selection-actions" aria-label="Seleção rápida de farmácias">
              <button
                type="button"
                class="selection-btn popular"
                :disabled="!farmaciasMaisConsultadas.length"
                @click="selecionarMaisConsultadas"
              >
                ★ Favoritas
              </button>
              <button type="button" class="selection-btn" :class="{ active: todasSelecionadas }" @click="selecionarTodas">Todas</button>
              <button type="button" class="selection-btn" :class="{ active: !selecionadas.size }" @click="desmarcarTodas">Nenhuma</button>
              <button
                v-if="farmaciasMaisConsultadas.length && farmacias.length > farmaciasMaisConsultadas.length"
                type="button"
                class="expand-pharmacies"
                :aria-expanded="mostrarTodasFarmacias"
                @click="mostrarTodasFarmacias = !mostrarTodasFarmacias"
              >
                {{ mostrarTodasFarmacias ? 'Mostrar só favoritas' : `Ver todas (${farmacias.length})` }}
                <span :class="{ rotated: mostrarTodasFarmacias }">⌄</span>
              </button>
            </div>
          </div>

          <div v-if="!farmCarregando && farmacias.length" class="near-list-shell">
            <div class="near-list" tabindex="0" aria-label="Lista rolável de farmácias">
              <FarmaciaItem
                v-for="f in farmaciasVisiveis"
                :key="f.id"
                :farmacia="f"
                :selecionada="selecionadas.has(f.id)"
                @toggle="toggleFarmacia"
              />
            </div>
          </div>

          <div v-else-if="!farmCarregando" class="near-empty">
            Nenhuma farmácia encontrada neste raio. Tente aumentar o raio.
          </div>
        </div>
      </div>

      <!-- Busca -->
      <div class="card">
        <div class="label">Remédio</div>
        <div class="search-row">
          <input
            ref="inputRef"
            v-model="searchQuery"
            class="search-input"
            type="text"
            placeholder="ex: paracetamol 750mg, omeprazol 20mg…"
            autocomplete="off"
            @keydown.enter="handleBuscar"
          />
          <button
            class="btn-primary"
            :disabled="precoCarregando || apresentacaoCarregando || !searchQuery.trim()"
            @click="handleBuscar"
          >
            Comparar
          </button>
        </div>
      </div>

      <div v-if="apresentacaoCarregando || opcoesApresentacao.length || apresentacaoErro" class="card">
        <div class="label">Escolha a apresentação exata</div>
        <div v-if="apresentacaoCarregando" class="presentation-loading" aria-live="polite">
          <div class="progress-meta">
            <span>{{ presentationStatus }}</span>
            <span class="progress-time">{{ presentationSeconds }}s · {{ presentationProgress }}%</span>
          </div>
          <div
            class="progress-track"
            role="progressbar"
            aria-label="Progresso da busca de apresentações"
            :aria-valuenow="presentationProgress"
            aria-valuemin="0"
            aria-valuemax="100"
          >
            <div class="progress-fill" :style="{ width: `${presentationProgress}%` }">
              <span class="progress-glint" />
            </div>
          </div>
          <div class="progress-hint">A busca pode levar alguns segundos dependendo da farmácia.</div>
        </div>
        <div v-else-if="apresentacaoErro" class="error-note">{{ apresentacaoErro }}</div>
        <template v-else>
          <div class="apresentacoes-list">
            <ApresentacaoItem
              v-for="item in opcoesApresentacao"
              :key="item.ean"
              :item="item"
              :selecionada="apresentacaoSelecionada?.ean === item.ean"
              @selecionar="apresentacaoSelecionada = $event"
            />
          </div>
          <button class="btn-primary compare-selected" :disabled="!apresentacaoSelecionada || !nomesAtivos.length || precoCarregando" @click="compararSelecionada">
            Comparar esta apresentação
          </button>
        </template>
      </div>

      <!-- Loading -->
      <div v-if="precoCarregando" class="loading">
        <div class="spinner" />
        <div class="loading-step">{{ loadingSteps[loadingStep] }}</div>
      </div>

      <!-- Erro -->
      <div v-else-if="erro" class="error-note">{{ erro }}</div>

      <!-- Resultados -->
      <div v-else-if="resultado" ref="resultsRef" class="results-section">
        <div v-if="comparacaoSemPreco" class="comparison-complete" role="status">
          <div class="complete-icon">!</div>
          <div>
            <strong>Comparação concluída, mas nenhum preço foi confirmado</strong>
            <p>As farmácias encontradas neste raio não possuem integração de preço disponível. Você pode consultar cada loja abaixo.</p>
          </div>
        </div>
        <!-- Dica de economia -->
        <div v-if="economia > 0.5" class="save-card">
          <span class="save-icon">💡</span>
          <div class="save-text">
            Comprando na <strong>{{ melhorPreco?.farmacia }}</strong> você economiza
            <strong>R$ {{ economia.toFixed(2) }}</strong> em relação à mais cara.
          </div>
        </div>

        <!-- Header dos resultados -->
        <div class="results-meta">
          <span class="results-query">
            Resultados para <strong>{{ resultado.produto_normalizado }}</strong>
          </span>
          <button class="sort-btn" @click="sortAsc = !sortAsc">
            ↕ {{ sortAsc ? 'menor preço' : 'maior preço' }}
          </button>
        </div>

        <div class="fonte-row">
          <span class="fonte-real">✓ apenas preços confirmados nos sites</span>
          <span v-if="resultado.apresentacao" class="apresentacao">{{ resultado.apresentacao }}</span>
        </div>

        <!-- Cards de preço -->
        <div class="result-list">
          <PrecoCard
            v-for="(item, i) in disponiveis"
            :key="item.farmaciaId || `${item.farmacia}-${i}`"
            :item="item"
            :is-best="i === 0"
            :diff="item.preco! - (melhorPreco?.preco ?? 0)"
            :distancia="distanciaFarmacia(item.farmacia)"
            :index="i"
          />
        </div>

        <!-- Sem estoque -->
        <div v-if="indisponiveis.length" class="unavail">
          <strong>Preço não confirmado oficialmente</strong>
          <p>Consulte o valor atualizado diretamente no site da farmácia.</p>
          <div v-for="(item, i) in indisponiveis" :key="item.farmaciaId || `${item.farmacia}-${i}`" class="unavail-item">
            <span>{{ item.farmacia }}</span>
            <a v-if="item.url" :href="item.url" target="_blank" rel="noopener">Pesquisar no site ↗</a>
          </div>
        </div>

        <div class="restart-wrap">
          <span>Terminou esta comparação?</span>
          <button type="button" class="restart-button" @click="reiniciarPesquisa">
            <span aria-hidden="true">↻</span>
            Pesquisar outro medicamento
          </button>
        </div>
      </div>

      <!-- Histórico -->
      <div v-if="historico.length && !resultado && !precoCarregando" class="history">
        <div class="label">Recentes</div>
        <div class="history-chips">
          <button
            v-for="h in historico"
            :key="h"
            class="hchip"
            @click="searchQuery = h; handleBuscar()"
          >
            ↩ {{ h }}
          </button>
        </div>
      </div>
    </main>
    <span class="version-label" aria-label="Versão do aplicativo">v{{ config.public.appVersion }}</span>
  </div>
</template>

<style scoped>
header {
  background: var(--surface);
  border-bottom: 0.5px solid var(--border2);
  padding: 0 1.25rem;
  height: 54px;
  display: flex;
  align-items: center;
  gap: 10px;
  position: sticky;
  top: 0;
  z-index: 20;
}

.logo-mark {
  width: 26px; height: 26px;
  background: var(--green);
  border-radius: 7px;
  display: flex; align-items: center; justify-content: center;
}
.logo-mark svg { width: 14px; height: 14px; fill: white; }
.logo-name { font-size: 15px; font-weight: 600; color: var(--text); letter-spacing: -0.3px; }
.logo-name span { color: var(--green); }
.theme-toggle {
  margin-left:auto;
  min-height:34px;
  display:inline-flex;
  align-items:center;
  gap:7px;
  padding:0 11px;
  border:1px solid var(--border2);
  border-radius:999px;
  background:var(--surface2);
  color:var(--text2);
  font:600 11px var(--font);
  cursor:pointer;
  transition:background .15s, border-color .15s, color .15s;
}
.theme-toggle:hover { border-color:var(--green); color:var(--green); }
.theme-toggle svg { width:16px; height:16px; fill:none; stroke:currentColor; stroke-width:1.8; stroke-linecap:round; stroke-linejoin:round; }

main { max-width: 600px; margin: 0 auto; padding: 1.25rem 1rem 5rem; }
.version-label {
  position:fixed;
  right:8px;
  bottom:7px;
  z-index:10;
  padding:2px 6px;
  border:1px solid var(--border);
  border-radius:999px;
  background:color-mix(in srgb, var(--surface) 88%, transparent);
  color:var(--text3);
  font:500 9px var(--mono);
  letter-spacing:.02em;
  opacity:.72;
  pointer-events:none;
  backdrop-filter:blur(5px);
}

.card {
  background: var(--surface);
  border: 0.5px solid var(--border);
  border-radius: var(--radius);
  padding: 1.1rem 1.25rem;
  margin-bottom: .85rem;
}

.label {
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text3);
  margin-bottom: 7px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.label .count { color: var(--green); text-transform: none; font-weight: 400; letter-spacing: 0; }

.raio-wrap { margin-top: 12px; }
.raio-row { display: flex; gap: 6px; }
.raio-btn {
  flex: 1;
  padding: 6px 0;
  text-align: center;
  font-size: 12px;
  font-weight: 500;
  border-radius: 20px;
  border: 0.5px solid var(--border2);
  color: var(--text2);
  cursor: pointer;
  background: transparent;
  transition: all 0.15s;
  font-family: var(--font);
}
.raio-btn.active { background: var(--green-bg); border-color: var(--green); color: var(--green); }

.near-section { margin-top: 14px; }
.near-loading { font-size: 12px; color: var(--text3); padding: 4px 0; }
.near-empty { font-size: 12px; color: var(--text3); padding: 4px 0; }
.near-error { font-size: 12px; color: var(--amber); padding: 4px 0 8px; }
.near-list-shell { position:relative; border-radius:var(--radius-sm); overflow:hidden; }
.near-list-shell::after { content:''; position:absolute; right:5px; bottom:0; left:0; height:22px; pointer-events:none; background:linear-gradient(transparent, var(--surface)); }
.near-list { height:210px; display:flex; flex-direction:column; gap:5px; overflow-y:auto; overscroll-behavior:contain; padding-right:5px; padding-bottom:18px; scrollbar-width:thin; scrollbar-color:var(--border2) transparent; }
.near-list:focus { outline:1px solid var(--green); outline-offset:2px; }
.selection-tools {
  margin-bottom: 9px;
  padding: 8px 9px;
  border: 0.5px solid var(--border2);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--surface2) 72%, transparent);
}
.selection-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
  color: var(--text3);
  font-size: 11px;
}
.selection-summary strong { color: var(--green); }
.selection-warning { color: var(--amber); }
.selection-actions { display: flex; flex-wrap: wrap; gap: 6px; }
.selection-btn {
  min-height: 30px;
  padding: 0 11px;
  border: 0.5px solid var(--border2);
  border-radius: 999px;
  background: transparent;
  color: var(--text2);
  font: 600 11px var(--font);
  cursor: pointer;
  transition: border-color .15s, background .15s, color .15s;
}
.selection-btn:hover:not(:disabled), .selection-btn.active {
  border-color: var(--green);
  background: var(--green-dim);
  color: var(--green);
}
.selection-btn.popular { color:var(--green); }
.selection-btn:disabled { opacity: .38; cursor: not-allowed; }
.expand-pharmacies { margin-left:auto; min-height:30px; padding:0 3px 0 8px; border:0; background:transparent; color:var(--green); font:600 10px var(--font); cursor:pointer; }
.expand-pharmacies span { display:inline-block; margin-left:3px; font-size:14px; transition:transform .18s; }
.expand-pharmacies span.rotated { transform:rotate(180deg); }

@media (max-width: 520px) {
  main { padding:.7rem .55rem 4.5rem; }
  .card { padding:.85rem .8rem; border-radius:10px; }
  .near-list { height:184px; }
  .selection-summary { margin-bottom:6px; }
  .selection-btn { min-height:28px; padding:0 9px; font-size:10px; }
  .expand-pharmacies { width:100%; margin-left:0; text-align:left; padding-left:2px; }
  .cep-row { flex-wrap:wrap; gap:6px; }
  .cep-row span { width:100%; }
  .cep-row input { margin-left:0; flex:1; width:auto; }
  .theme-toggle { width:36px; min-height:36px; justify-content:center; padding:0; }
  .theme-toggle span { display:none; }
}

.search-row { display: flex; gap: 8px; }
.search-input {
  flex: 1;
  height: 42px;
  background: var(--surface2);
  border: 0.5px solid var(--border2);
  border-radius: var(--radius-sm);
  color: var(--text);
  font-family: var(--font);
  font-size: 14px;
  padding: 0 13px;
  outline: none;
  transition: border-color 0.15s;
}
.search-input:focus { border-color: var(--green); }
.search-input::placeholder { color: var(--text3); }

.btn-primary {
  height: 42px;
  padding: 0 18px;
  background: var(--green);
  color: white;
  border: none;
  border-radius: var(--radius-sm);
  font-family: var(--font);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.15s;
  white-space: nowrap;
}
.btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }
.btn-primary:not(:disabled):hover { opacity: 0.85; }

.loading {
  display: flex; flex-direction: column;
  align-items: center; padding: 3rem 1rem; gap: 14px;
}
.spinner {
  width: 28px; height: 28px;
  border: 2px solid var(--border2);
  border-top-color: var(--green);
  border-radius: 50%;
  animation: spin .65s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.loading-step { font-size: 13px; color: var(--text2); font-family: var(--mono); }

.spinner-sm {
  display: inline-block;
  width: 11px; height: 11px;
  border: 1.5px solid var(--border2);
  border-top-color: var(--green);
  border-radius: 50%;
  animation: spin .65s linear infinite;
}

.error-note {
  background: var(--red-bg);
  border: 0.5px solid var(--border);
  border-radius: var(--radius);
  padding: .9rem 1.1rem;
  font-size: 13px; color: var(--red);
  margin-bottom: .85rem;
}

.save-card {
  background: var(--green-bg);
  border: 0.5px solid var(--green-light);
  border-radius: var(--radius);
  padding: .9rem 1.1rem;
  display: flex; align-items: center; gap: 10px;
  margin-bottom: .85rem;
}
.save-icon { font-size: 18px; flex-shrink: 0; }
.save-text { font-size: 13px; color: var(--green); line-height: 1.4; }
.save-text strong { font-weight: 600; }

.results-meta { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.results-query { font-size: 13px; color: var(--text2); }
.results-query strong { color: var(--text); font-weight: 500; }
.sort-btn { font-size: 12px; color: var(--green); background: none; border: none; cursor: pointer; font-family: var(--font); padding: 0; }

.fonte-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; }
.fonte-real { font-size: 11px; color: var(--green); font-weight: 500; }
.fonte-ia   { font-size: 11px; color: var(--amber); }
.apresentacao { font-size: 11px; color: var(--text3); font-family: var(--mono); }

.result-list { display: flex; flex-direction: column; gap: 6px; }
.results-section { scroll-margin-top:70px; }
.comparison-complete { display:flex; gap:11px; align-items:flex-start; margin-bottom:12px; padding:12px 14px; border:.5px solid var(--border2); border-left:3px solid var(--amber); border-radius:var(--radius); background:var(--amber-bg); }
.complete-icon { width:22px; height:22px; flex:0 0 22px; display:grid; place-items:center; border-radius:50%; background:var(--amber); color:var(--surface); font:600 12px var(--mono); }
.comparison-complete strong { display:block; color:var(--text); font-size:12px; font-weight:600; }
.comparison-complete p { margin-top:3px; color:var(--text2); font-size:11px; line-height:1.45; }

.unavail {
  font-size: 12px; color: var(--text3);
  padding: .5rem 0;
  border-top: 0.5px solid var(--border);
  margin-top: 6px;
}
.unavail strong { display:block; color:var(--text2); margin-bottom:5px; font-weight:500; }
.unavail > p { margin:0 0 8px; color:var(--muted); font-size:12px; }
.restart-wrap { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-top:18px; padding:14px 0 2px; border-top:.5px solid var(--border2); color:var(--text3); font-size:11px; }
.restart-button { display:inline-flex; align-items:center; gap:7px; min-height:36px; padding:0 14px; border:1px solid var(--green); border-radius:var(--radius-sm); background:transparent; color:var(--green); font:600 11px var(--font); cursor:pointer; transition:background .15s, color .15s; }
.restart-button:hover { background:var(--green); color:var(--surface); }
.restart-button span { font:500 17px var(--mono); }
@media (max-width:520px) { .restart-wrap { align-items:stretch; flex-direction:column; } .restart-button { justify-content:center; } }
.unavail-item { display:flex; justify-content:space-between; gap:8px; padding:3px 0; }
.unavail-item a { color:var(--green); text-decoration:none; }

.history { margin-top: 1.25rem; }
.history-chips { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 6px; }
.hchip {
  padding: 4px 10px;
  background: var(--surface);
  border: 0.5px solid var(--border2);
  border-radius: 12px;
  font-size: 12px; color: var(--text2);
  cursor: pointer; font-family: var(--font);
  transition: color 0.12s;
}
.hchip:hover { color: var(--green); }

.cep-row { display:flex; align-items:center; gap:10px; margin-top:12px; font-size:11px; color:var(--text3); }
.cep-row input { margin-left:auto; width:102px; padding:6px 8px; border: .5px solid var(--border2); border-radius:var(--radius-sm); background:var(--surface2); color:var(--text); font-family:var(--mono); }
.cep-row button { min-height:29px; padding:0 9px; border:1px solid var(--green); border-radius:var(--radius-sm); background:var(--green-bg); color:var(--green); font:600 10px var(--font); cursor:pointer; }
.cep-row button:disabled { opacity:.4; cursor:not-allowed; }
@media (max-width:520px) {
  .cep-row { flex-wrap:wrap; gap:6px; }
  .cep-row span { width:100%; }
  .cep-row input { margin-left:0; flex:1; width:auto; }
}
.apresentacoes-list { display:flex; flex-direction:column; gap:6px; }
.compare-selected { margin-top:12px; width:100%; }
.presentation-loading { padding: 5px 0 2px; }
.progress-meta { display:flex; justify-content:space-between; align-items:center; gap:12px; color:var(--text2); font-size:12px; }
.progress-time { color:var(--green); font-family:var(--mono); font-size:11px; white-space:nowrap; }
.progress-track { height:8px; margin-top:10px; overflow:hidden; border:0.5px solid var(--border2); border-radius:999px; background:var(--surface2); }
.progress-fill { position:relative; height:100%; min-width:6px; overflow:hidden; border-radius:inherit; background:var(--green); transition:width .3s ease-out; }
.progress-glint { position:absolute; inset:0; background:linear-gradient(90deg, transparent 0%, rgba(255,255,255,.55) 50%, transparent 100%); transform:translateX(-100%); animation:progressSweep 1.35s ease-in-out infinite; }
.progress-hint { margin-top:7px; color:var(--text3); font-size:10px; }
@keyframes progressSweep { to { transform:translateX(100%); } }
@media (prefers-reduced-motion: reduce) { .progress-fill { transition:none; } .progress-glint { animation:none; } }
</style>
