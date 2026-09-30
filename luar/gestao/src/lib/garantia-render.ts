import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import { TEXTO_GARANTIA, type DadosGarantia, type GarantiaGerada } from './garantia'

/**
 * Desenho do cartão de garantia da Luar.
 *
 * Módulo separado de propósito: o pdf-lib são ~350 KB e só fazem falta quando
 * alguém vai realmente emitir. O `garantia.ts` importa isso de forma dinâmica,
 * então o peso sai do bundle inicial do sistema.
 *
 * Cartão de 150 × 100 mm deitado — mesmo formato do certificado da Fê Ponto,
 * pra caber nas mesmas embalagens. Coordenadas em pontos (1 pt = 1/72"), com a
 * origem no canto INFERIOR esquerdo (é assim que o PDF conta).
 *
 * O corpo do texto se ajusta sozinho: mede a altura necessária e encolhe a
 * fonte até caber. Assim mudar o texto da garantia ou um nome comprido de
 * cliente nunca faz o cartão transbordar sem ninguém perceber.
 */

const MM = 2.834645
const LARGURA = 150 * MM // 425,197 pt
const ALTURA = 100 * MM // 283,465 pt
const MARGEM = 9 * MM // 25,5 pt

/** Paleta da marca — identidade/design-guide.md. */
const FENDI = rgb(0xbd / 255, 0x9f / 255, 0x7b / 255)
const TEXTO = rgb(0x22 / 255, 0x1f / 255, 0x1b / 255)
const SECUNDARIO = rgb(0x7a / 255, 0x74 / 255, 0x6b / 255)
const HAIRLINE = rgb(0xe7 / 255, 0xe0 / 255, 0xd4 / 255)

const CORPO_MAXIMO = 7.5
const CORPO_MINIMO = 5.5
const ENTRELINHA = 1.45 // múltiplo do corpo
const ESPACO_PARAGRAFO = 4.5

const SITE = 'luaracessoriosbh.com.br'

/**
 * As fontes padrão do PDF usam WinAnsi, que cobre o português mas não emoji,
 * aspas curvas e afins — e o pdf-lib estoura ao escrever o que não cabe na
 * codificação. Troca o que dá e descarta o resto.
 */
export function normalizar(texto: string): string {
  return (texto ?? '')
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”‟]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/\s+/g, ' ')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '')
    .trim()
}

/**
 * Largura de um texto com espaçamento extra entre letras.
 * O pdf-lib 1.17 não tem `characterSpacing`, e o guia da marca pede rótulo em
 * maiúscula com tracking ("cara de boutique") — então desenhamos letra a letra.
 */
function larguraComTracking(texto: string, fonte: PDFFont, tamanho: number, tracking: number) {
  return fonte.widthOfTextAtSize(texto, tamanho) + Math.max(0, texto.length - 1) * tracking
}

function escreverComTracking(
  pagina: PDFPage,
  texto: string,
  opcoes: { x: number; y: number; size: number; font: PDFFont; color: ReturnType<typeof rgb>; tracking: number },
) {
  let x = opcoes.x
  for (const letra of texto) {
    pagina.drawText(letra, { x, y: opcoes.y, size: opcoes.size, font: opcoes.font, color: opcoes.color })
    x += opcoes.font.widthOfTextAtSize(letra, opcoes.size) + opcoes.tracking
  }
}

/** Quebra o parágrafo em linhas que cabem na largura, medindo na fonte real. */
function quebrarLinhas(texto: string, fonte: PDFFont, tamanho: number, largura: number): string[] {
  const palavras = normalizar(texto).split(' ').filter(Boolean)
  const linhas: string[] = []
  let atual = ''
  for (const palavra of palavras) {
    const tentativa = atual ? `${atual} ${palavra}` : palavra
    if (fonte.widthOfTextAtSize(tentativa, tamanho) <= largura) {
      atual = tentativa
      continue
    }
    if (atual) linhas.push(atual)
    // Palavra sozinha maior que a linha (URL, código): entra assim mesmo,
    // encolher a fonte já é o remédio geral e cortar seria pior.
    atual = palavra
  }
  if (atual) linhas.push(atual)
  return linhas
}

