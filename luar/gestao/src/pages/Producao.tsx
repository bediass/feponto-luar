import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Plus, Pencil, Trash2, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  Botao, Campo, Area, Selecao, Card, Modal, Badge, CabecalhoPagina, Vazio, Carregando,
} from '@/components/ui'
import { formatBRL, formatData, parseCentavos, centavosParaInput } from '@/lib/format'
import type { Cliente, Producao as Peca, StatusProducao } from '@/types/db'

const STATUS: Record<StatusProducao, { rotulo: string; cor: string }> = {
  encomendado: { rotulo: 'Encomendado', cor: 'stone' },
  em_producao: { rotulo: 'Em produção', cor: 'ambar' },
  pronto: { rotulo: 'Pronto', cor: 'azul' },
  entregue: { rotulo: 'Entregue', cor: 'verde' },
  cancelado: { rotulo: 'Cancelado', cor: 'vermelho' },
}

const FLUXO: StatusProducao[] = ['encomendado', 'em_producao', 'pronto', 'entregue']

const vazio = {
  descricao: '',
  cliente_id: '',
  responsavel: '',
  status: 'encomendado' as StatusProducao,
  previsao_entrega: '',
  valor: '',
  observacoes: '',
}

export default function Producao() {
  const [pecas, setPecas] = useState<Peca[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [carregando, setCarregando] = useState(true)
  const [filtro, setFiltro] = useState<StatusProducao | 'todos'>('todos')
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<Peca | null>(null)
  const [form, setForm] = useState(vazio)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    setCarregando(true)
    const [p, c] = await Promise.all([
      supabase.from('producao').select('*, clientes(id, nome)').order('created_at', { ascending: false }),
      supabase.from('clientes').select('*').order('nome'),
    ])
    setPecas((p.data as Peca[]) ?? [])
    setClientes((c.data as Cliente[]) ?? [])
    setCarregando(false)
  }

  const filtradas = useMemo(
    () => (filtro === 'todos' ? pecas : pecas.filter((p) => p.status === filtro)),
    [pecas, filtro],
  )

  function abrirNovo() {
    setEditando(null)
    setForm(vazio)
    setErro(null)
    setModalAberto(true)
  }

  function abrirEdicao(p: Peca) {
    setEditando(p)
    setForm({
      descricao: p.descricao,
      cliente_id: p.cliente_id ?? '',
      responsavel: p.responsavel ?? '',
      status: p.status,
      previsao_entrega: p.previsao_entrega ?? '',
      valor: p.valor_centavos != null ? centavosParaInput(p.valor_centavos) : '',
      observacoes: p.observacoes ?? '',
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
      responsavel: form.responsavel.trim() || null,
      status: form.status,
      previsao_entrega: form.previsao_entrega || null,
      valor_centavos: form.valor ? parseCentavos(form.valor) : 0,
      observacoes: form.observacoes.trim() || null,
    }
    const resp = editando
      ? await supabase.from('producao').update(payload).eq('id', editando.id)
      : await supabase.from('producao').insert(payload)
    setSalvando(false)
    if (resp.error) {
      setErro(resp.error.message)
      return
    }
    setModalAberto(false)
    carregar()
  }

  async function avancar(p: Peca) {
    const i = FLUXO.indexOf(p.status)
    if (i < 0 || i >= FLUXO.length - 1) return
    const novo = FLUXO[i + 1]
    setPecas((atual) => atual.map((x) => (x.id === p.id ? { ...x, status: novo } : x)))
    await supabase.from('producao').update({ status: novo }).eq('id', p.id)
  }

  async function excluir(p: Peca) {
    if (!confirm(`Excluir "${p.descricao}"?`)) return
    await supabase.from('producao').delete().eq('id', p.id)
    carregar()
  }

  const filtros: { id: StatusProducao | 'todos'; rotulo: string }[] = [
    { id: 'todos', rotulo: 'Todos' },
    { id: 'encomendado', rotulo: 'Encomendados' },
    { id: 'em_producao', rotulo: 'Em produção' },
    { id: 'pronto', rotulo: 'Prontos' },
    { id: 'entregue', rotulo: 'Entregues' },
  ]

  return (
    <div>
      <CabecalhoPagina
        titulo="Produção"
        subtitulo="Peças encomendadas e em fabricação"
        acao={<Botao onClick={abrirNovo}><Plus size={16} /> Nova encomenda</Botao>}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {filtros.map((f) => (
          <button
            key={f.id}
            onClick={() => setFiltro(f.id)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              filtro === f.id ? 'bg-marca-900 text-white' : 'bg-white text-marca-600 border border-marca-200 hover:bg-marca-50'
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
          titulo="Nenhuma peça aqui"
          descricao="Cadastre uma encomenda para acompanhar onde cada peça está."
          acao={<Botao onClick={abrirNovo}><Plus size={16} /> Nova encomenda</Botao>}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtradas.map((p) => (
            <Card key={p.id} className="flex flex-col p-4">
              <div className="mb-2 flex items-start justify-between gap-2">
                <Badge cor={STATUS[p.status].cor}>{STATUS[p.status].rotulo}</Badge>
                <div className="flex gap-1">
                  <button onClick={() => abrirEdicao(p)} className="rounded-lg p-1.5 text-marca-400 hover:bg-marca-100 hover:text-marca-700" title="Editar">
                    <Pencil size={15} />
                  </button>
                  <button onClick={() => excluir(p)} className="rounded-lg p-1.5 text-marca-400 hover:bg-red-50 hover:text-red-600" title="Excluir">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              <p className="font-medium text-marca-800">{p.descricao}</p>
              <div className="mt-2 space-y-0.5 text-sm text-marca-500">
                {p.clientes?.nome && <p>Cliente: {p.clientes.nome}</p>}
                {p.responsavel && <p>Responsável: {p.responsavel}</p>}
                <p>Previsão: {formatData(p.previsao_entrega)}</p>
                {p.valor_centavos ? <p className="font-medium text-marca-700">{formatBRL(p.valor_centavos)}</p> : null}
              </div>
              {p.status !== 'entregue' && p.status !== 'cancelado' && (
                <button
                  onClick={() => avancar(p)}
                  className="mt-3 flex items-center justify-center gap-1 rounded-lg border border-marca-200 py-1.5 text-sm font-medium text-marca-600 hover:bg-marca-50"
                >
                  Avançar para {STATUS[FLUXO[FLUXO.indexOf(p.status) + 1]].rotulo} <ChevronRight size={15} />
                </button>
              )}
            </Card>
          ))}
        </div>
      )}

      <Modal aberto={modalAberto} titulo={editando ? 'Editar encomenda' : 'Nova encomenda'} onFechar={() => setModalAberto(false)} largura="max-w-lg">
        <form onSubmit={salvar} className="space-y-4">
          <Campo label="Descrição da peça *" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Ex.: Conjunto de brincos personalizado" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Selecao label="Cliente" value={form.cliente_id} onChange={(e) => setForm({ ...form, cliente_id: e.target.value })}>
              <option value="">—</option>
              {clientes.map((c) => (<option key={c.id} value={c.id}>{c.nome}</option>))}
            </Selecao>
            <Campo label="Responsável" value={form.responsavel} onChange={(e) => setForm({ ...form, responsavel: e.target.value })} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Selecao label="Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as StatusProducao })}>
              {Object.entries(STATUS).map(([k, v]) => (<option key={k} value={k}>{v.rotulo}</option>))}
            </Selecao>
            <Campo label="Previsão" type="date" value={form.previsao_entrega} onChange={(e) => setForm({ ...form, previsao_entrega: e.target.value })} />
            <Campo label="Valor (R$)" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} placeholder="0,00" inputMode="decimal" />
          </div>
          <Area label="Observações" rows={2} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
          {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{erro}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Botao type="button" variante="secundario" onClick={() => setModalAberto(false)}>Cancelar</Botao>
            <Botao type="submit" disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar'}</Botao>
          </div>
        </form>
      </Modal>
    </div>
  )
}
