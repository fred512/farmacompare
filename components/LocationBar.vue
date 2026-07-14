<script setup lang="ts">
import type { GeoStatus } from '~/types'

const props = defineProps<{
  status: GeoStatus
  endereco: string
  erro: string
}>()

const emit = defineEmits<{ ativar: [] }>()

const label = computed(() => {
  switch (props.status) {
    case 'idle':    return 'Toque para permitir localização'
    case 'loading': return 'Obtendo localização…'
    case 'success': return props.endereco || 'Localização obtida'
    case 'denied':  return 'Permissão negada — verifique as configurações'
    case 'error':   return props.erro || 'Erro ao obter localização'
  }
})

const clickable = computed(() => ['idle', 'error'].includes(props.status))
</script>

<template>
  <div
    class="location-bar"
    :class="{ clickable, success: status === 'success' }"
    @click="clickable ? emit('ativar') : undefined"
  >
    <svg viewBox="0 0 24 24" class="pin-icon">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
    </svg>

    <span class="loc-label">{{ label }}</span>

    <span v-if="status === 'loading'" class="spinner-sm" />
    <span v-else-if="status === 'success'" class="ok-badge">✓</span>
    <span v-else-if="clickable" class="cta">Ativar →</span>
  </div>
</template>

<style scoped>
.location-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  background: var(--surface2);
  border-radius: var(--radius-sm);
  border: 0.5px solid var(--border);
  transition: border-color 0.15s;
}
.location-bar.clickable { cursor: pointer; }
.location-bar.clickable:hover { border-color: var(--border2); }
.location-bar.success { border-color: var(--green-light); }

.pin-icon {
  width: 14px; height: 14px;
  fill: var(--text3);
  flex-shrink: 0;
}
.success .pin-icon { fill: var(--green); }

.loc-label {
  flex: 1;
  font-size: 13px;
  color: var(--text2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cta { font-size: 11px; color: var(--green); font-weight: 500; white-space: nowrap; }
.ok-badge { font-size: 12px; color: var(--green); font-weight: 600; }

.spinner-sm {
  display: inline-block;
  width: 14px; height: 14px;
  border: 1.5px solid var(--border2);
  border-top-color: var(--green);
  border-radius: 50%;
  animation: spin .65s linear infinite;
  flex-shrink: 0;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
