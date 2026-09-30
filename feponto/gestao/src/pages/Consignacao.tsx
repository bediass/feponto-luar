import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Plus, Pencil, Trash2, Check, Undo2 } from 'lucide-react'
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
import { formatBRL, parseValor } from '@/lib/format'
import type { Consignacao as Item, StatusConsignacao } from '@/types/db'

const STATUS: Record<StatusConsignacao, { rotulo: string; cor: string }> = {
  em_loja: { rotulo: 'Em loja', cor: 'azul' },
  vendida: { rotulo: 'Vendida', cor: 'verde' },
  devolvida: { rotulo: 'Devolvida', cor: 'stone' },
}

const hoje = () => new Date().toISOString().slice(0, 10)

const vazio = {
  fornecedor: '',
  descricao: '',
  codigo: '',
  peso_gramas: '',
  valor_fornecedor: '',
  preco_venda: '',
  quantidade: '1',
  observacoes: '',
}

export default function Consignacao() {
  const [itens, setItens] = useState<Item[]>([])
  const [carregando, setCarregando] = useState(true)
  const [filtro, setFiltro] = useState<StatusConsignacao | 'todos'>('em_loja')
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<Item | null>(null)
  const [form, setForm] = useState(vazio)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    setCarregando(true)
    const { data } = await supabase.from('consignacoes').select('*').order('fornecedor').order('created_at', { ascending: false })
    setItens((data as Item[]) ?? [])
    setCarregando(false)
  }

  const filtrados = useMemo(
    () => (filtro === 'todos' ? itens : itens.filter((i) => i.status === filtro)),
    [itens, filtro],
  )

  const totalEmLoja = useMemo(
    () => itens.filter((i) => i.status === 'em_loja').reduce((s, i) => s + Number(i.valor_fornecedor ?? 0) * i.quantidade, 0),
    [itens],
  )

  function abrirNovo() {
    setEditando(null)
    setForm(vazio)
    setErro(null)
    setModalAberto(true)
  }

  function abrirEdicao(i: Item) {
    setEditando(i)
    setForm({
      fornecedor: i.fornecedor,
      descricao: i.descricao,
      codigo: i.codigo ?? '',
      peso_gramas: i.peso_gramas != null ? String(i.peso_gramas) : '',
      valor_fornecedor: i.valor_fornecedor != null ? String(i.valor_fornecedor) : '',
      preco_venda: i.preco_venda != null ? String(i.preco_venda) : '',
      quantidade: String(i.quantidade),
      observacoes: i.observacoes ?? '',
    })
    setErro(null)
    setModalAberto(true)
  }

  async function salvar(e: FormEvent) {
    e.preventDefault()
    if (!form.fornecedor.trim() || !form.descricao.trim()) {
      setErro('Fornecedor e descrição são obrigatórios.')
      return
    }
    setSalvando(true)
    const payload = {
      fornecedor: form.fornecedor.trim(),
      descricao: form.descricao.trim(),
      codigo: form.codigo.trim() || null,
      peso_gramas: form.peso_gramas ? parseValor(form.peso_gramas) : null,
      valor_fornecedor: form.valor_fornecedor ? parseValor(form.valor_fornecedor) : 0,
      preco_venda: form.preco_venda ? parseValor(form.preco_venda) : 0,
      quantidade: parseInt(form.quantidade || '1', 10),
      observacoes: form.observacoes.trim() || null,
    }
    const resp = editando
      ? await supabase.from('consignacoes').update(payload).eq('id', editando.id)
      : await supabase.from('consignacoes').insert(payload)
    setSalvando(false)
    if (resp.error) {
      setErro(resp.error.message)
      return
    }
    setModalAberto(false)
    carregar()
  }

  async function mudarStatus(i: Item, status: StatusConsignacao) {
    const rotulo = status === 'vendida' ? 'vendida' : 'devolvida ao fornecedor'
    if (!confirm(`Marcar "${i.descricao}" como ${rotulo}?`)) return
    await supabase
      .from('consignacoes')
      .update({ status, data_saida: hoje() })
      .eq('id', i.id)
    carregar()
  }

  async function excluir(i: Item) {
    if (!confirm(`Excluir "${i.descricao}"?`)) return
    await supabase.from('consignacoes').delete().eq('id', i.id)
    carregar()
  }

  const filtros: { id: StatusConsignacao | 'todos'; rotulo: string }[] = [
    { id: 'em_loja', rotulo: 'Em loja' },
    { id: 'vendida', rotulo: 'Vendidas' },
    { id: 'devolvida', rotulo: 'Devolvidas' },
    { id: 'todos', rotulo: 'Todas' },
  ]

  return (
    <div>
      <CabecalhoPagina
        titulo="Consignação"
        subtitulo="Peças recebidas de fornecedores"
        acao={<Botao onClick={abrirNovo}><Plus size={16} /> Nova peça consignada</Botao>}
      />

      <Card className="mb-4 inline-block p-4">
        <p className="text-xs text-stone-500">Total consignado em loja (custo a pagar se vender)</p>
        <p className="mt-1 text-2xl font-bold text-stone-800">{formatBRL(totalEmLoja)}</p>
      </Card>

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
      ) : filtrados.length === 0 ? (
        <Vazio
          titulo="Nenhuma peça consignada aqui"
          descricao="Cadastre as peças que você recebe de fornecedores para vender."
          acao={<Botao onClick={abrirNovo}><Plus size={16} /> Nova peça consignada</Botao>}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
                  <th className="px-4 py-3 font-medium">Fornecedor</th>
                  <th className="px-4 py-3 font-medium">Peça</th>
                  <th className="px-4 py-3 text-right font-medium">Custo</th>
                  <th className="px-4 py-3 text-right font-medium">Venda</th>
                  <th className="px-4 py-3 text-center font-medium">Qtd</th>
                  <th className="px-4 py-3 text-center font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((i) => (
                  <tr key={i.id} className="border-b border-stone-100 last:border-0 hover:bg-stone-50/60">
                    <td className="px-4 py-3 font-medium text-stone-700">{i.fornecedor}</td>
                    <td className="px-4 py-3">
                      <p className="text-stone-800">{i.descricao}</p>
                      {(i.codigo || i.peso_gramas) && (
                        <p className="text-xs text-stone-400">
                          {i.codigo}{i.codigo && i.peso_gramas ? ' · ' : ''}{i.peso_gramas ? `${i.peso_gramas}g` : ''}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-stone-600">{formatBRL(i.valor_fornecedor)}</td>
                    <td className="px-4 py-3 text-right font-medium text-stone-800">{formatBRL(i.preco_venda)}</td>
                    <td className="px-4 py-3 text-center text-stone-600">{i.quantidade}</td>
                    <td className="px-4 py-3 text-center"><Badge cor={STATUS[i.status].cor}>{STATUS[i.status].rotulo}</Badge></td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {i.status === 'em_loja' && (
                          <>
                            <button onClick={() => mudarStatus(i, 'vendida')} className="rounded-lg p-1.5 text-stone-400 hover:bg-emerald-50 hover:text-emerald-600" title="Marcar como vendida">
                              <Check size={16} />
                            </button>
                            <button onClick={() => mudarStatus(i, 'devolvida')} className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600" title="Devolver ao fornecedor">
                              <Undo2 size={16} />
                            </button>
                          </>
                        )}
                        <button onClick={() => abrirEdicao(i)} className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-marca-600" title="Editar">
                          <Pencil size={16} />
                        </button>
                        <button onClick={() => excluir(i)} className="rounded-lg p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-600" title="Excluir">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal aberto={modalAberto} titulo={editando ? 'Editar peça consignada' : 'Nova peça consignada'} onFechar={() => setModalAberto(false)} largura="max-w-lg">
        <form onSubmit={salvar} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo label="Fornecedor *" value={form.fornecedor} onChange={(e) => setForm({ ...form, fornecedor: e.target.value })} />
            <Campo label="Código" value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} />
          </div>
          <Campo label="Descrição da peça *" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Ex.: Colar de prata com pingente" />
          <div className="grid gap-4 sm:grid-cols-3">
            <Campo label="Peso (g)" value={form.peso_gramas} onChange={(e) => setForm({ ...form, peso_gramas: e.target.value })} placeholder="0,0" inputMode="decimal" />
            <Campo label="Custo fornecedor (R$)" value={form.valor_fornecedor} onChange={(e) => setForm({ ...form, valor_fornecedor: e.target.value })} placeholder="0,00" inputMode="decimal" />
            <Campo label="Preço de venda (R$)" value={form.preco_venda} onChange={(e) => setForm({ ...form, preco_venda: e.target.value })} placeholder="0,00" inputMode="decimal" />
          </div>
          <Campo label="Quantidade" type="number" min={1} value={form.quantidade} onChange={(e) => setForm({ ...form, quantidade: e.target.value })} />
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
