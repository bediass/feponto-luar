import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Plus, Trash2, Ban, Eye, Pencil, ShieldCheck, Truck, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  Botao,
  Campo,
  Area,
  Selecao,
  Card,
  Modal,
  Badge,
  CabecalhoPagina,
  Vazio,
  Carregando,
} from '@/components/ui'
import { formatBRL, formatData, formatDataHora, parseValor } from '@/lib/format'
import { BotaoCertificado, ModalCertificado } from '@/components/ModalCertificado'
import type { Cliente, Endereco, Produto, Venda, VendaItem, Pagamento } from '@/types/db'

interface ItemForm {
  produto_id: string
  descricao: string
  quantidade: string
  preco_unitario: string
}

interface VendaLista extends Venda {
  pagamentos?: Pick<Pagamento, 'forma' | 'parcelas'>[]
  venda_itens?: { id: string }[]
}

const FORMAS: Record<string, string> = {
  dinheiro: 'Dinheiro',
  pix: 'Pix',
  debito: 'Cartão de débito',
  credito: 'Cartão de crédito',
  crediario: 'Crediário (caderninho)',
  transferencia: 'Transferência',
}

const itemVazio: ItemForm = { produto_id: '', descricao: '', quantidade: '1', preco_unitario: '' }

/** Endereço de envio no formulário — vira o jsonb `endereco_envio` da venda. */
type EndForm = { cep: string; rua: string; numero: string; complemento: string; bairro: string; cidade: string; uf: string }
const endVazio: EndForm = { cep: '', rua: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '' }
function enderecoParaForm(e: Endereco | null | undefined): EndForm {
  return {
    cep: e?.cep ?? '', rua: e?.rua ?? '', numero: e?.numero ?? '', complemento: e?.complemento ?? '',
    bairro: e?.bairro ?? '', cidade: e?.cidade ?? '', uf: e?.uf ?? '',
  }
}
function formParaEndereco(f: EndForm): Endereco | null {
  const limpo = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v))
  return Object.keys(limpo).length ? (limpo as Endereco) : null
}

const hoje = () => new Date().toISOString().slice(0, 10)

