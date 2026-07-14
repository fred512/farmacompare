export default defineEventHandler(async (event) => {
  const cep = String(getQuery(event).cep || '').replace(/\D/g, '')
  if (!/^\d{8}$/.test(cep)) throw createError({ statusCode: 400, statusMessage: 'Informe um CEP válido com 8 números.' })

  const endereco = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal: AbortSignal.timeout(8_000) }).then(res => res.json())
  if (endereco.erro) throw createError({ statusCode: 404, statusMessage: 'CEP não encontrado.' })

  const consulta = [endereco.logradouro, endereco.bairro, endereco.localidade, endereco.uf, cep, 'Brasil'].filter(Boolean).join(', ')
  const params = new URLSearchParams({ q: consulta, format: 'jsonv2', limit: '1', countrycodes: 'br' })
  let locais = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { 'User-Agent': 'FarmCompare/1.0' }, signal: AbortSignal.timeout(10_000),
  }).then(res => res.json())
  if (!locais.length) {
    const fallback = new URLSearchParams({ postalcode: cep, country: 'Brasil', format: 'jsonv2', limit: '1' })
    locais = await fetch(`https://nominatim.openstreetmap.org/search?${fallback}`, {
      headers: { 'User-Agent': 'FarmCompare/1.0' }, signal: AbortSignal.timeout(10_000),
    }).then(res => res.json())
  }
  if (!locais.length) throw createError({ statusCode: 404, statusMessage: 'Não foi possível localizar este CEP no mapa.' })

  return {
    lat: Number(locais[0].lat),
    lng: Number(locais[0].lon),
    cep: cep.replace(/^(\d{5})(\d{3})$/, '$1-$2'),
    endereco: [endereco.logradouro, endereco.bairro, endereco.localidade, endereco.uf].filter(Boolean).join(', '),
  }
})
