/**
 * useGeolocation
 * Composable para obter e rastrear a localização do usuário.
 */

import type { GeoStatus } from '~/types'

export function useGeolocation() {
  const status = ref<GeoStatus>('idle')
  const coords = ref<{ lat: number; lng: number } | null>(null)
  const enderecoLegivel = ref<string>('')
  const cepSugerido = ref<string>('')
  const erro = ref<string>('')

  async function pedir() {
    if (!navigator.geolocation) {
      status.value = 'error'
      erro.value = 'Geolocalização não suportada neste browser.'
      return
    }

    status.value = 'loading'

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        coords.value = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        status.value = 'success'
        await reverseGeocode(coords.value)
      },
      (err) => {
        status.value = err.code === 1 ? 'denied' : 'error'
        erro.value = err.code === 1
          ? 'Permissão de localização negada. Verifique as configurações do browser.'
          : 'Não foi possível obter a localização. Tente novamente.'
      },
      { timeout: 10000, maximumAge: 60000 }
    )
  }

  async function reverseGeocode({ lat, lng }: { lat: number; lng: number }) {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=pt-BR`
      )
      const data = await res.json()
      const a = data.address || {}
      cepSugerido.value = String(a.postcode || '').replace(/\D/g, '').replace(/^(\d{5})(\d{3})$/, '$1-$2')
      const partes = [
        a.road || a.pedestrian || a.footway,
        a.suburb || a.neighbourhood || a.quarter,
        a.city || a.town || a.village,
      ].filter(Boolean)
      enderecoLegivel.value = partes.join(', ') || `${lat.toFixed(4)}, ${lng.toFixed(4)}`
    } catch {
      enderecoLegivel.value = `${lat.toFixed(4)}, ${lng.toFixed(4)}`
    }
  }

  return { status, coords, enderecoLegivel, cepSugerido, erro, pedir }
}
