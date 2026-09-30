// Referências de domínio para o cadastro de joias.

/** Público-alvo da peça (usado como filtro, não como categoria). */
export const PUBLICOS = [
  { valor: 'feminino', rotulo: 'Feminino' },
  { valor: 'masculino', rotulo: 'Masculino' },
  { valor: 'unissex', rotulo: 'Unissex' },
  { valor: 'infantil', rotulo: 'Infantil' },
] as const

/** Cores do ouro / metal. */
export const CORES_OURO = [
  'Ouro amarelo',
  'Ouro branco',
  'Ouro rosé',
  'Ouro 2 tons',
  'Ouro 3 tons',
  'Prata',
  'Outro',
]

/** Minúsculas e sem acento: "Alianças" -> "aliancas". */
function semAcento(s: string | null | undefined): string {
  return (s ?? '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
}

/**
 * A peça é uma aliança? Decide pelo NOME da categoria, não por id fixo — e foi
 * essa escolha que segurou a mudança de 31/07/2026, quando "Alianças" saiu de
 * subcategoria de "Anéis" e virou família própria (`sql/bloco-5-familia-aliancas.sql`).
 * Nenhuma linha aqui precisou mudar.
 *
 * Casa com "Alianças" (família), "Aliança" e "Meia Aliança" (subcategorias).
 * Quem chama passa a subcategoria e a família.
 */
export function ehAlianca(...nomesCategoria: (string | null | undefined)[]): boolean {
  return nomesCategoria.some((n) => semAcento(n).includes('alianc'))
}

/**
 * Índice de ouro que precifica a peça. Em par de alianças, o preço é das
 * DUAS peças, então os índices somam:
 *   preço = (indice + par_indice) × cotação de venda × markup
 * Mesma conta do recalcular_precos_ouro no banco (sql/bloco-3-par-alianca.sql).
 */
export function indiceTotal(p: {
  indice?: number | null
  eh_par?: boolean | null
  par_indice?: number | null
}): number {
  const base = p.indice ?? 0
  return p.eh_par ? base + (p.par_indice ?? 0) : base
}

/** Peso somado das duas peças quando é par; senão, o peso da peça. */
export function pesoTotal(p: {
  peso_gramas?: number | null
  eh_par?: boolean | null
  par_peso_gramas?: number | null
}): number | null {
  const base = p.peso_gramas ?? null
  if (!p.eh_par) return base
  const outro = p.par_peso_gramas ?? null
  if (base == null && outro == null) return null
  return (base ?? 0) + (outro ?? 0)
}

/**
 * Índice arredondado em 4 casas, que é a escala da coluna `produtos.indice`.
 * Menos casas do que isso muda o preço em mais de um centavo.
 */
export function arredondarIndice(n: number): number {
  return Math.round(n * 1e4) / 1e4
}

/**
 * Índice de ouro que a peça ganha automaticamente: peso × MK de custo.
 * É só o valor INICIAL. A Fernanda pode sobrescrever pelo lápis da precificação,
 * e nesse caso este número deixa de valer para o preço.
 *
 * `mkCusto` null significa "não preenchido" e devolve 0. `mkCusto` 0 é escolha
 * dela (peça sem MK no custo) e devolve 0 também, mas pela conta, não por falta
 * de dado. Quem separa os dois casos é o formulário.
 */
export function indiceAutomatico(pesoGramas: number, mkCusto: number | null): number {
  if (mkCusto == null || pesoGramas <= 0) return 0
  return arredondarIndice(pesoGramas * mkCusto)
}

/**
 * Custo da peça: peso × MK de custo × cotação de custo.
 *
 * ⚠️ NÃO recebe o índice, e isso é o ponto. Até 12/08/2026 o custo era calculado
 * como `índice × cotação de custo`, então digitar um índice diferente na
 * precificação remarcava o custo: numa peça de 2,4 g com MK 1, subir o índice
 * para 3,1 para vender mais caro levava o custo de R$ 744 para R$ 961, mexendo na
 * margem sem ninguém pedir. Custo e preço de venda são contas independentes:
 * o índice manual move só o preço.
 *
 * Em par de aliança, `pesoGramas` já vem somado (as duas peças).
 */
export function custoDaPeca(
  pesoGramas: number,
  mkCusto: number | null,
  cotacaoCusto: number,
): number {
  if (mkCusto == null || pesoGramas <= 0 || cotacaoCusto <= 0) return 0
  return cotacaoCusto * arredondarIndice(pesoGramas * mkCusto)
}

/**
 * Unidade do campo "tamanho" conforme o tipo (categoria) da peça.
 * Baseado nas medidas usuais de joalheria no Brasil:
 * anel/aliança = aro (nº); colar/corrente/pulseira/bracelete = cm; pingente/brinco = mm.
 *
 * Recebe o nome da FAMÍLIA. 'alianc' está na lista do aro porque desde 31/07/2026
 * "Alianças" é família própria — antes ela entrava por "Anéis".
 */
export function unidadeTamanho(nomeCategoria: string | null | undefined): {
  label: string
  placeholder: string
} {
  const n = semAcento(nomeCategoria)
  const tem = (...alvos: string[]) => alvos.some((a) => n.includes(a))

  if (tem('anel', 'anei', 'alianc'))
    return { label: 'Aro (nº)', placeholder: 'Ex.: 16' }
  // 'escapul' entrou em 11/08/2026, quando Escapulários virou família própria
  // (sql/bloco-10-familias-pingentes-escapularios.sql). Escapulário se mede em
  // cm, como colar: sem esta linha a família nova cairia no rótulo genérico
  // "Tamanho", porque a decisão aqui é por NOME da família.
  if (tem('colar', 'corrent', 'pulseira', 'bracelete', 'gargantilha', 'tornozeleira', 'escapul'))
    return { label: 'Comprimento (cm)', placeholder: 'Ex.: 45' }
  // 'alfinete' entrou em 13/08/2026 com a taxonomia nova
  // (sql/bloco-11-taxonomia-nova.sql). Alfinete de lapela se mede em mm, como
  // pingente e brinco. Das três famílias novas daquele bloco, foi a única que
  // precisou de linha aqui: "Alianças de casamento" já casava com 'alianc' e
  // "Tornozeleiras" já estava na lista do cm acima.
  if (tem('pingente', 'brinco', 'piercing', 'alfinete'))
    return { label: 'Medida (mm)', placeholder: 'Ex.: 12' }
  return { label: 'Tamanho', placeholder: '—' }
}

/** Lista ampla de pedras/gemas para busca no cadastro. */
export const PEDRAS = [
  'Diamante',
  'Brilhante',
  'Diamante negro',
  'Safira',
  'Safira rosa',
  'Safira amarela',
  'Rubi',
  'Esmeralda',
  'Água-marinha',
  'Topázio',
  'Topázio azul',
  'Topázio imperial',
  'Ametista',
  'Citrino',
  'Turmalina',
  'Turmalina Paraíba',
  'Turmalina verde',
  'Turmalina rosa',
  'Turmalina melancia',
  'Granada',
  'Granada rodolita',
  'Granada tsavorita',
  'Opala',
  'Opala de fogo',
  'Pérola',
  'Pérola cultivada',
  'Pérola barroca',
  'Ônix',
  'Ágata',
  'Ágata azul',
  'Quartzo',
  'Quartzo rosa',
  'Quartzo fumê',
  'Quartzo verde (prasiolita)',
  'Quartzo rutilado',
  'Cristal (quartzo hialino)',
  'Zircônia',
  'Zircão',
  'Peridoto',
  'Tanzanita',
  'Alexandrita',
  'Morganita',
  'Kunzita',
  'Lápis-lazúli',
  'Malaquita',
  'Turquesa',
  'Coral',
  'Âmbar',
  'Jade',
  'Madrepérola',
  'Olho de tigre',
  'Aventurina',
  'Cornalina',
  'Crisoprásio',
  'Crisoberilo',
  'Espinélio',
  'Heliodoro',
  'Iolita',
  'Labradorita',
  'Pedra da lua',
  'Pedra do sol',
  'Rubelita',
  'Sodalita',
  'Berilo',
  'Andaluzita',
  'Apatita',
  'Fluorita',
  'Amazonita',
  'Hematita',
  'Pirita',
  'Granada demantoide',
  'Rodocrosita',
  'Rodonita',
  ' Metralha (sem pedra)'.trim(),
  'Sem pedra',
]
