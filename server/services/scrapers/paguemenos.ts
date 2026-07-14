import type { ConsultaPreco, PrecoExtraido } from './types'
import { withPage } from './browser'

function parsePreco(value: string | null) {
  const digits = value?.replace(/[^0-9,]/g, '').replace(',', '.')
  return digits ? Number(digits) : null
}

// O site pode mudar seus seletores; uma falha retorna "não confirmado", nunca preço estimado.
export async function buscarNaPagueMenos(input: ConsultaPreco): Promise<PrecoExtraido> {
  return withPage(async (page) => {
    await page.goto(`https://www.paguemenos.com.br/busca?q=${encodeURIComponent(input.ean)}`, {
      waitUntil: 'domcontentloaded', timeout: 20_000,
    })
    const card = page.locator('[data-testid="product-card"], [data-testid="product-item"], article').first()
    const found = await card.count() > 0
    const text = found ? await card.innerText() : ''
    const preco = parsePreco(text.match(/R\$\s*[\d.,]+/)?.[0] || null)
    const href = found ? await card.locator('a').first().getAttribute('href') : null
    return {
      farmacia: input.farmacia,
      preco,
      disponivel: preco !== null,
      tipo: 'referência',
      marca: input.apresentacao.marca,
      url: href ? new URL(href, 'https://www.paguemenos.com.br').toString() : undefined,
      precoUnitario: preco === null ? null : preco / input.apresentacao.quantidade,
      unidade: input.apresentacao.unidade,
      confiabilidade: preco === null ? 'nao_confirmado' : 'online_sem_loja',
      consultadoEm: new Date().toISOString(),
    }
  })
}
