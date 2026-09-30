import {
  precoPorMarkup, markupPorPreco, parseMarkup, formatMarkup, MARKUP_PADRAO, PASSO_CENTAVOS,
  MARKUPS_RAPIDOS, planejarRemarcacao, type PecaRemarcavel,
} from '../src/lib/preco'

let falhas = 0
function eq(nome: string, obtido: unknown, esperado: unknown) {
  const ok = obtido === esperado
  if (!ok) falhas++
  console.log(`${ok ? 'OK  ' : 'FALHOU'}  ${nome}  ->  ${obtido}${ok ? '' : `  (esperado ${esperado})`}`)
}
const brl = (c: number) => 'R$ ' + (c / 100).toFixed(2).replace('.', ',')

console.log('== arredondamento pra cima, multiplos de R$ 5 ==')
eq('custo 22,40 x 2,2 = 49,28 -> 50,00', brl(precoPorMarkup(2240, 2.2)), brl(5000))
eq('custo 25,00 x 2,0 = 50,00 -> 50,00 (ja e multiplo, nao sobe)', brl(precoPorMarkup(2500, 2.0)), brl(5000))
eq('custo 61,00 x 2,2 = 134,20 -> 135,00', brl(precoPorMarkup(6100, 2.2)), brl(13500))
eq('custo 10,00 x 2,0 = 20,00 -> 20,00', brl(precoPorMarkup(1000, 2.0)), brl(2000))
eq('custo 10,01 x 2,0 = 20,02 -> 25,00', brl(precoPorMarkup(1001, 2.0)), brl(2500))
eq('custo 0 -> 0 (nao da pra calcular)', precoPorMarkup(0, 2.2), 0)
eq('markup 0 -> 0', precoPorMarkup(1000, 0), 0)
eq('custo negativo -> 0', precoPorMarkup(-100, 2.2), 0)
eq('NaN -> 0', precoPorMarkup(NaN, 2.2), 0)

console.log('\n== a armadilha do ponto flutuante ==')
// 2500 * 2.0 da 5000.0000000001 em float; sem o Math.round o ceil sobe R$ 5
for (const [c, m] of [[2500, 2.0], [5000, 2.2], [1500, 2.0], [12000, 2.2], [7500, 2.0]] as const) {
  const p = precoPorMarkup(c, m)
  const exato = c * m
  const ok = p >= exato && p - exato < PASSO_CENTAVOS
  if (!ok) falhas++
  console.log(`${ok ? 'OK  ' : 'FALHOU'}  ${brl(c)} x ${m} = ${brl(Math.round(exato))} -> ${brl(p)}`)
}

console.log('\n== ida e volta: gravar o MK e recalcular NAO pode mexer no preco ==')
// e a invariante que segura o catalogo inteiro
let idaVolta = 0
for (let custo = 500; custo <= 60000; custo += 137) {
  for (const mk of [1.6667, 1.75, 2.0, 2.2, 2.5, 3.0]) {
    const preco = precoPorMarkup(custo, mk)
    const mkGravado = markupPorPreco(custo, preco)!
    const recalculado = precoPorMarkup(custo, mkGravado)
    if (recalculado !== preco) {
      falhas++; idaVolta++
      if (idaVolta < 4) console.log(`FALHOU  custo ${brl(custo)} mk ${mk}: ${brl(preco)} -> ${brl(recalculado)}`)
    }
  }
}
eq(`ida e volta em ${Math.floor((60000 - 500) / 137 + 1) * 6} combinacoes`, idaVolta, 0)

console.log('\n== leitura e escrita do campo ==')
eq('parseMarkup("2,2")', parseMarkup('2,2'), 2.2)
eq('parseMarkup("2.2")', parseMarkup('2.2'), 2.2)
eq('parseMarkup("")', parseMarkup(''), 0)
eq('parseMarkup("abc")', parseMarkup('abc'), 0)
eq('formatMarkup(2.2)', formatMarkup(2.2), '2,2')
eq('formatMarkup(2)', formatMarkup(2), '2,0')
eq('formatMarkup(1.666667)', formatMarkup(1.666667), '1,67')
eq('formatMarkup(null)', formatMarkup(null), '')
eq('padrao e 2,2', formatMarkup(MARKUP_PADRAO), '2,2')


/* ---- o trio do formulario, chamando as funcoes de verdade ---- */
import { aoMudarCusto, aoMudarMarkup, aoMudarPreco, markupParaSalvar, type TrioPreco } from '../src/lib/preco'

console.log('\n== o formulario: custo -> MK -> preco ==')
let f: TrioPreco = { custo: '', markup: '2,2', preco: '' }
let f2 = 0
function passo(nome: string, novo: TrioPreco, custo: string, markup: string, preco: string) {
  const ok = novo.custo === custo && novo.markup === markup && novo.preco === preco
  if (!ok) f2++
  console.log(`${ok ? 'OK  ' : 'FALHOU'}  ${nome}  ->  custo ${novo.custo || '-'} | MK ${novo.markup || '-'} | preco ${novo.preco || '-'}`)
  if (!ok) console.log(`        esperado: custo ${custo} | MK ${markup} | preco ${preco}`)
  return novo
}

