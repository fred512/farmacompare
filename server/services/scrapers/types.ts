import type { ApresentacaoMedicamento, ConfiabilidadePreco, ResultadoPreco } from '~/types'

export interface ConsultaPreco {
  farmacia: string
  ean: string
  cep: string
  apresentacao: ApresentacaoMedicamento
}

export interface PrecoExtraido extends ResultadoPreco {
  confiabilidade: ConfiabilidadePreco
  consultadoEm: string
}
