import { supabase } from '@/lib/supabase'

/**
 * Certificado de garantia da Fê Ponto — emissão em PDF.
 *
 * Este módulo é a parte leve: busca o modelo, dispara download/abertura e monta
 * o nome do arquivo. O desenho em si mora em `certificado-render.ts`, que puxa
 * o pdf-lib e só é carregado quando alguém vai emitir de fato.
 *
 * O modelo NÃO fica em `public/`: ali seria arquivo estático servido sem login
 * pelo Cloudflare Pages, e o certificado em branco da marca ficaria aberto pra
 * download e falsificação. Ele mora em bucket privado do Supabase e é baixado
 * com a sessão do usuário — quem não está logado não passa do RLS.
 * Ver `sql/bloco-2-modelo-certificado-privado.sql`.
 */

// Nome igual ao do arquivo em `modelo/`, na raiz do bucket: o upload no painel
// vira arrastar e soltar, sem criar pasta nem renomear (onde é fácil errar e
// derrubar a emissão sem ninguém entender por quê).
const BUCKET_MODELO = 'documentos'
const CAMINHO_MODELO = 'certificado-modelo.pdf'

/**
 * Os cinco campos do modelo impresso, na ordem em que aparecem no cartão.
 * Nada além disso é escrito na arte.
 */
export interface DadosCertificado {
  /** Descrição da peça. */
  peca: string
  /** Pedras utilizadas. */
  pedras: string
  /** Código interno da peça. */
  codigo: string
  /** Campo "Fê ponto:" do modelo original. */
  feponto: string
  /** Data de emissão, já formatada (dd/mm/aaaa). */
  data: string
  /**
   * Nome do cliente. Só entra no título/metadados do arquivo pra facilitar o
   * arquivamento — não é impresso no certificado.
   */
  cliente?: string
  /** Anexa também a capa (1ª página) do modelo. */
  incluirCapa?: boolean
}

export interface CertificadoGerado {
  bytes: Uint8Array
  /** O que teve que ser cortado pra caber — a tela mostra pra ela decidir. */
  avisos: string[]
}

/** Cache do modelo — baixado uma vez por sessão. */
let modeloCache: ArrayBuffer | null = null

async function carregarModelo(): Promise<ArrayBuffer> {
  if (modeloCache) return modeloCache

  // Exige sessão antes de tentar: sem isso o erro que volta do Storage é um
  // "object not found" genérico, que manda quem está depurando pro lugar errado.
  const { data: sessao } = await supabase.auth.getSession()
  if (!sessao.session) {
    throw new Error('sua sessão expirou. Entre de novo pra emitir o certificado.')
  }

  const { data, error } = await supabase.storage
    .from(BUCKET_MODELO)
    .download(CAMINHO_MODELO)

  if (error || !data) {
    throw new Error(
      `não consegui baixar o modelo (${BUCKET_MODELO}/${CAMINHO_MODELO}). ` +
        `Confira se o arquivo foi enviado pro bucket. Detalhe: ${error?.message ?? 'resposta vazia'}`,
    )
  }

  modeloCache = await data.arrayBuffer()
  return modeloCache
}

/** Monta o PDF do certificado preenchido. */
export async function gerarCertificado(dados: DadosCertificado): Promise<CertificadoGerado> {
  // Import dinâmico: tira o pdf-lib (~350 KB) do bundle inicial do sistema.
  const [modelo, { renderizarCertificado }] = await Promise.all([
    carregarModelo(),
    import('./certificado-render'),
  ])
  return renderizarCertificado(modelo, dados)
}

/** Nome de arquivo amigável, sem acento nem caractere problemático. */
export function nomeArquivoCertificado(cliente: string, numeroVenda?: number): string {
  const base = (cliente ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // tira acentos
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
  const partes = ['certificado-garantia']
  if (base) partes.push(base)
  if (numeroVenda) partes.push(String(numeroVenda))
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

/** Abre o PDF numa nova aba (pra conferir antes de enviar). */
export function abrirPDF(bytes: Uint8Array) {
  const url = URL.createObjectURL(comoBlob(bytes))
  const aba = window.open(url, '_blank')
  if (!aba) {
    // Bloqueou o popup — cai pro download.
    baixarPDF(bytes, 'certificado-garantia.pdf')
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