/** Altura que os parágrafos ocupam em determinado corpo. */
function alturaDoTexto(
  paragrafos: string[],
  fonte: PDFFont,
  tamanho: number,
  largura: number,
): { linhas: string[][]; altura: number } {
  const linhas = paragrafos.map((p) => quebrarLinhas(p, fonte, tamanho, largura))
  const total = linhas.reduce((soma, l) => soma + l.length, 0)
  const altura = total * tamanho * ENTRELINHA + (linhas.length - 1) * ESPACO_PARAGRAFO
  return { linhas, altura }
}

/** Rótulo em maiúsculas + valor, como no rodapé do cartão. */
function escreverCampo(
  pagina: PDFPage,
  fontes: { titulo: PDFFont; corpo: PDFFont },
  x: number,
  y: number,
  rotulo: string,
  valor: string,
  larguraMaxima: number,
  /** Ancora pela direita (x vira a borda direita) — usado na última coluna. */
  aDireita = false,
) {
  const ROTULO = 5.5
  const TRACKING = 0.8
  const textoRotulo = normalizar(rotulo).toUpperCase()
  const larguraRotulo = larguraComTracking(textoRotulo, fontes.corpo, ROTULO, TRACKING)
  escreverComTracking(pagina, textoRotulo, {
    x: aDireita ? x - larguraRotulo : x,
    y,
    size: ROTULO,
    font: fontes.corpo,
    color: SECUNDARIO,
    tracking: TRACKING,
  })
  let texto = normalizar(valor)
  let tamanho = 8
  while (tamanho > 6 && fontes.titulo.widthOfTextAtSize(texto, tamanho) > larguraMaxima) {
    tamanho -= 0.25
  }
  // Ainda não coube: corta e marca com reticências, senão o nome some no meio
  // da palavra e parece que o sistema errou.
  if (fontes.titulo.widthOfTextAtSize(texto, tamanho) > larguraMaxima) {
    while (texto.length > 1 && fontes.titulo.widthOfTextAtSize(texto + '...', tamanho) > larguraMaxima) {
      texto = texto.slice(0, -1)
    }
    texto = texto.trimEnd() + '...'
  }
  const larguraValor = fontes.titulo.widthOfTextAtSize(texto, tamanho)
  pagina.drawText(texto, {
    x: aDireita ? x - larguraValor : x,
    y: y - tamanho - 1.5,
    size: tamanho,
    font: fontes.titulo,
    color: TEXTO,
  })
}

