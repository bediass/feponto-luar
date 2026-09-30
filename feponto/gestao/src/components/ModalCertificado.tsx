import { useEffect, useMemo, useState } from 'react'
import { Download, Eye, Share2, ShieldCheck } from 'lucide-react'
import { Botao, Campo, Modal, Selecao } from '@/components/ui'
import { formatBRL, formatData } from '@/lib/format'
import {
  abrirPDF,
  baixarPDF,
  gerarCertificado,
  nomeArquivoCertificado,
  type DadosCertificado,
} from '@/lib/certificado'
import type { Produto, Venda, VendaItem } from '@/types/db'

interface Props {
  aberto: boolean
  onFechar: () => void
  venda: Venda
  itens: VendaItem[]
  produtos: Produto[]
  clienteNome: string
}

type Campos = Omit<DadosCertificado, 'incluirCapa' | 'cliente'>

/**
 * Emite o certificado de garantia da venda. O modelo impresso (`dados/
 * CERTIFICADO DE GARANTIA.pdf`) tem capa + página de garantia com campos em
 * branco; aqui a gente confere os dados e o sistema preenche a página da
 * garantia. Tudo editável: o que vem do cadastro é sugestão, não regra.
 */
export function ModalCertificado({ aberto, onFechar, venda, itens, produtos, clienteNome }: Props) {
  const [itemId, setItemId] = useState('')
  const [campos, setCampos] = useState<Campos>({
    peca: '',
    pedras: '',
    codigo: '',
    feponto: '',
    data: '',
  })
  const [incluirCapa, setIncluirCapa] = useState(false)
  const [gerando, setGerando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [avisos, setAvisos] = useState<string[]>([])

  const porId = useMemo(() => new Map(produtos.map((p) => [p.id, p])), [produtos])

  /** Sugestões pro item escolhido — a peça, as pedras e o código. */
  function sugerir(item: VendaItem | undefined): Partial<Campos> {
    const produto = item?.produto_id ? porId.get(item.produto_id) : undefined
    return {
      peca: item?.descricao || produto?.nome || '',
      pedras: produto?.pedras || '',
      codigo: produto?.codigo || '',
    }
  }

  // Reabrir o modal recomeça do cadastro, sem herdar edição da vez anterior.
  useEffect(() => {
    if (!aberto) return
    const primeiro = itens[0]
    setItemId(primeiro?.id ?? '')
    setCampos({
      feponto: '',
      data: formatData(venda.data_venda),
      peca: '',
      pedras: '',
      codigo: '',
      ...sugerir(primeiro),
    })
    setIncluirCapa(false)
    setErro(null)
    setAvisos([])
  }, [aberto, venda.id])

  function trocarItem(id: string) {
    setItemId(id)
    setCampos((atual) => ({ ...atual, ...sugerir(itens.find((i) => i.id === id)) }))
  }

  const alterar = (chave: keyof Campos) => (e: { target: { value: string } }) =>
    setCampos((atual) => ({ ...atual, [chave]: e.target.value }))

  async function comOPdf(acao: (bytes: Uint8Array, nome: string) => void) {
    setGerando(true)
    setErro(null)
    setAvisos([])
    try {
      const { bytes, avisos } = await gerarCertificado({
        ...campos,
        cliente: clienteNome,
        incluirCapa,
      })
      setAvisos(avisos)
      acao(bytes, nomeArquivoCertificado(clienteNome, venda.numero))
    } catch (e) {
      setErro(
        e instanceof Error
          ? `Não deu pra gerar o certificado: ${e.message}`
          : 'Não deu pra gerar o certificado. Tente de novo.',
      )
    } finally {
      setGerando(false)
    }
  }

  const podeCompartilhar =
    typeof navigator !== 'undefined' && typeof navigator.canShare === 'function'

  async function compartilhar() {
    await comOPdf(async (bytes, nome) => {
      const arquivo = new File([bytes as unknown as BlobPart], nome, { type: 'application/pdf' })
      if (!navigator.canShare?.({ files: [arquivo] })) {
        baixarPDF(bytes, nome)
        return
      }
      try {
        await navigator.share({ files: [arquivo], title: 'Certificado de garantia' })
      } catch {
        // Cancelou o compartilhamento — não é erro.
      }
    })
  }

  return (
    <Modal
      aberto={aberto}
      titulo={`Certificado de garantia — venda #${venda.numero}`}
      onFechar={onFechar}
      largura="max-w-2xl"
    >
      <div className="space-y-4">
        <p className="text-sm text-stone-500">
          O sistema preenche a página da garantia do certificado. Confira os dados abaixo — tudo
          pode ser editado antes de gerar.
        </p>

        {itens.length > 1 && (
          <Selecao
            label="Peça do certificado"
            value={itemId}
            onChange={(e) => trocarItem(e.target.value)}
          >
            {itens.map((it) => (
              <option key={it.id} value={it.id}>
                {it.descricao} — {formatBRL(it.subtotal)}
              </option>
            ))}
          </Selecao>
        )}

        <fieldset className="space-y-3">
          <legend className="text-xs font-semibold uppercase tracking-wide text-stone-400">
            A peça
          </legend>
          <Campo
            label="Peça"
            name="peca"
            autoComplete="off"
            value={campos.peca}
            onChange={alterar('peca')}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo
              label="Pedras"
              name="pedras"
              autoComplete="off"
              value={campos.pedras}
              onChange={alterar('pedras')}
            />
            <Campo
              label="Código"
              name="codigo"
              autoComplete="off"
              spellCheck={false}
              value={campos.codigo}
              onChange={alterar('codigo')}
            />
          </div>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="text-xs font-semibold uppercase tracking-wide text-stone-400">
            A emissão
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo
              label="Data"
              name="data"
              autoComplete="off"
              spellCheck={false}
              value={campos.data}
              onChange={alterar('data')}
            />
            <div>
              <Campo
                label="Fê ponto"
                name="feponto"
                autoComplete="off"
                aria-describedby="ajuda-feponto"
                value={campos.feponto}
                onChange={alterar('feponto')}
              />
              <span id="ajuda-feponto" className="mt-1 block text-xs text-stone-400">
                Campo do modelo impresso. Deixe vazio pra preencher à mão.
              </span>
            </div>
          </div>
        </fieldset>

        <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-stone-50 px-3 py-2.5">
          <input
            type="checkbox"
            checked={incluirCapa}
            onChange={(e) => setIncluirCapa(e.target.checked)}
            className="h-4 w-4 accent-zinc-900"
          />
          <span className="text-sm text-stone-700">
            Incluir a capa do certificado
            <span className="ml-1 text-stone-400">
              (2 páginas — só marque se for enviar digital)
            </span>
          </span>
        </label>

        {erro && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {erro}
          </p>
        )}

        {/* A região precisa existir antes do conteúdo mudar pra o leitor de
            tela anunciar, então o wrapper fica sempre montado. */}
        <div aria-live="polite">
          {avisos.length > 0 && (
            <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
              <p className="font-medium">Certificado gerado, mas com ajuste:</p>
              <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs">
                {avisos.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
              <p className="mt-1 text-xs">Encurte o texto se quiser que apareça inteiro.</p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-stone-200 pt-3">
          <Botao type="button" variante="secundario" onClick={onFechar}>
            Cancelar
          </Botao>
          <Botao
            type="button"
            variante="secundario"
            disabled={gerando}
            onClick={() => comOPdf((bytes) => abrirPDF(bytes))}
          >
            <Eye size={16} /> Conferir
          </Botao>
          {podeCompartilhar && (
            <Botao type="button" variante="secundario" disabled={gerando} onClick={compartilhar}>
              <Share2 size={16} /> Compartilhar
            </Botao>
          )}
          <Botao type="button" disabled={gerando} onClick={() => comOPdf(baixarPDF)}>
            {gerando ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                Gerando…
              </>
            ) : (
              <>
                <Download size={16} /> Baixar PDF
              </>
            )}
          </Botao>
        </div>
      </div>
    </Modal>
  )
}

/** Ícone/atalho pra abrir o certificado a partir da lista de vendas. */
export function BotaoCertificado({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="Emitir certificado de garantia"
      aria-label="Emitir certificado de garantia"
      className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-marca-600"
    >
      <ShieldCheck size={16} aria-hidden="true" />
    </button>
  )
}
