// Taxonomia da Luar (mesma do site / loja.js). O produto guarda em
// `categoria` (texto) o nome da PRINCIPAL ou de uma SUB; o site resolve
// a principal por esta lista.

export const TAXONOMIA: { principal: string; subs: string[] }[] = [
  { principal: 'Anéis', subs: ['Anéis', 'Alianças'] },
  { principal: 'Brincos', subs: ['Brincos', 'Argolas', 'Corrente de orelha'] },
  { principal: 'Colares e Correntes', subs: ['Colares', 'Correntes', 'Colar gravatinha', 'Pingentes', 'Escapulários'] },
  { principal: 'Pulseiras', subs: ['Pulseiras', 'Tornozeleiras', 'Braceletes'] },
  { principal: 'Piercings', subs: ['Piercings'] },
  { principal: 'Separadores', subs: ['Separadores'] },
]

// Sugestões do campo Material (é um `datalist`, então texto livre continua
// valendo). Saíram 'Aço inoxidável' e 'Aço com banho de ouro' em 11/08/2026:
// a Luar trabalha só com Prata 925, é o que a "Sobre nós" da loja afirma, e
// zero das 251 peças cadastradas usava aço. Oferecer a opção era o caminho
// mais curto pra alguém cadastrar uma peça que faz o site se contradizer.
// Entrou 'Prata 925 com banho de ouro 18k', que 36 peças já usam mas ninguém
// tinha adicionado aqui, então vinha digitado à mão — e variante com typo
// vira material novo no filtro da loja.
export const MATERIAIS = [
  'Prata 925',
  'Prata 925 com banho de ouro',
  'Prata 925 com banho de ouro 18k',
  'Prata 925 com banho de ródio',
]

export const PUBLICOS = [
  { valor: 'feminino', rotulo: 'Feminino' },
  { valor: 'masculino', rotulo: 'Masculino' },
  { valor: 'unissex', rotulo: 'Unissex' },
  { valor: 'infantil', rotulo: 'Infantil' },
]

export function slugify(s: string): string {
  const mapa: Record<string, string> = {
    á: 'a', à: 'a', â: 'a', ã: 'a', ä: 'a',
    é: 'e', ê: 'e', è: 'e', ë: 'e',
    í: 'i', ì: 'i', î: 'i', ï: 'i',
    ó: 'o', ô: 'o', õ: 'o', ò: 'o', ö: 'o',
    ú: 'u', ù: 'u', û: 'u', ü: 'u',
    ç: 'c', ñ: 'n',
  }
  return s
    .toLowerCase()
    .replace(/[áàâãäéêèëíìîïóôõòöúùûüçñ]/g, (c) => mapa[c] || c)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
