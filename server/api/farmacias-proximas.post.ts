/**
 * POST /api/farmacias-proximas
 *
 * Busca farmácias num raio ao redor de uma coordenada.
 * Usa Google Places Nearby Search API (novo endpoint v1).
 * Fallback: retorna lista simulada se a chave não estiver configurada.
 */

import type { FarmaciasProximasPayload, Farmacia } from '~/types'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const body = await readBody<FarmaciasProximasPayload>(event)

  const { lat, lng, raio = 3000 } = body

  if (typeof lat !== 'number' || typeof lng !== 'number') {
    throw createError({ statusCode: 400, statusMessage: 'lat e lng são obrigatórios' })
  }

  // --- Google Places Nearby Search (novo endpoint v1) ---
  const googlePlacesApiKey = String(config.googlePlacesApiKey || process.env.GOOGLE_PLACES_API_KEY || '')
  if (googlePlacesApiKey) {
    return await buscarViaGooglePlaces({ lat, lng, raio, apiKey: googlePlacesApiKey })
  }

  // --- Fallback: Nominatim OSM (gratuito, sem chave) ---
  // Nominatim não tem nearby search por tipo, usamos overpass API do OpenStreetMap
  try {
    return await buscarViaOverpass({ lat, lng, raio })
  } catch {
    throw createError({ statusCode: 502, statusMessage: 'Não foi possível consultar farmácias próximas. Tente novamente.' })
  }
})

// --- Google Places Nearby Search ---
async function buscarViaGooglePlaces({ lat, lng, raio, apiKey }: {
  lat: number; lng: number; raio: number; apiKey: string
}): Promise<Farmacia[]> {
  const url = 'https://places.googleapis.com/v1/places:searchNearby'

  const body = {
    includedTypes: ['pharmacy', 'drugstore'],
    maxResultCount: 20,
    locationRestriction: {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius: raio
      }
    }
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.currentOpeningHours,places.id,places.internationalPhoneNumber,places.websiteUri'
    },
    body: JSON.stringify(body)
  })

  if (!res.ok) {
    const err = await res.text()
    throw createError({ statusCode: 502, statusMessage: `Google Places error: ${err}` })
  }

  const data = await res.json()
  const places = data.places || []

  return places.map((p: any) => {
    const placeLat = p.location?.latitude ?? lat
    const placeLng = p.location?.longitude ?? lng
    const distancia_m = Math.round(haversine(lat, lng, placeLat, placeLng))

    return {
      id: p.id,
      nome: normalizarNomeFarmacia(p.displayName?.text || 'Farmácia'),
      endereco: p.formattedAddress || '',
      distancia_m,
      aberta: p.currentOpeningHours?.openNow ?? true,
      lat: placeLat,
      lng: placeLng,
      telefone: p.internationalPhoneNumber || '',
      website: p.websiteUri || undefined,
      googlePlaceId: p.id,
    } satisfies Farmacia
  }).sort((a: Farmacia, b: Farmacia) => a.distancia_m - b.distancia_m)
}

// --- OpenStreetMap Overpass API (gratuito, sem chave) ---
async function buscarViaOverpass({ lat, lng, raio }: {
  lat: number; lng: number; raio: number
}): Promise<Farmacia[]> {
  const query = `
    [out:json][timeout:20];
    (
      node["amenity"="pharmacy"](around:${raio},${lat},${lng});
      way["amenity"="pharmacy"](around:${raio},${lat},${lng});
      node["shop"="chemist"](around:${raio},${lat},${lng});
    );
    out center;
  `

  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
  ]
  let data: any
  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          'User-Agent': 'FarmaCompare/1.0 (https://github.com/fred512/farmacompare)',
          Accept: 'application/json',
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(30_000),
      })
      if (res.ok) { data = await res.json(); break }
    } catch {}
  }
  if (!data) throw new Error('Overpass indisponível')
  const elements = data.elements || []

  return elements
    .filter((el: any) => el.tags?.name)
    .map((el: any) => {
      const elLat = el.lat ?? el.center?.lat ?? lat
      const elLng = el.lon ?? el.center?.lon ?? lng
      return {
        id: String(el.id),
        nome: normalizarNomeFarmacia(el.tags.name),
        endereco: [el.tags['addr:street'], el.tags['addr:housenumber']].filter(Boolean).join(', '),
        distancia_m: Math.round(haversine(lat, lng, elLat, elLng)),
        aberta: true,
        lat: elLat,
        lng: elLng,
        telefone: el.tags.phone || el.tags['contact:phone'],
        website: normalizarWebsite(el.tags.website || el.tags['contact:website']),
      } satisfies Farmacia
    })
    .sort((a: Farmacia, b: Farmacia) => a.distancia_m - b.distancia_m)
}

// --- Helpers ---

// Fórmula de Haversine para distância entre duas coordenadas (metros)
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
    * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Normaliza nomes de redes conhecidas (ex: "DROGASIL LTDA" → "Drogasil")
function normalizarNomeFarmacia(nome: string): string {
  const mapa: [RegExp, string][] = [
    [/droga.?raia/i, 'Droga Raia'],
    [/drogasil/i, 'Drogasil'],
    [/ultrafarma/i, 'Ultrafarma'],
    [/panvel/i, 'Panvel'],
    [/pague.?menos/i, 'Farmácias Pague Menos'],
    [/nissei/i, 'Nissei'],
    [/extrafarma/i, 'Extrafarma'],
    [/são.?paulo|sp.?drog/i, 'Drogaria São Paulo'],
    [/drogão/i, 'Drogão Super'],
    [/farmácia.?popular|popular/i, 'Farmácia Popular'],
  ]
  for (const [re, normalized] of mapa) {
    if (re.test(nome)) return normalized
  }
  // Capitaliza o nome original
  return nome.replace(/\b\w/g, c => c.toUpperCase()).toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

function normalizarWebsite(value?: string) {
  if (!value) return undefined
  try { return new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`).toString() } catch { return undefined }
}
