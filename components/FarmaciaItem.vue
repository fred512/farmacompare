<script setup lang="ts">
import type { Farmacia } from '~/types'

const props = defineProps<{
  farmacia: Farmacia
  selecionada: boolean
}>()

defineEmits<{ toggle: [id: string] }>()

function fmtDist(m: number) {
  return m < 1000 ? `${m}m` : `${(m / 1000).toFixed(1)}km`
}

// Estilos por rede
const BRAND: Record<string, [string, string, string]> = {
  'droga raia':        ['DR', '#fff0f2', '#c41230'],
  'drogasil':          ['DS', '#ebf4ff', '#005ca9'],
  'ultrafarma':        ['UF', '#fff3ec', '#e8600c'],
  'panvel':            ['PV', '#ebfff3', '#006633'],
  'pague menos':       ['PM', '#fff8e1', '#d4880a'],
  'extrafarma':        ['EF', '#f0f4ff', '#3b5bdb'],
  'nissei':            ['NS', '#fce4ec', '#c2185b'],
  'são paulo':         ['SP', '#e8f5e9', '#2e7d32'],
  'drogão':            ['DG', '#ffe8e8', '#a00020'],
  'farmácia popular':  ['FP', '#f3e5f5', '#6a1b9a'],
}

const brandStyle = computed(() => {
  const l = props.farmacia.nome.toLowerCase()
  for (const [k, v] of Object.entries(BRAND)) {
    if (l.includes(k)) return v
  }
  const h = [...props.farmacia.nome].reduce((a, c) => a + c.charCodeAt(0), 0) % 360
  return [
    props.farmacia.nome.slice(0, 2).toUpperCase(),
    `hsl(${h},55%,93%)`,
    `hsl(${h},45%,35%)`,
  ] as [string, string, string]
})
</script>

<template>
  <div
    class="farm-item"
    :class="{ sel: selecionada }"
    @click="$emit('toggle', farmacia.id)"
  >
    <div class="checkbox" :class="{ checked: selecionada }">
      <svg v-if="selecionada" viewBox="0 0 12 12"><polyline points="2,6 5,9 10,3" stroke="white" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </div>

    <div
      class="badge"
      :style="{ background: brandStyle[1], color: brandStyle[2] }"
    >
      {{ brandStyle[0] }}
    </div>

    <div class="info">
      <div class="nome">{{ farmacia.nome }}</div>
      <div class="endereco">{{ farmacia.endereco }}</div>
    </div>

    <div class="right">
      <div class="dist">{{ fmtDist(farmacia.distancia_m) }}</div>
      <div v-if="farmacia.aberta === false" class="fechada">Fechada</div>
    </div>
  </div>
</template>

<style scoped>
.farm-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: var(--surface2);
  border-radius: var(--radius-sm);
  border: 0.5px solid var(--border);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.farm-item:hover { border-color: var(--border2); }
.farm-item.sel { border-color: var(--green); background: var(--green-bg); }

.checkbox {
  width: 15px; height: 15px;
  border-radius: 4px;
  border: 1.5px solid var(--border2);
  flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.12s;
}
.checkbox.checked { background: var(--green); border-color: var(--green); }
.checkbox svg { width: 10px; height: 10px; }

.badge {
  width: 30px; height: 30px;
  border-radius: 7px;
  display: flex; align-items: center; justify-content: center;
  font-size: 9px; font-weight: 600;
  flex-shrink: 0;
  letter-spacing: 0.03em;
}

.info { flex: 1; min-width: 0; }
.nome { font-size: 12px; font-weight: 500; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.endereco { font-size: 10px; color: var(--text3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.right { text-align: right; flex-shrink: 0; }
.dist { font-size: 11px; color: var(--text2); font-family: var(--mono); }
.fechada { font-size: 10px; color: var(--red); margin-top: 1px; }
</style>
