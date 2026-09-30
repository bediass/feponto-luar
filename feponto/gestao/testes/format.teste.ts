import { parseValor, formatValorEditavel } from '../src/lib/format'
import { unidadeTamanho, ehAlianca, arredondarIndice, indiceAutomatico, custoDaPeca } from '../src/lib/joias'

let falhas = 0
function eq(nome: string, obtido: unknown, esperado: unknown) {
  const ok = obtido === esperado
  if (!ok) falhas++
  console.log(`${ok ? 'OK  ' : 'FALHOU'}  ${nome}  ->  ${JSON.stringify(obtido)}${ok ? '' : `  (esperado ${JSON.stringify(esperado)})`}`)
}

console.log('== parseValor: o jeito brasileiro, que ja funcionava ==')
eq('"1.234,50" -> 1234.5', parseValor('1.234,50'), 1234.5)
eq('"345,53" -> 345.53', parseValor('345,53'), 345.53)
eq('"0,01" -> 0.01', parseValor('0,01'), 0.01)
eq('"1.234.567,89" -> 1234567.89', parseValor('1.234.567,89'), 1234567.89)
eq('"1.234" (3 casas, milhar) -> 1234', parseValor('1.234'), 1234)
eq('"" -> 0', parseValor(''), 0)
eq('"abc" -> 0', parseValor('abc'), 0)
eq('"R$ 345,53" (com simbolo) -> 345.53', parseValor('R$ 345,53'), 345.53)

console.log('\n== parseValor: o teclado numerico do Windows (era o bug) ==')
// A versao antiga jogava o ponto fora SEMPRE: "345.53" virava 34553, e a peca
// saia com cotacao 100x maior. Ninguem digita "3.5" querendo 35.
eq('"345.53" -> 345.53 (nao 34553)', parseValor('345.53'), 345.53)
eq('"3.5" -> 3.5 (nao 35)', parseValor('3.5'), 3.5)
eq('"0.5" -> 0.5', parseValor('0.5'), 0.5)
eq('"-12.75" -> -12.75', parseValor('-12.75'), -12.75)
eq('"12.500" (3 casas: milhar, como antes) -> 12500', parseValor('12.500'), 12500)

console.log('\n== formatValorEditavel: o que o campo escreve ao perder o foco ==')
eq('"345.53" -> "345,53"', formatValorEditavel('345.53'), '345,53')
eq('"345,5" -> "345,50" (completa a casa)', formatValorEditavel('345,5'), '345,50')
eq('"1234" -> "1.234,00" (separa o milhar)', formatValorEditavel('1234'), '1.234,00')
eq('"1.234,5" -> "1.234,50"', formatValorEditavel('1.234,5'), '1.234,50')
eq('"" -> "" (campo vazio segue vazio)', formatValorEditavel(''), '')
eq('"   " -> ""', formatValorEditavel('   '), '')
eq('"abc" -> "" (sem digito, nao inventa zero)', formatValorEditavel('abc'), '')
eq('"0" -> "0,00" (zero digitado e um valor)', formatValorEditavel('0'), '0,00')

console.log('\n== ida e volta: formatar e reler NAO pode mudar o valor ==')
// E a invariante que importa: abrir uma peca, sair do campo e salvar tem que
// gravar o mesmo numero que estava no banco.
for (const n of [0.01, 1, 3.5, 345.53, 672.97, 1234.5, 5377.03, 1234567.89]) {
  const texto = n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const relido = parseValor(formatValorEditavel(texto))
  const ok = relido === n
  if (!ok) falhas++
  console.log(`${ok ? 'OK  ' : 'FALHOU'}  ${n} -> "${texto}" -> ${relido}`)
}

console.log('\n== familias novas: Pingentes e Escapularios (bloco-10) ==')
eq('Pingentes -> mm', unidadeTamanho('Pingentes').label, 'Medida (mm)')
eq('Escapularios -> cm', unidadeTamanho('Escapulários').label, 'Comprimento (cm)')
eq('Escapularios sem acento -> cm', unidadeTamanho('Escapularios').label, 'Comprimento (cm)')
eq('familia nova nao virou alianca', ehAlianca('Escapulários', 'Escapulários'), false)
eq('Pingentes nao virou alianca', ehAlianca('Pingentes', 'Pingentes'), false)
console.log('   (as familias antigas seguem iguais)')
eq('Aneis -> aro', unidadeTamanho('Anéis').label, 'Aro (nº)')
eq('Aliancas -> aro', unidadeTamanho('Alianças').label, 'Aro (nº)')
eq('Colares & Correntes -> cm', unidadeTamanho('Colares & Correntes').label, 'Comprimento (cm)')
eq('Brincos -> mm', unidadeTamanho('Brincos').label, 'Medida (mm)')
eq('Separadores -> genérico', unidadeTamanho('Separadores').label, 'Tamanho')