f = passo('peca nova, digita custo 22,40', aoMudarCusto(f, '22,40'), '22,40', '2,2', '50,00')
f = passo('troca o MK pra 2,0', aoMudarMarkup(f, '2,0'), '22,40', '2,0', '45,00')
f = passo('escreve preco 60,00 na mao', aoMudarPreco(f, '60,00'), '22,40', '2,68', '60,00')
console.log(`      MK que vai pro banco: ${markupParaSalvar(f)} (real, 6 casas)`)

console.log('\n== peca antiga: abrir e salvar sem mexer NAO pode mudar o preco ==')
// Colar Terco de verdade: preco 240,00 e o custo que resulta no MK gravado
const antiga: TrioPreco = { custo: '144,00', markup: '1,67', preco: '240,00' }
const mkSalvo = markupParaSalvar(antiga)!
const precoDepois = precoPorMarkup(14400, mkSalvo)
const okAntiga = precoDepois === 24000
if (!okAntiga) f2++
console.log(`${okAntiga ? 'OK  ' : 'FALHOU'}  abre com MK 1,67 na tela, grava ${mkSalvo}, recalcula -> ${brl(precoDepois)} (era R$ 240,00)`)

console.log('\n== escolher 2,2 no botao grava 2,2, nao 2,222222 ==')
const escolhido: TrioPreco = aoMudarCusto({ custo: '', markup: '2,2', preco: '' }, '50,00')
const mkEscolhido = markupParaSalvar(escolhido)
const okEsc = mkEscolhido === 2.2
if (!okEsc) f2++
console.log(`${okEsc ? 'OK  ' : 'FALHOU'}  custo 50,00 MK 2,2 -> preco ${escolhido.preco}, grava MK ${mkEscolhido}`)

console.log('\n== sem custo nao inventa MK ==')
const semCusto: TrioPreco = { custo: '', markup: '2,2', preco: '99,00' }
const okSem = markupParaSalvar(semCusto) === null
if (!okSem) f2++
console.log(`${okSem ? 'OK  ' : 'FALHOU'}  markupParaSalvar sem custo -> ${markupParaSalvar(semCusto)}`)

console.log('')
console.log('== aplicar MK em lote: o plano decide o que grava ==')
const lote: PecaRemarcavel[] = [
  { id: 'a', nome: 'Brinco', custo_centavos: 2240, preco_centavos: 4500, markup: 2.0 },
  { id: 'b', nome: 'Colar sem custo', custo_centavos: null, preco_centavos: 9000, markup: null },
  { id: 'c', nome: 'Anel ja no preco', custo_centavos: 2500, preco_centavos: 5500, markup: 2.2 },
  { id: 'd', nome: 'Pulseira custo zero', custo_centavos: 0, preco_centavos: 3000, markup: null },
  { id: 'e', nome: 'Tornozeleira', custo_centavos: 6100, preco_centavos: 12000, markup: 1.967213 },
]
const plano = planejarRemarcacao(lote, 2.2)
eq('2 pecas mudam', plano.mudam.length, 2)
eq('1 peca ja esta no preco', plano.iguais.length, 1)
eq('2 pecas sem custo ficam de fora', plano.semCusto.length, 2)
eq('a que fica parada e o Anel', plano.iguais[0]?.id, 'c')
eq('Brinco 22,40 x 2,2 -> 50,00', brl(plano.mudam.find((l) => l.id === 'a')!.precoNovo), brl(5000))

console.log('')
console.log('== preco certo mas MK errado no banco ainda precisa gravar ==')
// Se o plano deixasse essa de fora, a peca ficaria com o preco de 2,2 e o MK
// dizendo 1,9: a coluna MK da lista mentiria pra sempre.
const desalinhada = planejarRemarcacao(
  [{ id: 'x', nome: 'Desalinhada', custo_centavos: 2500, preco_centavos: 5500, markup: 1.9 }],
  2.2,
)
eq('entra no lote mesmo com o preco ja igual', desalinhada.mudam.length, 1)

console.log('')
console.log('== aplicar duas vezes o mesmo MK nao mexe em nada na segunda ==')
const depois: PecaRemarcavel[] = plano.mudam.map((l) => ({
  id: l.id, nome: l.nome, custo_centavos: l.custoCentavos, preco_centavos: l.precoNovo, markup: 2.2,
}))
eq('segunda passada nao grava ninguem', planejarRemarcacao(depois, 2.2).mudam.length, 0)

console.log('')
console.log('== MK invalido nao grava nada ==')
for (const mk of [0, -1, NaN]) {
  const pl = planejarRemarcacao(lote, mk)
  const ok = pl.mudam.length === 0 && pl.iguais.length === 0
  if (!ok) f2++
  console.log(`${ok ? 'OK  ' : 'FALHOU'}  MK ${mk} -> ${pl.mudam.length} gravacao(oes)`)
}

console.log('')
console.log('== atalhos do formulario ==')
eq('2,5 entrou nos atalhos', MARKUPS_RAPIDOS.join('/'), [2.0, 2.2, 2.5].join('/'))

console.log('\n' + (falhas + f2 === 0 ? 'TUDO PASSOU' : `${falhas + f2} FALHAS`))
process.exit(falhas + f2 === 0 ? 0 : 1)
