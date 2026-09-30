import { useEffect, useState } from 'react'
import { Download, Eye, Share2, ShieldCheck } from 'lucide-react'
import { Botao, Campo, Modal } from '@/components/ui'
import { formatData } from '@/lib/format'
import {
  DIAS_GARANTIA,
  abrirPDF,
  baixarPDF,
  gerarCartaoGarantia,
  nomeArquivoGarantia,
  validadeGarantia,
  type DadosGarantia,
} from '@/lib/garantia'

interface Props {
  aberto: boolean
  onFechar: () => void
  /** Referência do pedido/venda — ex.: "#1042". */
  referencia: string
  cliente: string | null
  /** Sugestão de peça(s): o que foi comprado. */
  pecas: string
  /** Data da compra em ISO (pagamento, quando houver; senão a criação). */
  dataISO: string | null
}

/**
 * Emite o cartão de garantia da Luar (150 × 100 mm) para um pedido ou venda.
 * O texto do cartão é fixo (vive em `lib/garantia.ts`); aqui só se confere o
 * que é variável. Tudo editável: o que vem do pedido é sugestão, não regra.
 */
export function ModalGarantia({ aberto, onFechar, referencia, cliente, pecas, dataISO }: Props) {
  const [dados, setDados] = useState<DadosGarantia>({
    pedido: '',
    cliente: '',
    pecas: '',
    dataCompra: '',
    validade: '',
  })
  const [gerando, setGerando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [avisos, setAvisos] = useState<string[]>([])

  // Reabrir recomeça do pedido, sem herdar edição da vez anterior.
  useEffect(() => {
    if (!aberto) return
    setDados({
      pedido: referencia,
      cliente: cliente ?? '',
      pecas,
      dataCompra: formatData(dataISO),
      validade: validadeGarantia(dataISO),
    })
    setErro(null)
    setAvisos([])
  }, [aberto, referencia, cliente, pecas, dataISO])

  const alterar = (chave: keyof DadosGarantia) => (e: { target: { value: string } }) =>
    setDados((atual) => ({ ...atual, [chave]: e.target.value }))

  async function comOPdf(acao: (bytes: Uint8Array, nome: string) => void) {
    setGerando(true)
    setErro(null)
    setAvisos([])
    try {
      const { bytes, avisos } = await gerarCartaoGarantia(dados)
      setAvisos(avisos)
      acao(bytes, nomeArquivoGarantia(dados.cliente, dados.pedido))
    } catch (e) {
      setErro(
        e instanceof Error
          ? `Não deu pra gerar o cartão: ${e.message}`
          : 'Não deu pra gerar o cartão. Tente de novo.',
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
        await navigator.share({ files: [arquivo], title: 'Cartão de garantia' })
      } catch {
        // Cancelou o compartilhamento — não é erro.
      }
    })
  }

  return (
    <Modal
      aberto={aberto}
      titulo={`Cartão de garantia — ${referencia}`}
      onFechar={onFechar}
      largura="max-w-xl"
    >
      <div className="space-y-4">
        <p className="text-sm text-marca-500">
          Cartão de 15 × 10 cm com a logo em marca d’água e o texto da garantia de {DIAS_GARANTIA}{' '}
          dias. Confira os dados — todos podem ser editados antes de gerar.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Pedido" autoComplete="off" value={dados.pedido} onChange={alterar('pedido')} />
          <Campo label="Cliente" autoComplete="off" value={dados.cliente} onChange={alterar('cliente')} />
        </div>

        <Campo
          label="Peça(s)"
          autoComplete="off"
          value={dados.pecas}
          onChange={alterar('pecas')}
          placeholder="Deixe vazio para não imprimir esta linha"
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <Campo
            label="Data da compra"
            autoComplete="off"
            spellCheck={false}
            value={dados.dataCompra}
            onChange={alterar('dataCompra')}
          />
          <div>
            <Campo
              label="Garantia até"
              autoComplete="off"
              spellCheck={false}
              aria-describedby="ajuda-validade"
              value={dados.validade}
              onChange={alterar('validade')}
            />
            <span id="ajuda-validade" className="mt-1 block text-xs text-marca-400">
              {DIAS_GARANTIA} dias após a compra. Ajuste se combinou diferente.
            </span>
          </div>
        </div>

        {erro && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {erro}
          </p>
        )}

        {/* A região precisa existir antes do conteúdo mudar pro leitor de tela
            anunciar, então o wrapper fica sempre montado. */}
        <div aria-live="polite">
          {avisos.length > 0 && (
            <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
              <p className="font-medium">Cartão gerado, mas com ajuste:</p>
              <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs">
                {avisos.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-marca-200 pt-3">
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

/** Atalho pra abrir o cartão a partir de uma lista. */
export function BotaoGarantia({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="Emitir cartão de garantia"
      aria-label="Emitir cartão de garantia"
      className="rounded-lg p-1.5 text-marca-400 hover:bg-marca-100 hover:text-fendi-600"
    >
      <ShieldCheck size={16} aria-hidden="true" />
    </button>
  )
}
