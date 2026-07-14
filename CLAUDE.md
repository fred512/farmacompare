# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projeto

FarmCompare — PWA em Nuxt 3 + Vue 3 (Tailwind, Pinia) para comparar preços de remédios nas farmácias próximas do usuário. Não há testes nem linter configurados. É repositório git publicado em `github.com/fred512/farmacompare`; roda localmente e tem `Dockerfile` + `railway.toml` para deploy em container.

## Comandos

```bash
npm run dev        # desenvolvimento em http://localhost:3000
npm run build      # build de produção
npm run preview    # serve o build
```

Configuração via `.env` (ver `.env.example`). Variáveis relevantes:
- `GOOGLE_PLACES_API_KEY` (opcional) — se presente, usa Google Places em vez de Overpass para farmácias próximas.
- `DATABASE_PATH` (opcional) — caminho do SQLite do cache de preços (default `./data/farmacompare.db`).
- `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` (opcional) — Chromium externo para o Playwright (útil no container).

> O fallback de preços por IA foi **removido**: Claude não é mais usado para inventar/estimar preços. `ANTHROPIC_API_KEY` não participa mais do fluxo de preços.

## Arquitetura

Fluxo em **duas etapas** (tudo client → server routes do Nitro → APIs externas):

1. `composables/useGeolocation.ts` pega coordenadas do browser e endereço legível via Nominatim.
2. `composables/useFarmacias.ts` → POST `/api/farmacias-proximas` (`server/api/farmacias-proximas.post.ts`). Cascata: Google Places (se houver chave) → Overpass/OpenStreetMap (agora com header `Content-Type: application/x-www-form-urlencoded`, com 3 endpoints de fallback) → lista simulada. Cacheada 5 min via `routeRules` no `nuxt.config.ts`. Nomes normalizados por `normalizarNomeFarmacia`.
3. **Etapa 1 — escolher apresentação:** `composables/useApresentacoes.ts` → POST `/api/apresentacoes` (`server/api/apresentacoes.post.ts`). Busca o catálogo VTEX da Pague Menos e devolve as apresentações reais (EAN, dose, quantidade, unidade) que casam com a query, deduplicadas por `chaveEquivalencia` (princípio+dose+qtd+unidade). O usuário escolhe uma (`components/ApresentacaoItem.vue`).
4. **Etapa 2 — comparar preço do produto exato:** `composables/usePrecos.ts` → POST `/api/precos` (`server/api/precos.post.ts`). Para cada farmácia **do raio**, cascata definida no array `REDES`:
   - VTEX `catalog_system` via `fetch` direto (`consultarVtex`), ou
   - **Playwright** (`consultarComNavegador`) para as redes anti-bot marcadas `playwright: true` (Drogasil, Droga Raia, Pacheco), ou
   - site genérico via Playwright + JSON-LD/regex de `R$` (`consultarSiteGenerico`) quando a farmácia tem `website` público.
   - Sem preço confirmado → card **`indisponivel`** (preço `null`) com link para a loja. **Nunca** preço de IA.
   - Matching por `equivalente()` (confere dose + quantidade/unidade) para não comparar apresentações diferentes.
5. `pages/index.vue` orquestra tudo; `components/PrecoCard.vue` renderiza cada resultado; `components/FarmaciaItem.vue`/`LocationBar.vue` a UI de seleção; `types/index.ts` tem os contratos compartilhados.

**Cache de preços (`server/services/price-cache.ts`):** SQLite (`better-sqlite3`), TTL de 12h, chave = `chaveEquivalencia(apresentação) + nome:id da loja`. `fonte` da resposta é `'cache'` se tudo veio do cache, senão `'real'`.

**Playwright (`server/services/scrapers/browser.ts`):** um único browser Chromium headless (`getBrowser`) reaproveitado; `withPage()` cria/descarta um context por consulta. `scrapers/paguemenos.ts` é um scraper específico; `scrapers/types.ts` os tipos.

## Estado atual

Os 5 bugs que motivaram a parada do projeto (diagnóstico de 2026-06-10) **foram todos corrigidos** neste redesign:

1. Overpass 406 → header `application/x-www-form-urlencoded` adicionado.
2. Raio ignorado → `handleBuscar` usa `farmaciasAtivas` (só as do raio) e `watch(raio)` re-busca; sem lista nacional hardcoded.
3. Preços de IA disfarçados → fallback Claude removido; sem preço = card `indisponivel`.
4. Drogasil/Droga Raia bloqueados → agora via Playwright.
5. Produto trocado → fluxo em duas etapas por EAN + `equivalente()`/`chaveEquivalencia`.

Pendências conhecidas: deploy do container ainda não confirmado em produção.