export default function Vendas() {
  const [vendas, setVendas] = useState<VendaLista[]>([])
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [carregando, setCarregando] = useState(true)

  const [modalAberto, setModalAberto] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const [editando, setEditando] = useState<VendaLista | null>(null)
  const [clienteId, setClienteId] = useState('')
  const [itens, setItens] = useState<ItemForm[]>([{ ...itemVazio }])
  const [desconto, setDesconto] = useState('')
  const [forma, setForma] = useState('dinheiro')
  const [parcelas, setParcelas] = useState('1')
  const [dataPrimeiraParcela, setDataPrimeiraParcela] = useState(hoje())
  const [observacoes, setObservacoes] = useState('')
  // Envio pelos Correios: liga a venda na tela Envios (sql/bloco-4-envio-venda.sql)
  const [precisaEnvio, setPrecisaEnvio] = useState(false)
  const [endEnvio, setEndEnvio] = useState<EndForm>(endVazio)

  const [detalhe, setDetalhe] = useState<{ venda: VendaLista; itens: VendaItem[] } | null>(null)
  const [certificado, setCertificado] = useState<{ venda: VendaLista; itens: VendaItem[] } | null>(
    null,
  )

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    setCarregando(true)
    const [v, p, c] = await Promise.all([
      supabase
        .from('vendas')
        .select('*, clientes(id, nome), pagamentos(forma, parcelas), venda_itens(id)')
        .order('data_venda', { ascending: false }),
      supabase.from('produtos').select('*').eq('ativo', true).order('nome'),
      supabase.from('clientes').select('*').order('nome'),
    ])
    setVendas((v.data as VendaLista[]) ?? [])
    setProdutos((p.data as Produto[]) ?? [])
    setClientes((c.data as Cliente[]) ?? [])
    setCarregando(false)
  }

  function abrirNova() {
    setEditando(null)
    setClienteId('')
    setItens([{ ...itemVazio }])
    setDesconto('')
    setForma('dinheiro')
    setParcelas('1')
    setDataPrimeiraParcela(hoje())
    setObservacoes('')
    setPrecisaEnvio(false)
    setEndEnvio(endVazio)
    setErro(null)
    setModalAberto(true)
  }

  async function abrirEdicao(v: VendaLista) {
    const [itensResp, pagResp, contasResp] = await Promise.all([
      supabase.from('venda_itens').select('*').eq('venda_id', v.id),
      supabase.from('pagamentos').select('*').eq('venda_id', v.id).limit(1),
      supabase.from('contas').select('vencimento').eq('venda_id', v.id).order('vencimento').limit(1),
    ])
    const its = (itensResp.data as VendaItem[]) ?? []
    const pag = (pagResp.data as Pagamento[])?.[0]
    setEditando(v)
    setClienteId(v.cliente_id ?? '')
    setItens(
      its.length
        ? its.map((it) => ({
            produto_id: it.produto_id ?? '',
            descricao: it.descricao ?? '',
            quantidade: String(it.quantidade),
            preco_unitario: String(it.preco_unitario).replace('.', ','),
          }))
        : [{ ...itemVazio }],
    )
    setDesconto(v.desconto ? String(v.desconto).replace('.', ',') : '')
    setForma(pag?.forma ?? 'dinheiro')
    setParcelas(String(pag?.parcelas ?? 1))
    setDataPrimeiraParcela((contasResp.data as { vencimento: string }[])?.[0]?.vencimento ?? hoje())
    setObservacoes(v.observacoes ?? '')
    setPrecisaEnvio(v.precisa_envio ?? false)
    setEndEnvio(enderecoParaForm(v.endereco_envio))
    setErro(null)
    setModalAberto(true)
  }

  function alterarItem(i: number, campo: keyof ItemForm, valor: string) {
    setItens((atual) => {
      const novo = [...atual]
      novo[i] = { ...novo[i], [campo]: valor }
      if (campo === 'produto_id') {
        const prod = produtos.find((p) => p.id === valor)
        if (prod) {
          novo[i].descricao = prod.nome
          novo[i].preco_unitario = String(prod.preco_venda).replace('.', ',')
        }
      }
      return novo
    })
  }

  const total = useMemo(() => {
    const soma = itens.reduce(
      (s, it) => s + (parseInt(it.quantidade || '0', 10) || 0) * parseValor(it.preco_unitario),
      0,
    )
    return Math.max(0, soma - parseValor(desconto))
  }, [itens, desconto])

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    const itensValidos = itens.filter((it) => it.descricao.trim() && parseValor(it.preco_unitario) > 0)
    if (itensValidos.length === 0) {
      setErro('Adicione ao menos um item com descrição e preço.')
      return
    }
    setSalvando(true)
    const { data: vendaId, error } = await supabase.rpc('registrar_venda', {
      p_venda_id: editando?.id ?? null,
      p_cliente_id: clienteId || null,
      p_desconto: parseValor(desconto),
      p_forma: forma,
      p_parcelas: parseInt(parcelas || '1', 10),
      p_data_primeira_parcela: forma === 'crediario' ? dataPrimeiraParcela || hoje() : null,
      p_observacoes: observacoes.trim() || null,
      p_itens: itensValidos.map((it) => ({
        produto_id: it.produto_id || null,
        descricao: it.descricao.trim(),
        quantidade: parseInt(it.quantidade || '1', 10),
        preco_unitario: parseValor(it.preco_unitario),
      })),
    })
    if (error) {
      setSalvando(false)
      setErro(error.message)
      return
    }

    // O envio é gravado num update à parte de propósito: o `registrar_venda`
    // mexe em estoque, caixa e contas a receber, e trocar a assinatura dele
    // por causa de endereço seria risco desproporcional. Se este update
    // falhar, a venda já está salva — é só reabrir e marcar de novo.
    const id = (vendaId as string | null) ?? editando?.id ?? null
    if (id) {
      const { error: erroEnvio } = await supabase
        .from('vendas')
        .update({
          precisa_envio: precisaEnvio,
          // mantém 'enviado'/'entregue' já registrado; só entra em 'a_enviar'
          // quando a venda passa a ser enviada agora
          envio_status: precisaEnvio ? (editando?.envio_status ?? 'a_enviar') : null,
          endereco_envio: precisaEnvio ? formParaEndereco(endEnvio) : null,
        })
        .eq('id', id)
      if (erroEnvio) {
        setSalvando(false)
        setErro('Venda salva, mas não consegui gravar o envio: ' + erroEnvio.message)
        carregar()
        return
      }
    }

    setSalvando(false)
    setModalAberto(false)
    carregar()
  }

  async function cancelar(v: VendaLista) {
    if (!confirm(`Cancelar a venda #${v.numero}? O estoque será estornado.`)) return
    const { error } = await supabase.rpc('cancelar_venda', { p_venda_id: v.id })
    if (error) {
      alert('Erro ao cancelar: ' + error.message)
      return
    }
    carregar()
  }

  async function itensDa(v: VendaLista) {
    const { data } = await supabase.from('venda_itens').select('*').eq('venda_id', v.id)
    return (data as VendaItem[]) ?? []
  }

  async function verDetalhe(v: VendaLista) {
    setDetalhe({ venda: v, itens: await itensDa(v) })
  }

  async function emitirCertificado(v: VendaLista) {
    setCertificado({ venda: v, itens: await itensDa(v) })
  }

  const mostrarParcelas = forma === 'credito' || forma === 'crediario'

  return (
    <div>
      <CabecalhoPagina
        titulo="Vendas"
        subtitulo={`${vendas.length} venda(s) registrada(s)`}
        acao={
          <Botao onClick={abrirNova}>
            <Plus size={16} /> Nova venda
          </Botao>
        }
      />

      {carregando ? (
        <Carregando />
      ) : vendas.length === 0 ? (
        <Vazio
          titulo="Nenhuma venda registrada"
          descricao="Registre a primeira venda da loja."
          acao={<Botao onClick={abrirNova}><Plus size={16} /> Nova venda</Botao>}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
                  <th className="px-4 py-3 font-medium">Venda</th>
                  <th className="px-4 py-3 font-medium">Data</th>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Pagamento</th>
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                  <th className="px-4 py-3 text-center font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {vendas.map((v) => (
                  <tr key={v.id} className="border-b border-stone-100 last:border-0 hover:bg-stone-50/60">
                    <td className="px-4 py-3 font-medium text-stone-700">#{v.numero}</td>
                    <td className="px-4 py-3 text-stone-500">{formatDataHora(v.data_venda)}</td>
                    <td className="px-4 py-3 text-stone-700">{v.clientes?.nome ?? <span className="text-stone-300">Sem cliente</span>}</td>
                    <td className="px-4 py-3 text-stone-500">{v.pagamentos?.[0] ? FORMAS[v.pagamentos[0].forma] ?? v.pagamentos[0].forma : '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-stone-800">{formatBRL(v.total)}</td>
                    <td className="px-4 py-3 text-center">
                      {v.status === 'concluida' ? (
                        <Badge cor="verde">Concluída</Badge>
                      ) : v.status === 'cancelada' ? (
                        <Badge cor="vermelho">Cancelada</Badge>
                      ) : (
                        <Badge cor="ambar">Orçamento</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => verDetalhe(v)} className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-marca-600" title="Ver itens">
                          <Eye size={16} />
                        </button>
                        {v.status === 'concluida' && (
                          <BotaoCertificado onClick={() => emitirCertificado(v)} />
                        )}
                        {v.status !== 'cancelada' && (
                          <button onClick={() => abrirEdicao(v)} className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-marca-600" title="Editar venda">
                            <Pencil size={16} />
                          </button>
                        )}
                        {v.status !== 'cancelada' && (
                          <button onClick={() => cancelar(v)} className="rounded-lg p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-600" title="Cancelar venda">
                            <Ban size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Modal nova/editar venda */}
      <Modal aberto={modalAberto} titulo={editando ? `Editar venda #${editando.numero}` : 'Nova venda'} onFechar={() => setModalAberto(false)} largura="max-w-3xl">
        <form onSubmit={salvar} className="space-y-4">
          <Selecao label="Cliente (opcional)" value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
            <option value="">Sem cliente / venda avulsa</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </Selecao>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-stone-600">Itens da venda</span>
              <button type="button" onClick={() => setItens([...itens, { ...itemVazio }])} className="flex items-center gap-1 text-sm font-medium text-marca-600 hover:text-marca-700">
                <Plus size={15} /> Adicionar item
              </button>
            </div>
            <div className="space-y-2">
              {itens.map((it, i) => {
                const sub = (parseInt(it.quantidade || '0', 10) || 0) * parseValor(it.preco_unitario)
                return (
                  <div key={i} className="flex flex-wrap items-end gap-2 rounded-lg border border-stone-200 bg-stone-50 p-2">
                    <div className="min-w-[180px] flex-1">
                      <select
                        value={it.produto_id}
                        onChange={(e) => alterarItem(i, 'produto_id', e.target.value)}
                        className="w-full rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-marca-500"
                      >
                        <option value="">— Peça do estoque ou item livre —</option>
                        {produtos.map((p) => (
                          <option key={p.id} value={p.id}>{p.codigo} · {p.nome} ({p.quantidade} em estoque)</option>
                        ))}
                      </select>
                      <input
                        value={it.descricao}
                        onChange={(e) => alterarItem(i, 'descricao', e.target.value)}
                        placeholder="Descrição do item"
                        className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-marca-500"
                      />
                    </div>
                    <div className="w-16">
                      <span className="mb-0.5 block text-xs text-stone-400">Qtd</span>
                      <input type="number" min={1} value={it.quantidade} onChange={(e) => alterarItem(i, 'quantidade', e.target.value)} className="w-full rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-marca-500" />
                    </div>
                    <div className="w-28">
                      <span className="mb-0.5 block text-xs text-stone-400">Preço un.</span>
                      <input value={it.preco_unitario} onChange={(e) => alterarItem(i, 'preco_unitario', e.target.value)} placeholder="0,00" inputMode="decimal" className="w-full rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-marca-500" />
                    </div>
                    <div className="w-24 text-right">
                      <span className="mb-0.5 block text-xs text-stone-400">Subtotal</span>
                      <span className="block py-1.5 text-sm font-medium text-stone-700">{formatBRL(sub)}</span>
                    </div>
                    <button type="button" onClick={() => setItens(itens.filter((_, idx) => idx !== i))} disabled={itens.length === 1} className="rounded-lg p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30">
                      <Trash2 size={16} />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Selecao label="Forma de pagamento" value={forma} onChange={(e) => setForma(e.target.value)}>
              {Object.entries(FORMAS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Selecao>
            {mostrarParcelas ? (
              <Campo label="Parcelas" type="number" min={1} value={parcelas} onChange={(e) => setParcelas(e.target.value)} />
            ) : (
              <Campo label="Desconto (R$)" value={desconto} onChange={(e) => setDesconto(e.target.value)} placeholder="0,00" inputMode="decimal" />
            )}
          </div>
          {forma === 'crediario' && (
            <Campo label="Data do primeiro pagamento" type="date" value={dataPrimeiraParcela} onChange={(e) => setDataPrimeiraParcela(e.target.value)} />
          )}
          {mostrarParcelas && (
            <Campo label="Desconto (R$)" value={desconto} onChange={(e) => setDesconto(e.target.value)} placeholder="0,00" inputMode="decimal" />
          )}

          <Area label="Observações" rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />

          {/* Envio pelos Correios — marca a venda pra aparecer na tela Envios */}
          <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={precisaEnvio}
                onChange={(e) => setPrecisaEnvio(e.target.checked)}
                className="h-4 w-4 accent-zinc-900"
              />
              <Truck size={18} className="text-zinc-700" />
              <span className="text-sm text-stone-700">
                Será enviado pelos Correios
                <span className="block text-xs text-stone-400">
                  A venda entra na tela Envios com endereço, rastreio e baixa de entrega.
                </span>
              </span>
            </label>

            {precisaEnvio && (
              <div className="mt-4 space-y-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Campo label="CEP" value={endEnvio.cep} onChange={(e) => setEndEnvio({ ...endEnvio, cep: e.target.value })} placeholder="00000-000" inputMode="numeric" autoComplete="postal-code" />
                  <div className="sm:col-span-2">
                    <Campo label="Rua" value={endEnvio.rua} onChange={(e) => setEndEnvio({ ...endEnvio, rua: e.target.value })} autoComplete="address-line1" />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Campo label="Número" value={endEnvio.numero} onChange={(e) => setEndEnvio({ ...endEnvio, numero: e.target.value })} />
                  <Campo label="Complemento" value={endEnvio.complemento} onChange={(e) => setEndEnvio({ ...endEnvio, complemento: e.target.value })} />
                  <Campo label="Bairro" value={endEnvio.bairro} onChange={(e) => setEndEnvio({ ...endEnvio, bairro: e.target.value })} />
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="sm:col-span-2">
                    <Campo label="Cidade" value={endEnvio.cidade} onChange={(e) => setEndEnvio({ ...endEnvio, cidade: e.target.value })} autoComplete="address-level2" />
                  </div>
                  <Campo label="UF" value={endEnvio.uf} onChange={(e) => setEndEnvio({ ...endEnvio, uf: e.target.value.toUpperCase().slice(0, 2) })} maxLength={2} autoComplete="address-level1" />
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between rounded-lg bg-marca-50 px-4 py-3">
            <span className="text-sm font-medium text-stone-600">Total da venda</span>
            <span className="text-2xl font-bold text-marca-700">{formatBRL(total)}</span>
          </div>

          {forma === 'crediario' && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Crediário: {parseInt(parcelas || '1', 10)} parcela(s) a receber no Financeiro — a 1ª em {formatData(dataPrimeiraParcela)} e as demais de 30 em 30 dias.
            </p>
          )}

          {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{erro}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Botao type="button" variante="secundario" onClick={() => setModalAberto(false)}>Cancelar</Botao>
            <Botao type="submit" disabled={salvando}>{salvando ? 'Salvando…' : editando ? 'Salvar alterações' : 'Registrar venda'}</Botao>
          </div>
        </form>
      </Modal>

      {/* Modal detalhe */}
      {detalhe && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-stone-200 px-5 py-3">
              <h3 className="text-lg font-semibold text-stone-800">Venda #{detalhe.venda.numero}</h3>
              <button onClick={() => setDetalhe(null)} className="rounded-lg p-1 text-stone-400 hover:bg-stone-100">
                <X size={20} />
              </button>
            </div>
            <div className="px-5 py-4">
              <div className="mb-3 text-sm text-stone-500">
                <p>{formatDataHora(detalhe.venda.data_venda)}</p>
                {detalhe.venda.clientes?.nome && <p>Cliente: {detalhe.venda.clientes.nome}</p>}
              </div>
              <ul className="divide-y divide-stone-100">
                {detalhe.itens.map((it) => (
                  <li key={it.id} className="flex justify-between py-2 text-sm">
                    <span className="text-stone-700">{it.quantidade}× {it.descricao}</span>
                    <span className="font-medium text-stone-700">{formatBRL(it.subtotal)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex justify-between border-t border-stone-200 pt-3">
                <span className="font-medium text-stone-600">Total</span>
                <span className="text-lg font-bold text-stone-800">{formatBRL(detalhe.venda.total)}</span>
              </div>
              {detalhe.venda.status === 'concluida' && (
                <div className="mt-4 flex justify-end">
                  <Botao
                    variante="secundario"
                    onClick={() => {
                      setCertificado({ venda: detalhe.venda, itens: detalhe.itens })
                      setDetalhe(null)
                    }}
                  >
                    <ShieldCheck size={16} /> Certificado de garantia
                  </Botao>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Certificado de garantia */}
      {certificado && (
        <ModalCertificado
          aberto
          onFechar={() => setCertificado(null)}
          venda={certificado.venda}
          itens={certificado.itens}
          produtos={produtos}
          clienteNome={certificado.venda.clientes?.nome ?? ''}
        />
      )}
    </div>
  )
}
