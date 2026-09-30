/* Markup (MK): o multiplicador sobre o custo que define o preço de venda.
 *
 * REGRAS ACERTADAS COM O BERNARDO EM 03/08/2026
 *   - peça nova nasce com MK 2,2
 *   - o preço arredonda PRA CIMA, em múltiplos de R$ 5
 *   - peça que já existe não tem preço mexido: o MK dela foi lido do preço que
 *     ela já tinha (migração 0019)
 *
 * POR QUE ARREDONDA PRA CIMA
 *   Pra baixo o preço cairia abaixo da margem pedida. E de R$ 5 em R$ 5 porque
 *   a loja inteira já é assim: 101 dos 102 preços de hoje são múltiplos de R$ 10.
 *
 * ONDE ISSO RODA
 *   Só na tela do catálogo, quando a Luana mexe no custo ou no MK. Não existe
 *   trigger no banco fazendo isso: reescrever preço a cada UPDATE remarcaria a
 *   loja sem ninguém pedir. Ver o cabeçalho de supabase/migrations/0019_markup.sql.
 */

import { parseCentavos, centavosParaInput } from './format'

/** MK que vem preenchido numa peça nova. */
export const MARKUP_PADRAO = 2.2

/** Atalhos de um clique no formulário. */
export const MARKUPS_RAPIDOS = [2.0, 2.2, 2.5]

/** Degrau do arredondamento, em centavos. R$ 5,00. */
export const PASSO_CENTAVOS = 500

/**
 * Preço de venda a partir do custo e do MK, arredondado pra cima no degrau.
 * Devolve 0 quando falta custo ou MK, que é o sinal de "não dá pra calcular".
 */
export function precoPorMarkup(custoCentavos: number, markup: number): number {
  if (!Number.isFinite(custoCentavos) || !Number.isFinite(markup)) return 0
  if (custoCentavos <= 0 || markup <= 0) return 0
  // Fecha em centavos inteiros ANTES do teto. Sem isso, 2500 x 2,0 vira
  // 5000.0000000001 em ponto flutuante, o ceil enxerga o degrau seguinte e o
  // preço sobe R$ 5 sozinho.
  const bruto = Math.round(custoCentavos * markup)
  return Math.ceil(bruto / PASSO_CENTAVOS) * PASSO_CENTAVOS
}

/**
 * O caminho inverso: qual MK o preço digitado representa.
 * Serve pra quando a Luana escreve o preço na mão e a tela precisa mostrar a
 * margem real daquela peça. Null quando não há custo pra dividir.
 */
export function markupPorPreco(custoCentavos: number, precoCentavos: number): number | null {
  if (!Number.isFinite(custoCentavos) || !Number.isFinite(precoCentavos)) return null
  if (custoCentavos <= 0 || precoCentavos <= 0) return null
  // 6 casas, igual à coluna do banco. Menos que isso e recalcular a peça
  // empurra o preço um degrau de R$ 5 pra cima. Ver 0019_markup.sql.
  return Math.round((precoCentavos / custoCentavos) * 1e6) / 1e6
}

/** "2,2" -> 2.2. Aceita vírgula e ponto. 0 quando não dá pra ler. */
export function parseMarkup(texto: string): number {
  if (!texto) return 0
  const n = Number(String(texto).replace(',', '.').replace(/[^\d.]/g, ''))
  return Number.isFinite(n) ? n : 0
}

/** 2.2 -> "2,2"; 1.666667 -> "1,67" (na tela não precisa das 6 casas). */
export function formatMarkup(markup: number | null | undefined): string {
  if (typeof markup !== 'number' || !Number.isFinite(markup) || markup <= 0) return ''
  return markup.toFixed(2).replace(/0$/, '').replace(/[.,]$/, '').replace('.', ',')
}

/** Margem sobre o preço de venda, em %. MK 2,0 = 50% de margem. */
export function margemPercentual(custoCentavos: number, precoCentavos: number): number | null {
  if (custoCentavos <= 0 || precoCentavos <= 0) return null
  return Math.round(((precoCentavos - custoCentavos) / precoCentavos) * 100)
}

/* ---------------------------------------------------------------------------
   O trio custo / MK / preço do formulário.
   Mora aqui, e não dentro do Catalogo.tsx, pra poder ser testado sem navegador
   e sem login. A tela só chama estas funções e joga o resultado no setForm.
   --------------------------------------------------------------------------- */

export type TrioPreco = { custo: string; markup: string; preco: string }

