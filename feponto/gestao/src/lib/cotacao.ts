// Busca a cotação do ouro no mercado (AwesomeAPI, gratuita, sem cadastro)
// e converte para R$/grama de ouro 24k (ouro puro).

const GRAMAS_POR_ONCA = 31.1035

/** Retorna o preço do grama de ouro 24k (puro) de mercado em R$, ou null se falhar. */
export async function buscarOuro24kMercado(): Promise<number | null> {
  try {
    const r = await fetch('https://economia.awesomeapi.com.br/json/last/XAU-BRL')
    if (!r.ok) return null
    const j = await r.json()
    const bid = Number(j?.XAUBRL?.bid) // preço da onça troy (ouro puro) em R$
    if (!bid || Number.isNaN(bid)) return null
    return bid / GRAMAS_POR_ONCA
  } catch {
    return null
  }
}
