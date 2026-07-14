# FarmCompare

PWA em Nuxt 3 para comparar preços reais de uma apresentação exata de medicamento nas farmácias próximas.

## Como funciona

1. O navegador obtém a localização do usuário.
2. A API encontra farmácias no raio escolhido usando Google Places ou OpenStreetMap/Overpass.
3. A busca retorna apresentações com EAN confirmado.
4. O usuário escolhe a apresentação exata.
5. O servidor consulta cada rede pelo EAN. Valores não confirmados aparecem como indisponíveis, nunca como estimativas.
6. Os resultados são armazenados em SQLite por 12 horas, por EAN e farmácia.

## Desenvolvimento

Requer Node.js 22 e, para as redes protegidas, os navegadores do Playwright.

```bash
npm install
npx playwright install chromium
npm run dev
```

Copie `.env.example` para `.env` se quiser configurar Google Places ou outro caminho para o banco.

## Build local

```bash
npm run build
npm run preview
```

## Docker

O container inclui Chromium e todas as dependências de sistema necessárias ao Playwright.

```bash
docker build -t farmacompare .
docker run --rm -p 3000:3000 -v farmacompare-data:/app/data farmacompare
```

Acesse `http://localhost:3000`. O health check está disponível em `/api/health`.

## Railway

1. Crie um projeto a partir do repositório `fred512/farmacompare`.
2. O arquivo `railway.toml` selecionará automaticamente o Dockerfile e o health check.
3. Gere um domínio público em **Settings → Networking**.
4. Em **Volumes**, crie um volume montado em `/app/data`.
5. Opcionalmente, adicione `NUXT_GOOGLE_PLACES_API_KEY` em **Variables**.
6. Mantenha `DATABASE_PATH=/app/data/farmacompare.db`.

Cada push na branch `main` inicia uma nova publicação.

## Variáveis

| Variável | Obrigatória | Descrição |
|---|---:|---|
| `DATABASE_PATH` | não | Caminho do SQLite; padrão local `./data/farmacompare.db` |
| `NUXT_GOOGLE_PLACES_API_KEY` | não | Ativa Google Places; sem ela usa Overpass |
| `PORT` | não | Fornecida automaticamente pelo provedor |

## Comandos

```bash
npm run dev
npm run build
npm run preview
```
