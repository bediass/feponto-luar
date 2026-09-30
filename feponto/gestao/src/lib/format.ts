export function formatBRL(valor: number | null | undefined): string {
  const n = typeof valor === 'number' ? valor : 0
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function formatData(data: string | null | undefined): string {
  if (!data) return '—'
  // Datas no formato YYYY-MM-DD (sem hora) devem ser lidas no fuso local,
  // senão o JS interpreta como UTC e "volta" um dia no Brasil.
  const somenteData = /^\d{4}-\d{2}-\d{2}$/.test(data)
  const d = somenteData ? new Date(data + 'T00:00:00') : new Date(data)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR')
}

export function formatDataHora(data: string | null | undefined): string {
  if (!data) return '—'
  const d = new Date(data)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

/**
 * Converte input do usuário (ex.: "1.234,50", "R$ 345,53") para número.
 *
 * Regra do ponto: com vírgula no texto, o ponto é separador de milhar
 * ("1.234,50" → 1234.5). SEM vírgula, um ponto único seguido de 1 ou 2 dígitos
 * é separador DECIMAL ("3.5" → 3.5, "345.53" → 345.53); seguido de 3 dígitos
 * continua sendo milhar ("1.234" → 1234).
 *
 * ⚠️ Isso não é purismo. O teclado numérico do Windows entrega ponto, não
 * vírgula, e a versão antiga jogava o ponto fora em qualquer caso: quem
 * digitava a cotação "345.53" gravava **34553** e a peça saía com preço 100×
 * maior. Ninguém digita "3.5" querendo 35, então o caso decimal não é ambíguo.
 * O caso de 3 dígitos é o ambíguo de verdade ("1.234" pode ser mil ou 1,234) e
 * fica como estava, porque em dinheiro brasileiro milhar é o uso comum.
 * Coberto por `testes/format.teste.ts` (`npm run teste`).
 */
export function parseValor(texto: string): number {
  if (!texto) return 0
  let limpo = texto.replace(/[^\d.,-]/g, '')
  if (limpo.includes(',')) {
    limpo = limpo.replace(/\./g, '').replace(',', '.')
  } else if (/^-?\d+\.\d{1,2}$/.test(limpo)) {
    // ponto decimal: deixa como está, o Number já entende
  } else {
    limpo = limpo.replace(/\./g, '')
  }
  const n = Number(limpo)
  return Number.isNaN(n) ? 0 : n
}

/**
 * Texto digitado → dinheiro em pt-BR, para reescrever o próprio campo quando o
 * usuário sai dele: "345.53" → "345,53", "1234" → "1.234,00", "" → "".
 * Sem o símbolo, porque o `CampoMoeda` já mostra o "R$" fixo à esquerda.
 */
export function formatValorEditavel(texto: string): string {
  const t = (texto ?? '').trim()
  if (!t || !/\d/.test(t)) return ''
  return parseValor(t).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}
