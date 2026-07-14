<script setup lang="ts">
import type { ApresentacaoMedicamento } from '~/types'

defineProps<{ item: ApresentacaoMedicamento; selecionada: boolean }>()
defineEmits<{ selecionar: [item: ApresentacaoMedicamento] }>()
</script>

<template>
  <button class="apresentacao" :class="{ selecionada }" @click="$emit('selecionar', item)">
    <span class="radio" :class="{ active: selecionada }" />
    <span class="dados">
      <strong>{{ item.nome }}</strong>
      <small>{{ item.marca || 'Marca não informada' }} · {{ item.quantidade }} {{ item.unidade }}{{ item.quantidade === 1 ? '' : 's' }}</small>
      <small>EAN {{ item.ean }}</small>
    </span>
  </button>
</template>

<style scoped>
.apresentacao { width:100%; display:flex; gap:9px; text-align:left; padding:10px; border: .5px solid var(--border); border-radius: var(--radius-sm); background:var(--surface2); color:var(--text); cursor:pointer; font-family:var(--font); }
.apresentacao.selecionada { border-color:var(--green); background:var(--green-bg); }
.radio { width:14px; height:14px; margin-top:3px; border:1.5px solid var(--border2); border-radius:50%; flex-shrink:0; }
.radio.active { border:4px solid var(--green); }
.dados { display:flex; flex-direction:column; gap:2px; min-width:0; }
strong { font-size:12px; font-weight:500; } small { font-size:10px; color:var(--text3); }
</style>
