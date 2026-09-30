import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Plus, Pencil, Trash2, ChevronRight } from 'lucide-react'
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
import { formatBRL, formatData, parseValor } from '@/lib/format'
import type { Cliente, OrdemServico, StatusOS } from '@/types/db'

const STATUS: Record<StatusOS, { rotulo: string; cor: string }> = {
  recebido: { rotulo: 'Recebido', cor: 'stone' },
  em_servico: { rotulo: 'Em serviço', cor: 'ambar' },
  pronto: { rotulo: 'Pronto', cor: 'azul' },
  entregue: { rotulo: 'Entregue', cor: 'verde' },
}

const FLUXO: StatusOS[] = ['recebido', 'em_servico', 'pronto', 'entregue']

const TIPOS: Record<string, string> = {
  conserto: 'Conserto',
  ajuste_aro: 'Ajuste de aro',
  banho: 'Banho',
  polimento: 'Polimento',
  outro: 'Outro',
}

const vazio = {
  descricao: '',
  cliente_id: '',
  tipo: 'conserto',
  status: 'recebido' as StatusOS,
  valor: '',
  previsao: '',
  responsavel: '',
  observacoes: '',
}

export default function OrdensServico() {
  const [ordens, setOrdens] = useState<OrdemServico[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [carregando, setCarregando] = useState(true)
  const [filtro, setFiltro] = useState<StatusOS | 'todos'>('todos')
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<OrdemServico | null>(null)
  const [form, setForm] = useState(vazio)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    setCarregando(true)
    const [o, c] = await Promise.all([
      supabase.from('ordens_servico').select('*, clientes(id, nome)').order('created_at', { ascending: false }),
      supabase.from('clientes').select('*').order('nome'),
    ])
    setOrdens((o.data as OrdemServico[]) ?? [])
    setClientes((c.data as Cliente[]) ?? [])
    setCarregando(false)
  }

  const filtradas = useMemo(
    () => (filtro === 'todos' ? ordens : ordens.filter((o) => o.status === filtro)),
    [ordens, filtro],
  )

  function abrirNovo() {
    setEditando(null)
    setForm(vazio)
    setErro(null)
    setModalAberto(true)
  }

  function abrirEdicao(o: OrdemServico) {
    setEditando(o)
    setForm({
      descricao: o.descricao,
      cliente_id: o.cliente_id ?? '',
      tipo: o.tipo ?? 'conserto',
      status: o.status,
      valor: o.valor != null ? String(o.valor) : '',
      previsao: o.previsao ?? '',
      responsavel: o.responsavel ?? '',
      observacoes: o.observacoes ?? '',
    })
    setErro(null)
    setModalAberto(true)
  }

  async function salvar(e: FormEvent) {
    e.preventDefault()
    if (!form.descricao.trim()) {
      setErro('A descrição é obrigatória.')
      return
    }
    setSalvando(true)
    const payload = {
      descricao: form.descricao.trim(),
      cliente_id: form.cliente_id || null,
      tipo: form.tipo,
      status: form.status,
      valor: form.valor ? parseValor(form.valor) : 0,
      previsao: form.previsao || null,
      responsavel: form.responsavel.trim() || null,
      observacoes: form.observacoes.trim() || null,
    }
    const resp = editando
      ? await supabase.from('ordens_servico').update(payload).eq('id', editando.id)
      : await supabase.from('ordens_servico').insert(payload)
    setSalvando(false)
    if (resp.error) {
      setErro(resp.error.message)
      return
    }
    setModalAberto(false)
    carregar()
  }

  async function avancar(o: OrdemServico) {
    const i = FLUXO.indexOf(o.status)
    if (i < 0 || i >= FLUXO.length - 1) return
    const novo = FLUXO[i + 1]
    setOrdens((atual) => atual.map((x) => (x.id === o.id ? { ...x, status: novo } : x)))
    await supabase.from('ordens_servico').update({ status: novo }).eq('id', o.id)
  }

  async function excluir(o: OrdemServico) {
    if (!confirm(`Excluir a OS #${o.numero}?`)) return
    await supabase.from('ordens_servico').delete().eq('id', o.id)
    carregar()
  }

  const filtros: { id: StatusOS | 'todos'; rotulo: string }[] = [
    { id: 'todos', rotulo: 'Todas' },
    { id: 'recebido', rotulo: 'Recebidas' },
    { id: 'em_servico', rotulo: 'Em serviço' },
    { id: 'pronto', rotulo: 'Prontas' },
    { id: 'entregue', rotulo: 'Entregues' },
  ]

  return (
    <div>
      <CabecalhoPagina
        titulo="Consertos"
        subtitulo="Ordens de serviço — consertos, ajustes, banho"
        acao={<Botao onClick={abrirNovo}><Plus size={16} /> Nova ordem</Botao>}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {filtros.map((f) => (
          <button
            key={f.id}
            onClick={() => setFiltro(f.id)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              filtro === f.id ? 'bg-zinc-900 text-white' : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
            }`}
          >
            {f.rotulo}
          </button>
        ))}
      </div>

      {carregando ? (
        <Carregando />
      ) : filtradas.length === 0 ? (
        <Vazio
          titulo="Nenhuma ordem de serviço"
          descricao="Registre consertos e ajustes para acompanhar o andamento."
          acao={<Botao onClick={abrirNovo}><Plus size={16} /> Nova ordem</Botao>}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtradas.map((o) => (
            <Card key={o.id} className="flex flex-col p-4">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-stone-400">OS #{o.numero}</span>
                  <Badge cor={STATUS[o.status].cor}>{STATUS[o.status].rotulo}</Badge>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => abrirEdicao(o)} className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-marca-600" title="Editar">
                    <Pencil size={15} />
                  </button>
                  <button onClick={() => excluir(o)} className="rounded-lg p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-600" title="Excluir">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              <p className="font-medium text-stone-800">{o.descricao}</p>
              <div className="mt-2 space-y-0.5 text-sm text-stone-500">
                {o.tipo && <p>{TIPOS[o.tipo] ?? o.tipo}</p>}
                {o.clientes?.nome && <p>Cliente: {o.clientes.nome}</p>}
                <p>Previsão: {formatData(o.previsao)}</p>
                {o.valor ? <p className="font-medium text-stone-700">{formatBRL(o.valor)}</p> : null}
              </div>
              {o.status !== 'entregue' && (
                <button
                  onClick={() => avancar(o)}
                  className="mt-3 flex items-center justify-center gap-1 rounded-lg border border-stone-200 py-1.5 text-sm font-medium text-stone-600 hover:bg-stone-50"
                >
                  Avançar para {STATUS[FLUXO[FLUXO.indexOf(o.status) + 1]].rotulo} <ChevronRight size={15} />
                </button>
              )}
            </Card>
          ))}
        </div>
      )}

      <Modal aberto={modalAberto} titulo={editando ? `Editar OS #${editando.numero}` : 'Nova ordem de serviço'} onFechar={() => setModalAberto(false)} largura="max-w-lg">
        <form onSubmit={salvar} className="space-y-4">
          <Campo label="Descrição do serviço *" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Ex.: Trocar fecho e polir corrente" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Selecao label="Tipo" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
              {Object.entries(TIPOS).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
            </Selecao>
            <Selecao label="Cliente" value={form.cliente_id} onChange={(e) => setForm({ ...form, cliente_id: e.target.value })}>
              <option value="">—</option>
              {clientes.map((c) => (<option key={c.id} value={c.id}>{c.nome}</option>))}
            </Selecao>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Selecao label="Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as StatusOS })}>
              {Object.entries(STATUS).map(([k, v]) => (<option key={k} value={k}>{v.rotulo}</option>))}
            </Selecao>
            <Campo label="Previsão" type="date" value={form.previsao} onChange={(e) => setForm({ ...form, previsao: e.target.value })} />
            <Campo label="Valor (R$)" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} placeholder="0,00" inputMode="decimal" />
          </div>
          <Campo label="Responsável" value={form.responsavel} onChange={(e) => setForm({ ...form, responsavel: e.target.value })} />
          <Area label="Observações" rows={2} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
          {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{erro}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Botao type="button" variante="secundario" onClick={() => setModalAberto(false)}>Cancelar</Botao>
            <Botao type="submit" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</Botao>
          </div>
        </form>
      </Modal>
    </div>
  )
}
