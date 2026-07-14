// Farmácia encontrada via Google Places ou geocoding
export interface Farmacia {
  id: string
  nome: string
  endereco: string
  distancia_m: number
  aberta: boolean
  lat?: number
  lng?: number
  telefone?: string
  website?: string
  googlePlaceId?: string
}

export type UnidadeDose = 'cápsula' | 'comprimido' | 'ml' | 'sachê' | 'dose' | 'unidade'

export interface ApresentacaoMedicamento {
  ean: string
  nome: string
  principiosAtivos: string
  dosagem: string
  marca: string
  fabricante?: string
  formaFarmaceutica: string
  quantidade: number
  unidade: UnidadeDose
  registroMs?: string
  url?: string
}

export type ConfiabilidadePreco =
  | 'retirada_confirmada'
  | 'entrega_cep'
  | 'online_sem_loja'
  | 'indisponivel'
  | 'nao_confirmado'

// Resultado de preço de um remédio em uma farmácia
export interface ResultadoPreco {
  farmaciaId?: string
  farmacia: string
  preco: number | null
  disponivel: boolean
  tipo: 'genérico' | 'similar' | 'referência' | string
  marca: string
  url?: string // link direto para compra
  precoUnitario?: number | null
  precoOriginal?: number | null
  promocao?: string
  quantidadePromocional?: number
  unidade?: UnidadeDose
  confiabilidade?: ConfiabilidadePreco
  consultadoEm?: string
}

// Resposta completa da busca de preços
export interface RespostaPrecos {
  produto_normalizado: string
  apresentacao: string
  resultados: ResultadoPreco[]
  fonte: 'cache' | 'real'
  timestamp: number
}

// Payload para a API de farmácias próximas
export interface FarmaciasProximasPayload {
  lat: number
  lng: number
  raio: number // metros
}

// Payload para a API de preços
export interface BuscaPrecoPayload {
  query?: string
  farmacias: string[]
  ean?: string
  cep?: string
  apresentacao?: ApresentacaoMedicamento
  lojas?: Farmacia[]
}

export interface BuscaApresentacoesPayload {
  query: string
}

// Estado da geolocalização
export type GeoStatus = 'idle' | 'loading' | 'success' | 'error' | 'denied'
