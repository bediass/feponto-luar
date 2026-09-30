/**
 * Cartão de garantia da Luar — emissão em PDF.
 *
 * Mesma ideia do certificado da Fê Ponto (150 × 100 mm, um cartão por peça
 * vendida), mas aqui a arte NÃO vem de um modelo pronto: o cartão é desenhado
 * inteiro em código, com a logo da Luar em marca d'água e o texto da garantia.
 * Sem arquivo de arte para manter, e o texto muda editando esta constante.
 *
 * Este módulo é a parte leve: texto, tipos, logo e download. O desenho mora em
 * `garantia-render.ts`, que puxa o pdf-lib (~350 KB) e só carrega quando
 * alguém vai emitir de fato.
 */

/** Prazo de garantia impresso no cartão. Mudou aqui, muda no texto e na conta. */
export const DIAS_GARANTIA = 90

/**
 * O texto do cartão, na íntegra e em um lugar só.
 * Cada item é um parágrafo; a quebra de linha é calculada na hora de desenhar,
 * conforme a largura do cartão.
 */
export const TEXTO_GARANTIA = [
  'Na Luar Acessórios, cada peça é cuidadosamente selecionada para oferecer qualidade, beleza e durabilidade.',
  `Por isso, oferecemos ${DIAS_GARANTIA} dias de garantia contra defeitos de fabricação, contados a partir da data da compra.`,
  'Nossa garantia não cobre danos decorrentes de mau uso, impactos, quedas, contato com produtos químicos, desgaste natural pelo uso, alterações realizadas por terceiros ou qualquer utilização em desacordo com os cuidados recomendados.',
  'Caso seja identificado um defeito de fabricação dentro do período de garantia, realizaremos a análise da peça e quando constatado o defeito, providenciaremos o reparo ou a substituição, conforme disponibilidade.',
  'Estamos comprometidos em proporcionar uma experiência de compra segura, transparente e à altura da qualidade que você merece.',
]

export interface DadosGarantia {
  /** Referência do pedido/venda — ex.: "#1042". */
  pedido: string
  /** Nome de quem comprou. */
  cliente: string
  /** Peça(s) cobertas. Linha opcional; vazio some do cartão. */
  pecas: string
  /** Data da compra, já formatada (dd/mm/aaaa). */
  dataCompra: string
  /** Fim da garantia, já formatado (dd/mm/aaaa). */
  validade: string
}

export interface GarantiaGerada {
  bytes: Uint8Array
  /** O que o desenho teve que ceder — a tela mostra em vez de entregar torto. */
  avisos: string[]
}

/**
 * A logo mora em `public/` do próprio sistema — é a mesma que já está pública
 * no site, então não há o que proteger aqui (diferente do modelo em branco do
 * certificado da Fê Ponto, que fica em bucket privado justamente por ser
 * falsificável). Baixa uma vez por sessão.
 */
const CAMINHO_LOGO = '/logo-luar.png'
let logoCache: ArrayBuffer | null = null

async function carregarLogo(): Promise<ArrayBuffer | null> {
  if (logoCache) return logoCache
  try {
    const resposta = await fetch(CAMINHO_LOGO)
    if (!resposta.ok) return null
    logoCache = await resposta.arrayBuffer()
    return logoCache
  } catch {
    // Marca d'água é decoração: sem ela o cartão sai igual, só sem o fundo.
    return null
  }
}

/** Soma os dias de garantia a uma data ISO e devolve dd/mm/aaaa. */
export function validadeGarantia(dataISO: string | null | undefined): string {
  const base = dataISO ? new Date(dataISO) : new Date()
  if (Number.isNaN(base.getTime())) return ''
  const fim = new Date(base)
  fim.setDate(fim.getDate() + DIAS_GARANTIA)
  return fim.toLocaleDateString('pt-BR')
}

/** Monta o PDF do cartão. */
export async function gerarCartaoGarantia(dados: DadosGarantia): Promise<GarantiaGerada> {
  const [logo, { renderizarGarantia }] = await Promise.all([
    carregarLogo(),
    import('./garantia-render'),
  ])
  return renderizarGarantia(dados, logo)
}

/** Nome de arquivo amigável, sem acento nem caractere problemático. */
export function nomeArquivoGarantia(cliente: string, referencia?: string): string {
  const limpar = (s: string) =>
    (s ?? '')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase()
  const partes = ['garantia-luar']
  const nome = limpar(cliente)
  const ref = limpar(referencia ?? '')
  if (nome) partes.push(nome)
  if (ref) partes.push(ref)
  return partes.join('-') + '.pdf'
}

function comoBlob(bytes: Uint8Array): Blob {
  return new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' })
}

/** Dispara o download do PDF no navegador. */
export function baixarPDF(bytes: Uint8Array, nomeArquivo: string) {
  const url = URL.createObjectURL(comoBlob(bytes))
  const a = document.createElement('a')
  a.href = url
  a.download = nomeArquivo
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** Abre o PDF numa nova aba (pra conferir antes de imprimir). */
export function abrirPDF(bytes: Uint8Array) {
  const url = URL.createObjectURL(comoBlob(bytes))
  const aba = window.open(url, '_blank')
  if (!aba) baixarPDF(bytes, 'garantia-luar.pdf')
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
