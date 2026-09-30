import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  Plus, ArrowDownCircle, ArrowUpCircle, Check, Trash2, Repeat, TrendingUp,
  TrendingDown, Wallet, ChevronRight, Layers,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  Botao, Campo, Selecao, Card, Modal, Badge, CabecalhoPagina, Vazio, Carregando,
} from '@/components/ui'
import { formatBRL, formatData, parseCentavos } from '@/lib/format'
import type { Cliente, Conta, MovimentacaoCaixa, TipoConta } from '@/types/db'

type Aba = 'receber' | 'pagar' | 'caixa'

const FREQUENCIAS: Record<string, string> = {
  mensal: 'Mensal',
  semanal: 'Semanal',
  anual: 'Anual',
}

const hoje = () => new Date().toISOString().slice(0, 10)
const fmtDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export default function Financeiro() {
  const [contas, setContas] = useState<Conta[]>([])
  const [movimentacoes, setMovimentacoes] = useState<MovimentacaoCaixa[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [carregando, setCarregando] = useState(true)
  const [aba, setAba] = useState<Aba>('receber')

  const [modalAberto, setModalAberto] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [grupoAberto, setGrupoAberto] = useState<string | null>(null)
  const [periodo, setPeriodo] = useState<'mes' | 'semestre' | 'ano' | 'custom'>('mes')
  const [pInicio, setPInicio] = useState(hoje())
  const [pFim, setPFim] = useState(hoje())

  const [form, setForm] = useState({
    tipo: 'receber' as TipoConta,
    descricao: '',
    cliente_id: '',
    fornecedor: '',
    categoria: '',
    valor: '',
    vencimento: hoje(),
    recorrente: false,
    frequencia: 'mensal',
    vezes: '12',
  })

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    setCarregando(true)
    const [ct, mv, cl] = await Promise.all([
      supabase.from('contas').select('*, clientes(id, nome)').order('pago').order('vencimento', { nullsFirst: false }),
      supabase.from('movimentacoes_caixa').select('*').order('data', { ascending: false }),
      supabase.from('clientes').select('*').order('nome'),
    ])
    setContas((ct.data as Conta[]) ?? [])
    setMovimentacoes((mv.data as MovimentacaoCaixa[]) ?? [])
    setClientes((cl.data as Cliente[]) ?? [])
    setCarregando(false)
  }

  const intervalo = useMemo(() => {
    const now = new Date()
    const y = now.getFullYear()
    if (periodo === 'mes') {
      return { inicio: fmtDate(new Date(y, now.getMonth(), 1)), fim: fmtDate(new Date(y, now.getMonth() + 1, 0)), label: 'no mês' }
    }
    if (periodo === 'semestre') {
      const ini = now.getMonth() < 6 ? 0 : 6
      return { inicio: fmtDate(new Date(y, ini, 1)), fim: fmtDate(new Date(y, ini + 6, 0)), label: 'no semestre' }
    }
    if (periodo === 'ano') {
      return { inicio: `${y}-01-01`, fim: `${y}-12-31`, label: 'no ano' }
    }
    return { inicio: pInicio, fim: pFim, label: 'no período' }
  }, [periodo, pInicio, pFim])

  const totais = useMemo(() => {
    const noPeriodo = (data: string | null) => !!data && data >= intervalo.inicio && data <= intervalo.fim
    const aReceber = contas.filter((c) => c.tipo === 'receber' && !c.pago && noPeriodo(c.vencimento)).reduce((s, c) => s + Number(c.valor_centavos), 0)
    const aPagar = contas.filter((c) => c.tipo === 'pagar' && !c.pago && noPeriodo(c.vencimento)).reduce((s, c) => s + Number(c.valor_centavos), 0)
    const entradas = movimentacoes.filter((m) => m.tipo === 'entrada' && noPeriodo(m.data)).reduce((s, m) => s + Number(m.valor_centavos), 0)
    const saidas = movimentacoes.filter((m) => m.tipo === 'saida' && noPeriodo(m.data)).reduce((s, m) => s + Number(m.valor_centavos), 0)
    return { aReceber, aPagar, entradas, saidas, saldo: entradas - saidas }
  }, [contas, movimentacoes, intervalo])

  const movsPeriodo = useMemo(
    () => movimentacoes.filter((m) => m.data >= intervalo.inicio && m.data <= intervalo.fim),
    [movimentacoes, intervalo],
  )

  const contasFiltradas = useMemo(() => contas.filter((c) => c.tipo === aba), [contas, aba])

  const grupos = useMemo(() => {
    const mapa = new Map<string, Conta[]>()
    for (const c of contasFiltradas) {
      const chave = c.grupo_id ?? `single-${c.id}`
      if (!mapa.has(chave)) mapa.set(chave, [])
      mapa.get(chave)!.push(c)
    }
    const lista = Array.from(mapa.entries()).map(([chave, cs]) => {
      cs.sort((a, b) => (a.vencimento ?? '').localeCompare(b.vencimento ?? ''))
      const ehSerie = cs.length > 1 && !!cs[0].grupo_id
      const naoPagas = cs.filter((c) => !c.pago)
      return {
        chave,
        ehSerie,
        contas: cs,
        descricao: ehSerie
          ? cs[0].descricao.replace(/\s*(—\s*)?parcela\s*\d+\/\d+\s*$/i, '').replace(/\s*\(\d+\/\d+\)\s*$/, '')
          : cs[0].descricao,
        contraparte: aba === 'receber' ? cs[0].clientes?.nome ?? '' : cs[0].fornecedor ?? '',
        recorrente: cs[0].recorrente,
        frequencia: cs[0].frequencia,
        valorParcela: Number(cs[0].valor_centavos),
        totalValor: cs.reduce((s, c) => s + Number(c.valor_centavos), 0),
        valorAberto: naoPagas.reduce((s, c) => s + Number(c.valor_centavos), 0),
        qtd: cs.length,
        pagas: cs.filter((c) => c.pago).length,
        proximoVencimento: naoPagas[0]?.vencimento ?? null,
        temVencida: naoPagas.some((c) => c.vencimento && c.vencimento < hoje()),
      }
    })
    lista.sort((a, b) => (a.proximoVencimento ?? '9999').localeCompare(b.proximoVencimento ?? '9999'))
    return lista
  }, [contasFiltradas, aba])

  const grupoDetalhe = grupos.find((g) => g.chave === grupoAberto) ?? null

  function abrirNova() {
    const tipo: TipoConta = aba === 'pagar' ? 'pagar' : 'receber'
    setForm({ tipo, descricao: '', cliente_id: '', fornecedor: '', categoria: '', valor: '', vencimento: hoje(), recorrente: false, frequencia: 'mensal', vezes: '12' })
    setErro(null)
    setModalAberto(true)
  }

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    if (!form.descricao.trim() || parseCentavos(form.valor) <= 0) {
      setErro('Preencha a descrição e um valor válido.')
      return
    }
    setSalvando(true)
    const { error } = await supabase.rpc('criar_contas', {
      p_tipo: form.tipo,
      p_descricao: form.descricao.trim(),
      p_categoria: form.categoria.trim() || null,
      p_cliente_id: form.tipo === 'receber' ? form.cliente_id || null : null,
      p_fornecedor: form.tipo === 'pagar' ? form.fornecedor.trim() || null : null,
      p_valor_centavos: parseCentavos(form.valor),
      p_vencimento: form.vencimento || null,
      p_recorrente: form.recorrente,
      p_frequencia: form.frequencia,
      p_vezes: form.recorrente ? Math.max(parseInt(form.vezes || '1', 10), 1) : 1,
    })
    setSalvando(false)
    if (error) {
      setErro(error.message)
      return
    }
    setModalAberto(false)
    carregar()
  }

  async function darBaixa(c: Conta) {
    const verbo = c.tipo === 'receber' ? 'recebimento' : 'pagamento'
    if (!confirm(`Confirmar ${verbo} de ${formatBRL(c.valor_centavos)}: "${c.descricao}"?`)) return
    const { error } = await supabase.rpc('baixar_conta', { p_conta_id: c.id })
    if (error) {
      alert('Erro: ' + error.message)
      return
    }
    carregar()
  }

  async function excluir(c: Conta) {
    if (!confirm(`Excluir "${c.descricao}"?`)) return
    await supabase.from('contas').delete().eq('id', c.id)
    carregar()
  }

  async function excluirSerie(grupoId: string, descricao: string) {
    if (!confirm(`Excluir TODAS as parcelas de "${descricao}"?`)) return
    await supabase.from('contas').delete().eq('grupo_id', grupoId)
    setGrupoAberto(null)
    carregar()
  }

  function statusConta(c: Conta) {
    if (c.pago) return <Badge cor="verde">Pago</Badge>
    if (c.vencimento && c.vencimento < hoje()) return <Badge cor="vermelho">Vencida</Badge>
    return <Badge cor="ambar">Em aberto</Badge>
  }

  const abas: { id: Aba; rotulo: string }[] = [
    { id: 'receber', rotulo: 'A receber' },
    { id: 'pagar', rotulo: 'A pagar' },
    { id: 'caixa', rotulo: 'Fluxo de caixa' },
  ]

  return (
    <div>
      <CabecalhoPagina
        titulo="Financeiro"
        subtitulo="Contas a receber, a pagar e caixa"
        acao={aba !== 'caixa' && <Botao onClick={abrirNova}><Plus size={16} /> Nova conta</Botao>}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-sm text-marca-500">Período:</span>
        {([['mes', 'Mês'], ['semestre', 'Semestre'], ['ano', 'Ano'], ['custom', 'Personalizado']] as const).map(([id, rot]) => (
          <button
            key={id}
            onClick={() => setPeriodo(id)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              periodo === id ? 'bg-marca-900 text-white' : 'border border-marca-200 bg-white text-marca-600 hover:bg-marca-50'
            }`}
          >
            {rot}
          </button>
        ))}
        {periodo === 'custom' ? (
          <div className="flex items-center gap-2">
            <input type="date" value={pInicio} onChange={(e) => setPInicio(e.target.value)} className="rounded-lg border border-marca-300 px-2 py-1.5 text-sm outline-none focus:border-fendi-500" />
            <span className="text-marca-400">até</span>
            <input type="date" value={pFim} onChange={(e) => setPFim(e.target.value)} className="rounded-lg border border-marca-300 px-2 py-1.5 text-sm outline-none focus:border-fendi-500" />
          </div>
        ) : (
          <span className="ml-1 text-xs text-marca-400">{formatData(intervalo.inicio)} a {formatData(intervalo.fim)}</span>
        )}
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="p-4">
          <ArrowDownCircle size={20} className="text-emerald-600" />
          <p className="mt-2 text-xl font-bold text-marca-800">{formatBRL(totais.aReceber)}</p>
          <p className="text-xs text-marca-500">A receber (em aberto)</p>
        </Card>
        <Card className="p-4">
          <ArrowUpCircle size={20} className="text-red-600" />
          <p className="mt-2 text-xl font-bold text-marca-800">{formatBRL(totais.aPagar)}</p>
          <p className="text-xs text-marca-500">A pagar (em aberto)</p>
        </Card>
        <Card className="p-4">
          <TrendingUp size={20} className="text-emerald-600" />
          <p className="mt-2 text-xl font-bold text-marca-800">{formatBRL(totais.entradas)}</p>
          <p className="text-xs text-marca-500">Entradas (recebido)</p>
        </Card>
        <Card className="p-4">
          <Wallet size={20} className="text-marca-600" />
          <p className={`mt-2 text-xl font-bold ${totais.saldo >= 0 ? 'text-marca-800' : 'text-red-600'}`}>{formatBRL(totais.saldo)}</p>
          <p className="text-xs text-marca-500">Saldo do período</p>
        </Card>
      </div>

      <div className="mb-4 inline-flex rounded-lg border border-marca-200 bg-white p-1">
        {abas.map((a) => (
          <button
            key={a.id}
            onClick={() => setAba(a.id)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              aba === a.id ? 'bg-marca-900 text-white' : 'text-marca-600 hover:bg-marca-100'
            }`}
          >
            {a.rotulo}
          </button>
        ))}
      </div>

      {carregando ? (
        <Carregando />
      ) : aba === 'caixa' ? (
        <FluxoCaixa movimentacoes={movsPeriodo} totais={totais} />
      ) : contasFiltradas.length === 0 ? (
        <Vazio
          titulo={aba === 'receber' ? 'Nenhuma conta a receber' : 'Nenhuma conta a pagar'}
          descricao={aba === 'receber' ? 'O crediário das vendas aparece aqui. Você também pode lançar manualmente.' : 'Cadastre despesas fixas (aluguel, cartão), inclusive recorrentes.'}
          acao={<Botao onClick={abrirNova}><Plus size={16} /> Nova conta</Botao>}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-marca-200 bg-marca-50 text-left text-xs uppercase tracking-wide text-marca-500">
                  <th className="px-4 py-3 font-medium">Descrição</th>
                  <th className="px-4 py-3 font-medium">{aba === 'receber' ? 'Cliente' : 'Fornecedor'}</th>
                  <th className="px-4 py-3 font-medium">Vencimento</th>
                  <th className="px-4 py-3 text-right font-medium">Valor</th>
                  <th className="px-4 py-3 text-center font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {grupos.map((g) => {
                  const c = g.contas[0]
                  if (!g.ehSerie) {
                    return (
                      <tr key={g.chave} className="border-b border-marca-100 last:border-0 hover:bg-marca-50/60">
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-2 font-medium text-marca-800">
                            {c.recorrente && <Repeat size={13} className="text-marca-400" />}
                            {c.descricao}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-marca-600">{g.contraparte || <span className="text-marca-300">-</span>}</td>
                        <td className="px-4 py-3 text-marca-500">{formatData(c.vencimento)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-marca-800">{formatBRL(c.valor_centavos)}</td>
                        <td className="px-4 py-3 text-center">{statusConta(c)}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            {!c.pago && (
                              <button onClick={() => darBaixa(c)} className="rounded-lg p-1.5 text-marca-400 hover:bg-emerald-50 hover:text-emerald-600" title={aba === 'receber' ? 'Marcar como recebido' : 'Marcar como pago'}>
                                <Check size={16} />
                              </button>
                            )}
                            <button onClick={() => excluir(c)} className="rounded-lg p-1.5 text-marca-400 hover:bg-red-50 hover:text-red-600" title="Excluir">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  }
                  return (
                    <tr key={g.chave} className="border-b border-marca-100 last:border-0 hover:bg-marca-50/60">
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-2 font-medium text-marca-800">
                          <Repeat size={13} className="text-marca-400" />
                          {g.descricao}
                        </span>
                        <span className="ml-1 text-xs text-marca-400">
                          · {g.qtd}x {g.frequencia ? FREQUENCIAS[g.frequencia]?.toLowerCase() : 'parcelas'} · {g.pagas}/{g.qtd} pagas
                        </span>
                      </td>
                      <td className="px-4 py-3 text-marca-600">{g.contraparte || <span className="text-marca-300">-</span>}</td>
                      <td className="px-4 py-3 text-marca-500">{g.proximoVencimento ? `Próx: ${formatData(g.proximoVencimento)}` : '-'}</td>
                      <td className="px-4 py-3 text-right font-semibold text-marca-800">
                        {formatBRL(g.totalValor)}
                        <span className="block text-xs font-normal text-marca-400">{g.qtd}x {formatBRL(g.valorParcela)}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {g.pagas === g.qtd ? (
                          <Badge cor="verde">Quitada</Badge>
                        ) : g.temVencida ? (
                          <Badge cor="vermelho">Vencida</Badge>
                        ) : (
                          <Badge cor="ambar">{g.qtd - g.pagas} em aberto</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end">
                          <button onClick={() => setGrupoAberto(g.chave)} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-marca-700 hover:bg-marca-100" title="Ver parcelas">
                            <Layers size={14} /> Ver parcelas <ChevronRight size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal aberto={modalAberto} titulo={form.tipo === 'receber' ? 'Nova conta a receber' : 'Nova conta a pagar'} onFechar={() => setModalAberto(false)} largura="max-w-lg">
        <form onSubmit={salvar} className="space-y-4">
          <Selecao label="Tipo" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoConta })}>
            <option value="receber">A receber (entrada)</option>
            <option value="pagar">A pagar (saída)</option>
          </Selecao>

          <Campo label="Descrição *" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder={form.tipo === 'receber' ? 'Ex.: Parcela do colar, Maria' : 'Ex.: Aluguel da loja'} />

          {form.tipo === 'receber' ? (
            <Selecao label="Cliente" value={form.cliente_id} onChange={(e) => setForm({ ...form, cliente_id: e.target.value })}>
              <option value="">—</option>
              {clientes.map((c) => (<option key={c.id} value={c.id}>{c.nome}</option>))}
            </Selecao>
          ) : (
            <Campo label="Fornecedor" value={form.fornecedor} onChange={(e) => setForm({ ...form, fornecedor: e.target.value })} />
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo label="Valor (R$) *" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} placeholder="0,00" inputMode="decimal" />
            <Campo label="Vencimento" type="date" value={form.vencimento} onChange={(e) => setForm({ ...form, vencimento: e.target.value })} />
          </div>

          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-marca-200 bg-marca-50 px-4 py-3">
            <input type="checkbox" checked={form.recorrente} onChange={(e) => setForm({ ...form, recorrente: e.target.checked })} className="h-4 w-4 accent-marca-900" />
            <Repeat size={18} className="text-marca-500" />
            <span className="text-sm text-marca-700">Conta recorrente (repete em parcelas)</span>
          </label>

          {form.recorrente && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Selecao label="Frequência" value={form.frequencia} onChange={(e) => setForm({ ...form, frequencia: e.target.value })}>
                  {Object.entries(FREQUENCIAS).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
                </Selecao>
                <Campo label="Repetir quantas vezes" type="number" min={1} value={form.vezes} onChange={(e) => setForm({ ...form, vezes: e.target.value })} />
              </div>
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                Serão criadas {Math.max(parseInt(form.vezes || '1', 10), 1)} parcela(s) de {formatBRL(parseCentavos(form.valor))} ({FREQUENCIAS[form.frequencia]?.toLowerCase()}), a 1ª em {formatData(form.vencimento)}.
              </p>
            </>
          )}

          {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{erro}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Botao type="button" variante="secundario" onClick={() => setModalAberto(false)}>Cancelar</Botao>
            <Botao type="submit" disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar'}</Botao>
          </div>
        </form>
      </Modal>

      <Modal aberto={!!grupoDetalhe} titulo={grupoDetalhe?.descricao ?? ''} onFechar={() => setGrupoAberto(null)} largura="max-w-xl">
        {grupoDetalhe && (
          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm text-marca-500">
              <span>{grupoDetalhe.qtd} parcelas · {grupoDetalhe.pagas} pagas · total {formatBRL(grupoDetalhe.totalValor)}</span>
              <button onClick={() => excluirSerie(grupoDetalhe.chave, grupoDetalhe.descricao)} className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700">
                <Trash2 size={13} /> Excluir série
              </button>
            </div>
            <div className="divide-y divide-marca-100 overflow-hidden rounded-lg border border-marca-200">
              {grupoDetalhe.contas.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-2 px-3 py-2.5 text-sm">
                  <span className="text-marca-500">
                    <b className="font-medium text-marca-700">{c.descricao.match(/(\d+\/\d+)/)?.[1] ?? '-'}</b> · {formatData(c.vencimento)}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-marca-700">{formatBRL(c.valor_centavos)}</span>
                    {statusConta(c)}
                    <div className="flex gap-1">
                      {!c.pago && (
                        <button onClick={() => darBaixa(c)} className="rounded-lg p-1.5 text-marca-400 hover:bg-emerald-50 hover:text-emerald-600" title={aba === 'receber' ? 'Marcar como recebido' : 'Marcar como pago'}>
                          <Check size={15} />
                        </button>
                      )}
                      <button onClick={() => excluir(c)} className="rounded-lg p-1.5 text-marca-400 hover:bg-red-50 hover:text-red-600" title="Excluir parcela">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function FluxoCaixa({
  movimentacoes,
  totais,
}: {
  movimentacoes: MovimentacaoCaixa[]
  totais: { entradas: number; saidas: number; saldo: number }
}) {
  if (movimentacoes.length === 0) {
    return <Vazio titulo="Sem movimentações neste período" descricao="Vendas e baixas de contas aparecem aqui." />
  }
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap gap-6 border-b border-marca-200 bg-marca-50 px-4 py-3 text-sm">
        <span className="flex items-center gap-1.5 text-emerald-700"><TrendingUp size={15} /> Entradas: <b>{formatBRL(totais.entradas)}</b></span>
        <span className="flex items-center gap-1.5 text-red-700"><TrendingDown size={15} /> Saídas: <b>{formatBRL(totais.saidas)}</b></span>
        <span className="flex items-center gap-1.5 text-marca-700"><Wallet size={15} /> Saldo: <b>{formatBRL(totais.saldo)}</b></span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-marca-200 text-left text-xs uppercase tracking-wide text-marca-500">
              <th className="px-4 py-3 font-medium">Data</th>
              <th className="px-4 py-3 font-medium">Descrição</th>
              <th className="px-4 py-3 text-right font-medium">Valor</th>
            </tr>
          </thead>
          <tbody>
            {movimentacoes.map((m) => (
              <tr key={m.id} className="border-b border-marca-100 last:border-0">
                <td className="px-4 py-3 text-marca-500">{formatData(m.data)}</td>
                <td className="px-4 py-3 text-marca-700">
                  {m.descricao}
                  {m.categoria && <span className="ml-1 text-xs text-marca-400">· {m.categoria}</span>}
                </td>
                <td className={`px-4 py-3 text-right font-semibold ${m.tipo === 'entrada' ? 'text-emerald-600' : 'text-red-600'}`}>
                  {m.tipo === 'entrada' ? '+' : '-'} {formatBRL(m.valor_centavos)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
