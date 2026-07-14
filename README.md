# FarmaCompare

PWA em Nuxt 3 + Vue 3 para comparar preços de remédios nas farmácias mais próximas de você.

## Funcionalidades

- **Geolocalização real** — usa a API do browser para obter coordenadas exatas
- **Farmácias próximas** — busca no raio configurado (padrão: 3km)
  - Com chave Google Places: dados reais em tempo real
  - Sem chave: fallback via OpenStreetMap Overpass API (gratuito)
- **Comparação de preços**
  - Com chave PharmaDB: dados oficiais ANVISA/CMED
  - Com chave Anthropic: preços de mercado via IA
- **PWA** — instalável no celular como app nativo
- **Dark mode** automático

---

## Setup

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar variáveis de ambiente

```bash
cp .env.example .env
```

Edite o `.env`:

```env
# Obrigatório para preços (escolha um):
ANTHROPIC_API_KEY=sk-ant-...          # Preços via IA (mais fácil)
PHARMADB_API_KEY=...                   # Preços reais ANVISA/CMED (mais preciso)

# Opcional para farmácias (sem isso usa OpenStreetMap):
GOOGLE_PLACES_API_KEY=AIza...          # Farmácias em tempo real via Google
```

### 3. Rodar em desenvolvimento

```bash
npm run dev
```

Acesse: http://localhost:3000

### 4. Build para produção

```bash
npm run build
npm run preview
```

---

## Estrutura do projeto

```
farmacompare/
├── pages/
│   └── index.vue                  # Página principal
├── components/
│   ├── LocationBar.vue            # Barra de localização
│   ├── FarmaciaItem.vue           # Card de farmácia próxima
│   └── PrecoCard.vue              # Card de resultado de preço
├── composables/
│   ├── useGeolocation.ts          # Geolocalização do browser
│   ├── useFarmacias.ts            # Busca farmácias próximas
│   └── usePrecos.ts               # Busca e comparação de preços
├── server/
│   └── api/
│       ├── farmacias-proximas.post.ts   # Endpoint: farmácias próximas
│       └── precos.post.ts               # Endpoint: comparação de preços
├── types/
│   └── index.ts                   # Tipos TypeScript
├── assets/css/
│   └── main.css                   # Tokens de design e reset
├── public/
│   └── manifest.json              # PWA manifest
└── nuxt.config.ts                 # Configuração Nuxt
```

---

## APIs utilizadas

| API | Uso | Custo |
|-----|-----|-------|
| **Geolocation API** (browser) | Coordenadas do usuário | Grátis |
| **Nominatim / OSM** | Endereço legível (reverse geocode) | Grátis |
| **OpenStreetMap Overpass** | Farmácias próximas (fallback) | Grátis |
| **Google Places API** | Farmácias próximas (produção) | Pago |
| **Anthropic Claude** | Preços de mercado via IA | Pago |
| **PharmaDB** | Preços reais ANVISA/CMED | Pago |

### Obter as chaves

- **Google Places**: https://console.cloud.google.com → APIs & Services → Places API (New)
- **Anthropic**: https://console.anthropic.com/settings/keys
- **PharmaDB**: https://pharmadb.com.br (planos para desenvolvedores)

---

## Raio de busca

O raio padrão é **3km**. Para mudar permanentemente:

```ts
// nuxt.config.ts
runtimeConfig: {
  public: {
    defaultRadius: 3000 // ← altere aqui (em metros)
  }
}
```

O usuário também pode mudar o raio pelo seletor na interface (500m, 1km, 3km, 5km).
