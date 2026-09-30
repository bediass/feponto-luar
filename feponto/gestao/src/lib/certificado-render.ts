import {
  PDFDocument,
  PDFArray,
  PDFName,
  PDFRawStream,
  StandardFonts,
  decodePDFRawStream,
  rgb,
  type PDFPage,
  type PDFFont,
} from 'pdf-lib'
import type { CertificadoGerado, DadosCertificado } from './certificado'

/**
 * Desenho do certificado de garantia sobre o modelo original.
 *
 * Módulo separado de propósito: o pdf-lib são ~350 KB e só fazem falta quando
 * alguém vai realmente emitir um certificado. O `certificado.ts` importa isso
 * de forma dinâmica, então o peso sai do bundle inicial do sistema.
 *
 * O modelo (`public/certificado-modelo.pdf`, arte do Illustrator de 2020) tem
 * duas páginas: a 1ª é a capa (imagem) e a 2ª traz o texto da garantia com
 * campos em branco pra preencher à mão.
 *
 * Coordenadas em pontos (1pt = 1/72"), origem no canto inferior esquerdo,
 * lidas direto do content stream do modelo — por isso os valores "quebrados".
 * Página: 491,197 × 349,465 pt com sangria; a arte final é 425,197 × 283,465
 * (150 × 100 mm) começando em (33, 33).
 */

/** Área de arte (trim) do modelo — recorta sangria e marcas de corte. */
const ARTE = { x: 33, y: 33, largura: 425.197, altura: 283.465 }

/** Onde o texto do valor entra dentro da caixinha. */
const PADDING_CAIXA = 3.5
const BASELINE_CAIXA = 3.1

/** Corpo de texto do modelo (Gotham-Light 7pt). */
const CORPO = 7

/** Menor corpo que ainda se lê impresso num cartão de 15 × 10 cm. */
const CORPO_MINIMO = 5.5

/**
 * Os cinco campos do modelo impresso. Só escrevemos o valor dentro da
 * caixinha — nada é desenhado por cima da arte. `x`/`largura` vêm do path
 * original de cada retângulo.
 */
const CAMPOS_MODELO = {
  peca: { x: 77.545, y: 79.9909, largura: 136.181 },
  pedras: { x: 84.211, y: 64.7058, largura: 129.515 },
  codigo: { x: 86.138, y: 49.8484, largura: 127.588 },
  feponto: { x: 268.434, y: 80.2136, largura: 121.959 },
  data: { x: 254.211, y: 65.3562, largura: 136.182 },
} as const

/**
 * As fontes padrão do PDF usam WinAnsi, que não cobre tudo que pode vir do
 * banco (emoji, aspas curvas, símbolos). Troca o que dá e descarta o resto,
 * senão o pdf-lib estoura na hora de escrever.
 */
export function normalizar(texto: string): string {
  return (texto ?? '')
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”‟]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/\s+/g, ' ')
    // WinAnsi cobre ASCII imprimível + Latin-1 de \xA0 pra cima.
    // \x80-\x9F e o resto do Unicode caem fora e derrubariam o pdf-lib.
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '')
    .trim()
}

/**
 * Encolhe a fonte até o texto caber na largura da caixinha e, se ainda não
 * couber, corta com "…". Devolve também o que teve que ceder, pra tela poder
 * avisar em vez de entregar um certificado cortado sem ninguém perceber.
 */
function ajustarTexto(
  texto: string,
  fonte: PDFFont,
  largura: number,
): { texto: string; tamanho: number; cortado: boolean } {
  const limpo = normalizar(texto)
  let tamanho = CORPO
  while (tamanho > CORPO_MINIMO && fonte.widthOfTextAtSize(limpo, tamanho) > largura) {
    tamanho -= 0.25
  }
  if (fonte.widthOfTextAtSize(limpo, tamanho) <= largura) {
    return { texto: limpo, tamanho, cortado: false }
  }

  let corte = limpo
  while (corte.length > 1 && fonte.widthOfTextAtSize(corte + '…', tamanho) > largura) {
    corte = corte.slice(0, -1)
  }
  return { texto: corte.trimEnd() + '…', tamanho, cortado: true }
}

function escreverNaCaixa(
  pagina: PDFPage,
  fonte: PDFFont,
  campo: { x: number; y: number; largura: number },
  valor: string,
  rotulo: string,
  avisos: string[],
) {
  if (!valor?.trim()) return
  const disponivel = campo.largura - PADDING_CAIXA * 2
  const { texto, tamanho, cortado } = ajustarTexto(valor, fonte, disponivel)
  if (!texto) return
  if (cortado) avisos.push(`“${rotulo}” não caiu inteiro na linha e foi cortado.`)
  pagina.drawText(texto, {
    x: campo.x + PADDING_CAIXA,
    y: campo.y + BASELINE_CAIXA,
    size: tamanho,
    font: fonte,
    color: rgb(0, 0, 0),
  })
}

