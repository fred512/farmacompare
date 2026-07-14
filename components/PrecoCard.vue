<script setup lang="ts">
import type { ResultadoPreco } from '~/types'

const props = defineProps<{
  item: ResultadoPreco
  isBest: boolean
  diff: number
  distancia?: string
  index: number
}>()

const BRAND: Record<string, [string, string, string]> = {
  'droga raia':        ['DR', '#fff0f2', '#c41230'],
  'drogasil':          ['DS', '#ebf4ff', '#005ca9'],
  'ultrafarma':        ['UF', '#fff3ec', '#e8600c'],
  'panvel':            ['PV', '#ebfff3', '#006633'],
  'pague menos':       ['PM', '#fff8e1', '#d4880a'],
  'pacheco':           ['PC', '#e8f0ff', '#2b4aad'],
  'extrafarma':        ['EF', '#f0f4ff', '#3b5bdb'],
  'nissei':            ['NS', '#fce4ec', '#c2185b'],
  'são paulo':         ['SP', '#e8f5e9', '#2e7d32'],
  'drogão':            ['DG', '#ffe8e8', '#a00020'],
}

const brandStyle = computed((): [string, string, string] => {
  const l = props.item.farmacia.toLowerCase()
  for (const [k, v] of Object.entries(BRAND)) {
    if (l.includes(k)) return v
  }
  const h = [...props.item.farmacia].reduce((a, c) => a + c.charCodeAt(0), 0) % 360
  return [
    props.item.farmacia.slice(0, 2).toUpperCase(),
    `hsl(${h},55%,93%)`,
    `hsl(${h},45%,35%)`,
  ]
})
</script>

<template>
  <div
    class="preco-card"
    :class="{ best: isBest }"
    :style="{ animationDelay: `${index * 50}ms` }"
  >
    <div
      class="badge"
      :style="{ background: brandStyle[1], color: brandStyle[2] }"
    >
      {{ brandStyle[0] }}
    </div>

    <div class="info">
      <div class="marca">{{ item.marca }}</div>
      <div class="sub">{{ item.farmacia }} · {{ item.tipo }}</div>
      <div v-if="distancia" class="dist">📍 {{ distancia }} de você</div>
    </div>

    <div class="preco-col">
      <div class="preco" :class="{ green: isBest }">
        R$ {{ item.preco!.toFixed(2) }}
      </div>
      <div v-if="item.precoUnitario !== null && item.precoUnitario !== undefined && item.unidade" class="unitario">
        R$ {{ item.precoUnitario.toFixed(2) }}/{{ item.unidade }}
      </div>
      <div class="tags-row">
        <div v-if="isBest" class="tag tag-best">menor preço</div>
        <div v-else-if="diff > 0.5" class="tag tag-diff">+R$ {{ diff.toFixed(2) }}</div>
        <a v-if="item.url" :href="item.url" target="_blank" rel="noopener" class="tag tag-link">ver site ↗</a>
      </div>
    </div>
  </div>
</template>

<style scoped>
.preco-card {
  background: var(--surface);
  border: 0.5px solid var(--border);
  border-radius: var(--radius);
  padding: .85rem 1.1rem;
  display: flex;
  align-items: center;
  gap: 12px;
  transition: border-color 0.15s;
  animation: fadeUp 0.25s ease both;
}
.preco-card:hover { border-color: var(--border2); }
.preco-card.best { border: 1px solid var(--green); }

@keyframes fadeUp {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}

.badge {
  width: 38px; height: 38px;
  border-radius: 9px;
  display: flex; align-items: center; justify-content: center;
  font-size: 10px; font-weight: 600;
  flex-shrink: 0;
  letter-spacing: 0.02em;
}

.info { flex: 1; min-width: 0; }
.marca { font-size: 13px; font-weight: 500; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sub   { font-size: 11px; color: var(--text3); margin-top: 1px; }
.dist  { font-size: 11px; color: var(--text2); margin-top: 2px; }

.preco-col { text-align: right; flex-shrink: 0; }
.preco { font-size: 19px; font-weight: 600; font-family: var(--mono); color: var(--text); letter-spacing: -0.5px; }
.preco.green { color: var(--green); }
.unitario { font-size:10px; color:var(--text3); font-family:var(--mono); margin-top:2px; }

.tag {
  display: inline-block;
  font-size: 10px; font-weight: 500;
  padding: 2px 7px; border-radius: 8px;
  margin-top: 3px;
}
.tags-row { display: flex; gap: 4px; flex-wrap: wrap; justify-content: flex-end; margin-top: 3px; }
.tag-best { background: var(--green-bg); color: var(--green); }
.tag-diff { background: var(--amber-bg); color: var(--amber); font-family: var(--mono); }
.tag-link { background: var(--surface2); color: var(--text2); text-decoration: none; }
.tag-link:hover { color: var(--green); }
</style>
