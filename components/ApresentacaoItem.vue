<script setup lang="ts">
import type { ApresentacaoMedicamento } from '~/types'

const props = defineProps<{ item: ApresentacaoMedicamento; selecionada: boolean }>()
defineEmits<{ selecionar: [item: ApresentacaoMedicamento] }>()

const generico = computed(() => /gen[eé]rico|\bgn\b/i.test(props.item.nome))
</script>

<template>
  <button class="apresentacao" :class="{ selecionada }" @click="$emit('selecionar', item)">
    <span class="radio" :class="{ active: selecionada }" />
    <span class="dados">
      <span class="name-row">
        <strong>{{ item.nome }}</strong>
        <span class="kind" :class="{ branded: !generico }">{{ generico ? 'genérico' : 'nome comercial' }}</span>
      </span>
      <small>{{ generico ? (item.fabricante || item.marca || 'Fabricante não informado') : `Marca ${item.marca}` }} · {{ item.quantidade }} {{ item.unidade }}{{ item.quantidade === 1 ? '' : 's' }}</small>
      <small class="active-ingredient">Princípio ativo: {{ item.principiosAtivos }}</small>
      <small v-if="item.ean">EAN de referência {{ item.ean }}</small>
      <small class="equivalent">Compara equivalentes de outros fabricantes</small>
    </span>
  </button>
</template>

<style scoped>
.apresentacao { width:100%; display:flex; gap:9px; text-align:left; padding:10px; border: .5px solid var(--border); border-radius: var(--radius-sm); background:var(--surface2); color:var(--text); cursor:pointer; font-family:var(--font); }
.apresentacao.selecionada { border-color:var(--green); background:var(--green-bg); }
.radio { width:14px; height:14px; margin-top:3px; border:1.5px solid var(--border2); border-radius:50%; flex-shrink:0; }
.radio.active { border:4px solid var(--green); }
.dados { display:flex; flex-direction:column; gap:2px; min-width:0; }
.name-row { display:flex; align-items:flex-start; gap:6px; flex-wrap:wrap; }
.kind { padding:1px 5px; border-radius:8px; background:var(--surface); color:var(--text3); font-size:8px; line-height:1.5; text-transform:uppercase; letter-spacing:.04em; }
.kind.branded { background:var(--green-bg); color:var(--green); }
strong { font-size:12px; font-weight:500; } small { font-size:10px; color:var(--text3); }
.equivalent { color: var(--green); }
.active-ingredient { color: var(--text2); }
</style>