/** Desenha o cartão e devolve o PDF pronto. */
export async function renderizarGarantia(
  dados: DadosGarantia,
  logo: ArrayBuffer | null,
): Promise<GarantiaGerada> {
  const pdf = await PDFDocument.create()
  const pagina = pdf.addPage([LARGURA, ALTURA])
  const avisos: string[] = []

  const titulo = await pdf.embedFont(StandardFonts.TimesRoman)
  const corpo = await pdf.embedFont(StandardFonts.Helvetica)
  const fontes = { titulo, corpo }

  const larguraUtil = LARGURA - MARGEM * 2

  // ── Marca d'água: logo grande, centralizada e bem apagada, atrás de tudo ──
  if (logo) {
    try {
      const img = await pdf.embedPng(logo)
      const largura = LARGURA * 0.66
      const escala = largura / img.width
      const altura = img.height * escala
      // Opacidade baixa o bastante pra não brigar com o texto e alta o bastante
      // pra sobreviver à impressão — o Fendi já é uma cor clara.
      pagina.drawImage(img, {
        x: (LARGURA - largura) / 2,
        y: (ALTURA - altura) / 2,
        width: largura,
        height: altura,
        opacity: 0.14,
      })
    } catch {
      avisos.push('Não consegui usar a logo como marca d’água — o cartão saiu sem o fundo.')
    }
  } else {
    avisos.push('A logo não carregou — o cartão saiu sem a marca d’água.')
  }

  // ── Cabeçalho ──
  let y = ALTURA - MARGEM
  pagina.drawRectangle({ x: MARGEM, y: y - 1, width: 34, height: 1, color: FENDI })
  y -= 9
  const TITULO = 17
  pagina.drawText('Garantia', {
    x: MARGEM,
    y: y - TITULO,
    size: TITULO,
    font: titulo,
    color: TEXTO,
  })
  y -= TITULO + 13

  // ── Rodapé: ancorado na base, cresce pra cima. Alturas fixas aqui em cima
  //    porque o corpo do texto precisa saber quanto sobra antes de ser medido.
  const temPecas = !!normalizar(dados.pecas)
  const Y_SITE = MARGEM - 4
  const Y_VALOR = MARGEM + 18 // linha dos valores (Pedido, Cliente, datas)
  const Y_ROTULO = Y_VALOR + 9.5 // rótulos logo acima dos valores
  const Y_FILETE = Y_ROTULO + 9
  const Y_PECAS = Y_FILETE + 19 // rótulo "Peça(s)", quando existe
  const alturaRodape = (temPecas ? Y_PECAS + 6 : Y_FILETE + 6) - MARGEM

  const disponivelTexto = y - (MARGEM + alturaRodape)

  // Encolhe o corpo até o texto caber na área livre.
  let tamanho = CORPO_MAXIMO
  let medida = alturaDoTexto(TEXTO_GARANTIA, corpo, tamanho, larguraUtil)
  while (tamanho > CORPO_MINIMO && medida.altura > disponivelTexto) {
    tamanho -= 0.25
    medida = alturaDoTexto(TEXTO_GARANTIA, corpo, tamanho, larguraUtil)
  }
  if (medida.altura > disponivelTexto) {
    avisos.push('O texto da garantia ficou grande demais para o cartão — reveja o texto em garantia.ts.')
  }

  const entrelinha = tamanho * ENTRELINHA
  for (const linhas of medida.linhas) {
    for (const linha of linhas) {
      y -= entrelinha
      pagina.drawText(linha, { x: MARGEM, y, size: tamanho, font: corpo, color: TEXTO })
    }
    y -= ESPACO_PARAGRAFO
  }

  // ── Rodapé: peça(s) e os dados da compra ──
  if (temPecas) {
    escreverCampo(pagina, fontes, MARGEM, Y_PECAS, 'Peça(s)', dados.pecas, larguraUtil)
  }

  pagina.drawLine({
    start: { x: MARGEM, y: Y_FILETE },
    end: { x: LARGURA - MARGEM, y: Y_FILETE },
    thickness: 0.6,
    color: HAIRLINE,
  })

  // Colunas proporcionais: nome de cliente é o que mais varia de tamanho, e
  // dividir em quatro partes iguais cortava "Maria Fernanda Rodrigues" no meio.
  // A última ancora na margem direita pra linha fechar de ponta a ponta.
  const campos: [string, string, number][] = [
    ['Pedido', dados.pedido, 0.17],
    ['Cliente', dados.cliente, 0.42],
    ['Compra', dados.dataCompra, 0.21],
    ['Garantia até', dados.validade, 0.2],
  ]
  let xCampo = MARGEM
  campos.forEach(([rotulo, valor, fracao], i) => {
    const largura = larguraUtil * fracao
    const ultimo = i === campos.length - 1
    if (normalizar(valor)) {
      escreverCampo(
        pagina,
        fontes,
        ultimo ? LARGURA - MARGEM : xCampo,
        Y_ROTULO,
        rotulo,
        valor,
        largura - 8,
        ultimo,
      )
    }
    xCampo += largura
  })

  // Assinatura discreta no rodapé
  const larguraSite = larguraComTracking(SITE, corpo, 6, 0.6)
  escreverComTracking(pagina, SITE, {
    x: LARGURA - MARGEM - larguraSite,
    y: Y_SITE,
    size: 6,
    font: corpo,
    color: SECUNDARIO,
    tracking: 0.6,
  })

  pdf.setTitle(`Garantia — ${normalizar(dados.cliente) || 'Luar Acessórios'}`)
  pdf.setAuthor('Luar Acessórios')
  pdf.setSubject('Cartão de garantia')
  pdf.setProducer('Luar Acessórios — sistema de gestão')
  pdf.setCreator('Luar Acessórios — sistema de gestão')

  return { bytes: await pdf.save(), avisos }
}