/**
 * A arte do Illustrator envolve tudo em camadas de conteúdo opcional
 * (`/OC /MC0 BDC … EMC`): "Camada 1" e "Marcas e sangrias". Ao copiar só uma
 * página pra um documento novo, o `/OCProperties` do catálogo fica atrás — e
 * marcador de camada sem camada declarada é comportamento indefinido pelo
 * spec. Como não queremos depender da boa vontade do leitor de PDF, achatamos:
 * tira os marcadores e o conteúdo passa a ser sempre visível. As marcas de
 * corte somem de outro jeito, pelo recorte na área de arte.
 */
function achatarCamadas(pdf: PDFDocument, pagina: PDFPage) {
  const contents = pagina.node.get(PDFName.of('Contents'))
  const refs = contents instanceof PDFArray ? contents.asArray() : contents ? [contents] : []

  const pedacos: string[] = []
  for (const ref of refs) {
    const stream = pdf.context.lookup(ref)
    if (!(stream instanceof PDFRawStream)) return // já é stream do pdf-lib, nada a fazer
    const bytes = decodePDFRawStream(stream).decode()
    pedacos.push(new TextDecoder('latin1').decode(bytes))
  }
  if (!pedacos.length) return

  const achatado = pedacos
    .join('\n')
    .replace(/\/OC\s*\/[A-Za-z0-9_]+\s+BDC/g, '')
    .replace(/(^|\s)EMC(?=\s|$)/g, '$1')

  const bytes = Uint8Array.from(achatado, (c) => c.charCodeAt(0) & 0xff)
  const novo = pdf.context.flateStream(bytes)
  pagina.node.set(PDFName.of('Contents'), pdf.context.register(novo))
}

/**
 * Cada página do modelo carrega um `/PieceInfo` com os dados privados de
 * round-trip do Illustrator — sozinhos, ~1,1 MB dos 1,2 MB do arquivo. Não
 * servem pra nada na hora de exibir ou imprimir, e sem eles o certificado sai
 * na casa das dezenas de KB, que é o que vai por WhatsApp.
 */
function limparDadosDoIllustrator(pagina: PDFPage) {
  pagina.node.delete(PDFName.of('PieceInfo'))
  pagina.node.delete(PDFName.of('LastModified'))
}

/** Preenche o modelo com os dados e devolve o PDF pronto. */
export async function renderizarCertificado(
  modelo: ArrayBuffer,
  dados: DadosCertificado,
): Promise<CertificadoGerado> {
  const original = await PDFDocument.load(modelo)

  if (original.getPageCount() < 2) {
    throw new Error('O modelo do certificado deveria ter 2 páginas (capa + garantia).')
  }

  // Tem que ser antes de copiar: o copiador segue as referências da página, e
  // o que ele arrastar pro documento novo fica lá pra sempre (o pdf-lib não
  // recolhe objeto órfão).
  for (const p of original.getPages()) limparDadosDoIllustrator(p)

  // Documento novo com só o que interessa: a 2ª página (a da garantia) e, se
  // pedido, a capa. Copiar em vez de apagar página deixa o arquivo pequeno e
  // não mexe na árvore de páginas do original.
  const pdf = await PDFDocument.create()
  const copiadas = await pdf.copyPages(original, dados.incluirCapa ? [0, 1] : [1])
  copiadas.forEach((p) => pdf.addPage(p))

  const pagina = pdf.getPage(dados.incluirCapa ? 1 : 0)
  for (const p of pdf.getPages()) achatarCamadas(pdf, p)

  const fonte = await pdf.embedFont(StandardFonts.Helvetica)
  const avisos: string[] = []

  escreverNaCaixa(pagina, fonte, CAMPOS_MODELO.peca, dados.peca, 'Peça', avisos)
  escreverNaCaixa(pagina, fonte, CAMPOS_MODELO.pedras, dados.pedras, 'Pedras', avisos)
  escreverNaCaixa(pagina, fonte, CAMPOS_MODELO.codigo, dados.codigo, 'Código', avisos)
  escreverNaCaixa(pagina, fonte, CAMPOS_MODELO.feponto, dados.feponto, 'Fê ponto', avisos)
  escreverNaCaixa(pagina, fonte, CAMPOS_MODELO.data, dados.data, 'Data', avisos)

  // Recorta na área de arte (150 × 100 mm): tira sangria e marcas de corte.
  for (const p of pdf.getPages()) {
    p.setMediaBox(ARTE.x, ARTE.y, ARTE.largura, ARTE.altura)
    p.setCropBox(ARTE.x, ARTE.y, ARTE.largura, ARTE.altura)
    p.setBleedBox(ARTE.x, ARTE.y, ARTE.largura, ARTE.altura)
    p.setTrimBox(ARTE.x, ARTE.y, ARTE.largura, ARTE.altura)
  }

  pdf.setTitle(`Certificado de garantia — ${normalizar(dados.cliente ?? '') || 'Fê Ponto Joias'}`)
  pdf.setAuthor('Fê Ponto Joias')
  pdf.setSubject('Certificado de garantia e autenticidade')
  pdf.setProducer('Fê Ponto Joias — sistema de gestão')
  pdf.setCreator('Fê Ponto Joias — sistema de gestão')

  return { bytes: await pdf.save(), avisos }
}