/** Mexeu no custo: o preço se refaz pelo MK que está no campo. */
export function aoMudarCusto(t: TrioPreco, custo: string): TrioPreco {
  const novo = precoPorMarkup(parseCentavos(custo), parseMarkup(t.markup))
  return { ...t, custo, preco: novo > 0 ? centavosParaInput(novo) : t.preco }
}

/** Mexeu no MK: o preço se refaz pelo custo que está no campo. */
export function aoMudarMarkup(t: TrioPreco, markup: string): TrioPreco {
  const novo = precoPorMarkup(parseCentavos(t.custo), parseMarkup(markup))
  return { ...t, markup, preco: novo > 0 ? centavosParaInput(novo) : t.preco }
}

/** Escreveu o preço na mão: o MK passa a mostrar a margem real daquele preço. */
export function aoMudarPreco(t: TrioPreco, preco: string): TrioPreco {
  const mk = markupPorPreco(parseCentavos(t.custo), parseCentavos(preco))
  return { ...t, preco, markup: mk === null ? t.markup : formatMarkup(mk) }
}

/**
 * Qual MK vai pro banco na hora de salvar.
 * Se o preço do campo é exatamente o que o MK digitado produz, ela escolheu o
 * MK e é ele que vale (2,2 continua 2,2). Se ela sobrescreveu o preço na mão,
 * vale o MK real daquele preço, com as 6 casas.
 * Nos dois casos vale a invariante que segura o catálogo:
 *     precoPorMarkup(custo, markupParaSalvar(...)) === preço gravado
 * Sem ela, recalcular a peça depois empurra o preço um degrau de R$ 5 pra cima.
 */
export function markupParaSalvar(t: TrioPreco): number | null {
  const custo = parseCentavos(t.custo)
  const preco = parseCentavos(t.preco)
  if (custo <= 0) return null
  const digitado = parseMarkup(t.markup)
  if (digitado > 0 && precoPorMarkup(custo, digitado) === preco) return digitado
  return markupPorPreco(custo, preco)
}

/* ---------------------------------------------------------------------------
   Aplicar um MK em várias peças de uma vez.

   POR QUE ISSO É PLANEJADO ANTES DE GRAVAR
   O preço da loja é valor gravado: assim que o UPDATE passa, o site mostra o
   preço novo. Não existe desfazer. Então a tela primeiro monta o plano, mostra
   pra Luana o que muda peça por peça, e só grava depois do "confirmar".

   O QUE FICA DE FORA, E POR QUÊ
   Peça sem custo não entra: sem custo não há conta, e inventar preço a partir
   de nada seria pior que não fazer nada. Peça cujo preço já é o que o MK produz
   também não entra — evita UPDATE à toa numa linha que não muda de valor.
   --------------------------------------------------------------------------- */

export type PecaRemarcavel = {
  id: string
  nome: string
  custo_centavos: number | null
  preco_centavos: number
  markup: number | null
}

export type LinhaPlano = {
  id: string
  nome: string
  custoCentavos: number
  markupAtual: number | null
  precoAtual: number
  precoNovo: number
}

export type PlanoRemarcacao = {
  /** As que vão ser gravadas. */
  mudam: LinhaPlano[]
  /** Já estão no preço que o MK produz: nada a fazer. */
  iguais: LinhaPlano[]
  /** Sem custo cadastrado: impossível calcular. */
  semCusto: { id: string; nome: string }[]
}

/** Monta o plano sem tocar no banco. MK inválido devolve plano vazio. */
export function planejarRemarcacao(pecas: PecaRemarcavel[], markup: number): PlanoRemarcacao {
  const plano: PlanoRemarcacao = { mudam: [], iguais: [], semCusto: [] }
  if (!Number.isFinite(markup) || markup <= 0) {
    for (const p of pecas) plano.semCusto.push({ id: p.id, nome: p.nome })
    return plano
  }
  for (const p of pecas) {
    const custo = p.custo_centavos ?? 0
    const precoNovo = precoPorMarkup(custo, markup)
    if (custo <= 0 || precoNovo <= 0) {
      plano.semCusto.push({ id: p.id, nome: p.nome })
      continue
    }
    const linha: LinhaPlano = {
      id: p.id,
      nome: p.nome,
      custoCentavos: custo,
      markupAtual: p.markup,
      precoAtual: p.preco_centavos,
      precoNovo,
    }
    // O MK também é reescrito, então "igual" exige os dois batendo: peça com o
    // preço certo mas MK errado no banco precisa do UPDATE pra ficar coerente.
    if (linha.precoAtual === precoNovo && p.markup === markup) plano.iguais.push(linha)
    else plano.mudam.push(linha)
  }
  return plano
}
