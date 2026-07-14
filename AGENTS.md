# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Projeto

FarmaCompare — PWA em Nuxt 3 + Vue 3 (Tailwind, Pinia) para comparar preços de remédios nas farmácias próximas do usuário. Não há testes nem linter configurados. Não é repositório git e não está publicado (roda só localmente).

## Comandos

```bash
npm run dev        # desenvolvimento em http://localhost:3000
npm run build      # build de produção
npm run preview    # serve o build
```

Configuração via `.env` (ver `.env.example`). Hoje só `ANTHROPIC_API_KEY` está configurada. `GOOGLE_PLACES_API_KEY` e `PHARMADB_API_KEY` são opcionais e afetam quais caminhos de código rodam (ver cascatas abaixo).

## Arquitetura

Fluxo de dados (tudo client → server routes do Nitro → APIs externas):

1. `composables/useGeolocation.ts` pega coordenadas do browser e endereço legível via Nominatim.
2. `composables/useFarmacias.ts` → POST `/api/farmacias-proximas` (`server/api/farmacias-proximas.post.ts`). Cascata: Google Places (se houver chave) → Overpass/OpenStreetMap → lista simulada hardcoded. A resposta é cacheada 5 min via `routeRules` no `nuxt.config.ts`.
3. `composables/usePrecos.ts` → POST `/api/precos` (`server/api/precos.post.ts`). Cascata por farmácia: API VTEX Intelligent Search → API VTEX catalog_system → scraping de `__NEXT_DATA__`/JSON-LD do HTML de busca → fallback Codex (inventa preços "realistas").
4. `pages/index.vue` orquestra tudo; `PrecoCard.vue` renderiza cada resultado; `types/index.ts` tem todos os contratos compartilhados.

O mapa `VTEX_BASES` em `precos.post.ts` define quais redes têm busca real (Drogasil, Droga Raia, Pague Menos, Pacheco, Ultrafarma, Panvel). Farmácias fora desse mapa caem direto no Codex.

A ligação entre farmácia próxima (nome vindo do OSM/Google) e loja online é feita por nome normalizado (`normalizarNomeFarmacia` em `farmacias-proximas.post.ts` + chaves de `VTEX_BASES`) — os nomes precisam bater exatamente.

## Bugs conhecidos (diagnóstico de 2026-06-10, confirmado com testes ao vivo)

Há um redesign aprovado em conversa, ainda não implementado. Causas-raiz dos preços errados que motivaram a parada do projeto:

1. **Overpass retorna HTTP 406**: a requisição em `farmacias-proximas.post.ts` não envia `Content-Type: application/x-www-form-urlencoded`. Com o header, funciona (testado: 10 farmácias reais em Vitória-ES, cidade do usuário).
2. **Raio ignorado**: `handleBuscar` em `pages/index.vue` usa lista fixa de redes nacionais quando nenhuma farmácia é encontrada no raio.
3. **Preços de IA disfarçados**: quando a VTEX falha para algumas farmácias, `precos.post.ts` completa com preços inventados pelo Codex mas mantém `fonte: 'real'` — a UI mostra "✓ preços reais dos sites" para dados fictícios.
4. **Drogasil/Droga Raia bloqueiam** requisições diretas (anti-bot Akamai). As demais redes VTEX funcionam e o preço bate com o site.
5. **Produto trocado**: `parseVtexProducts` pega o primeiro resultado da busca, então apresentações diferentes (gotas vs 10cp vs 30cp) são comparadas entre farmácias.

## Redesign planejado (decisões já tomadas com o usuário)

- Scraping com Playwright stealth para as redes bloqueadas; sem preço real → card "indisponível" com link (nunca preço de IA — remover o fallback Codex de preços).
- Fluxo em duas etapas: busca mostra apresentações encontradas → usuário escolhe → comparação do produto exato por EAN entre as farmácias do raio.
- Só comparar farmácias realmente encontradas no raio.
- Cache de preços 12h por EAN+farmácia (SQLite).
- Publicar como container Docker único (Nuxt + Chromium) em Railway/Render; antes disso, criar repositório git.