console.log('\n== taxonomia nova: 9 familias (bloco-11) ==')
// As tres familias que nasceram em 13/08/2026. So "Alfinetes" precisou de
// linha nova em unidadeTamanho(): as outras duas ja casavam por acidente feliz.
eq('Alfinetes -> mm', unidadeTamanho('Alfinetes').label, 'Medida (mm)')
eq('Tornozeleiras -> cm', unidadeTamanho('Tornozeleiras').label, 'Comprimento (cm)')
eq('Aliancas de casamento -> aro', unidadeTamanho('Alianças de casamento').label, 'Aro (nº)')
eq('Colares (nome novo da familia) -> cm', unidadeTamanho('Colares').label, 'Comprimento (cm)')
// A aliança é reconhecida pelo NOME, e os nomes mudaram: "Aliança" virou
// "Alianças inteiras" e "Meia Aliança" virou "Meias alianças". Se estes quatro
// falharem, o formulário do ERP para de oferecer os campos do par.
eq('familia nova de alianca', ehAlianca('Alianças inteiras', 'Alianças de casamento'), true)
eq('meia alianca com nome novo', ehAlianca('Meias alianças', 'Alianças de casamento'), true)
// As subcategorias de mesmo nome penduradas em Anéis: aliança-estilo, que
// tambem aceita par, mas navete e solitario nao.
eq('alianca dentro de Anéis', ehAlianca('Alianças inteiras', 'Anéis'), true)
eq('navete nao é alianca', ehAlianca('Navetes', 'Anéis'), false)
eq('solitario nao é alianca', ehAlianca('Solitários', 'Anéis'), false)
eq('alfinete nao é alianca', ehAlianca('Alfinetes', 'Alfinetes'), false)


console.log('\n== custo NAO segue o indice manual (bug de 12/08/2026) ==')
// O caso exato que a Fernanda reportou: peca de 2,4 g, MK de custo 1, cotacao de
// custo R$ 310/g. O custo tem que ser 744 e continuar 744 mesmo que ela digite
// indice 3,1 na precificacao para vender mais caro. Antes o custo era
// `indice x cotacao`, entao virava 961 e a margem mudava sozinha.
eq('2,4 g x MK 1 x R$ 310/g -> 744', custoDaPeca(2.4, 1, 310), 744)
eq('indice automatico da mesma peca -> 2,4', indiceAutomatico(2.4, 1), 2.4)
// custoDaPeca nem RECEBE indice: e a assinatura que garante a separacao.
eq('custo com MK 1,2 -> 892,8', custoDaPeca(2.4, 1.2, 310), 892.8)

console.log('\n== MK de custo ZERO e valido, e diferente de nao preenchido ==')
eq('MK 0 -> custo 0', custoDaPeca(2.4, 0, 310), 0)
eq('MK 0 -> indice 0', indiceAutomatico(2.4, 0), 0)
eq('MK null (nao preenchido) -> custo 0', custoDaPeca(2.4, null, 310), 0)
eq('MK null (nao preenchido) -> indice 0', indiceAutomatico(2.4, null), 0)
console.log('   (o formulario separa os dois: 0 grava 0, vazio grava null)')

console.log('\n== guardas: sem peso ou sem cotacao nao inventa numero ==')
eq('peso 0 -> custo 0', custoDaPeca(0, 1, 310), 0)
eq('cotacao 0 -> custo 0', custoDaPeca(2.4, 1, 0), 0)
eq('peso negativo -> custo 0', custoDaPeca(-1, 1, 310), 0)

console.log('\n== arredondarIndice: 4 casas, senao a peca cai em manual sozinha ==')
eq('3,5 x 1,2 = 4,2 (e nao 4,199999...)', arredondarIndice(3.5 * 1.2), 4.2)
eq('indiceAutomatico(3,5; 1,2) -> 4,2', indiceAutomatico(3.5, 1.2), 4.2)
eq('par: peso somado 4,8 x MK 1 -> 4,8', indiceAutomatico(4.8, 1), 4.8)

console.log(falhas === 0 ? '\nTUDO OK' : `\n${falhas} FALHA(S)`)
process.exit(falhas === 0 ? 0 : 1)
