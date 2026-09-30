/** Formata CENTAVOS (inteiro) como moeda BRL. Ex.: 18900 -> "R$ 189,00". */
export function formatBRL(centavos: number | null | undefined): string {
  const n = typeof centavos === 'number' ? centavos : 0
  return (n / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function formatData(data: string | null | undefined): string {
  if (!data) return '-'
  // Datas YYYY-MM-DD (sem hora) devem ser lidas no fuso local, senão o JS
  // interpreta como UTC e "volta" um dia no Brasil.
  const somenteData = /^\d{4}-\d{2}-\d{2}$/.test(data)
  const d = somenteData ? new Date(data + 'T00:00:00') : new Date(data)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('pt-BR')
}

export function formatDataHora(data: string | null | undefined): string {
  if (!data) return '-'
  const d = new Date(data)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

/** Converte input do usuário em reais (ex.: "1.234,50") para CENTAVOS (inteiro). */
export function parseCentavos(texto: string): number {
  if (!texto) return 0
  const limpo = texto.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '')
  const reais = Number(limpo)
  return Number.isNaN(reais) ? 0 : Math.round(reais * 100)
}

/** Centavos -> string editável em reais para inputs (ex.: 123456 -> "1234,56"). */
export function centavosParaInput(centavos: number | null | undefined): string {
  const n = typeof centavos === 'number' ? centavos : 0
  return (n / 100).toFixed(2).replace('.', ',')
}
