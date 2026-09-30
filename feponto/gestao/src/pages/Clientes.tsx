import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Plus, Search, Pencil, Trash2, Phone, Mail, Cake } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  Botao,
  Campo,
  Area,
  Card,
  Modal,
  CabecalhoPagina,
  Vazio,
  Carregando,
} from '@/components/ui'
import { formatData } from '@/lib/format'
import type { Cliente } from '@/types/db'

const vazio = {
  nome: '',
  telefone: '',
  email: '',
  cpf: '',
  data_nascimento: '',
  cidade: '',
  observacoes: '',
}

type FormState = typeof vazio

export default function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [carregando, setCarregando] = useState(true)
  const [busca, setBusca] = useState('')
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<Cliente | null>(null)
  const [form, setForm] = useState<FormState>(vazio)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    setCarregando(true)
    const { data } = await supabase.from('clientes').select('*').order('nome')
    setClientes((data as Cliente[]) ?? [])
    setCarregando(false)
  }

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase()
    if (!t) return clientes
    return clientes.filter(
      (c) =>
        c.nome.toLowerCase().includes(t) ||
        (c.telefone ?? '').includes(t) ||
        (c.email ?? '').toLowerCase().includes(t),
    )
  }, [clientes, busca])

  function abrirNovo() {
    setEditando(null)
    setForm(vazio)
    setErro(null)
    setModalAberto(true)
  }

  function abrirEdicao(c: Cliente) {
    setEditando(c)
    setForm({
      nome: c.nome,
      telefone: c.telefone ?? '',
      email: c.email ?? '',
      cpf: c.cpf ?? '',
      data_nascimento: c.data_nascimento ?? '',
      cidade: c.endereco?.cidade ?? '',
      observacoes: c.observacoes ?? '',
    })
    setErro(null)
    setModalAberto(true)
  }

  async function salvar(e: FormEvent) {
    e.preventDefault()
    if (!form.nome.trim()) {
      setErro('O nome é obrigatório.')
      return
    }
    setSalvando(true)
    const payload = {
      nome: form.nome.trim(),
      telefone: form.telefone.trim() || null,
      email: form.email.trim() || null,
      cpf: form.cpf.trim() || null,
      data_nascimento: form.data_nascimento || null,
      endereco: form.cidade.trim() ? { cidade: form.cidade.trim() } : null,
      observacoes: form.observacoes.trim() || null,
    }
    const resposta = editando
      ? await supabase.from('clientes').update(payload).eq('id', editando.id)
      : await supabase.from('clientes').insert(payload)
    setSalvando(false)
    if (resposta.error) {
      setErro(resposta.error.message)
      return
    }
    setModalAberto(false)
    carregar()
  }

  async function excluir(c: Cliente) {
    if (!confirm(`Excluir o cliente "${c.nome}"?`)) return
    await supabase.from('clientes').delete().eq('id', c.id)
    carregar()
  }

  return (
    <div>
      <CabecalhoPagina
        titulo="Clientes"
        subtitulo={`${clientes.length} cliente(s) cadastrado(s)`}
        acao={
          <Botao onClick={abrirNovo}>
            <Plus size={16} /> Novo cliente
          </Botao>
        }
      />

      <div className="relative mb-4">
        <Search size={18} className="absolute left-3 top-2.5 text-stone-400" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome, telefone ou e-mail…"
          className="w-full rounded-lg border border-stone-300 bg-white py-2 pl-10 pr-3 text-sm outline-none focus:border-marca-500 focus:ring-2 focus:ring-marca-200"
        />
      </div>

      {carregando ? (
        <Carregando />
      ) : filtrados.length === 0 ? (
        <Vazio
          titulo={busca ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}
          descricao={busca ? 'Tente outra busca.' : 'Cadastre o primeiro cliente.'}
          acao={!busca && <Botao onClick={abrirNovo}><Plus size={16} /> Novo cliente</Botao>}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtrados.map((c) => (
            <Card key={c.id} className="flex flex-col p-4">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-stone-800">{c.nome}</p>
                  {c.endereco?.cidade && <p className="text-xs text-stone-400">{c.endereco.cidade}</p>}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => abrirEdicao(c)} className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-marca-600">
                    <Pencil size={15} />
                  </button>
                  <button onClick={() => excluir(c)} className="rounded-lg p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-600">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              <div className="mt-3 space-y-1 text-sm text-stone-500">
                {c.telefone && <p className="flex items-center gap-2"><Phone size={13} /> {c.telefone}</p>}
                {c.email && <p className="flex items-center gap-2 truncate"><Mail size={13} /> {c.email}</p>}
                {c.data_nascimento && <p className="flex items-center gap-2"><Cake size={13} /> {formatData(c.data_nascimento)}</p>}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        aberto={modalAberto}
        titulo={editando ? 'Editar cliente' : 'Novo cliente'}
        onFechar={() => setModalAberto(false)}
        largura="max-w-lg"
      >
        <form onSubmit={salvar} className="space-y-4">
          <Campo label="Nome *" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo label="Telefone / WhatsApp" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} placeholder="(00) 00000-0000" />
            <Campo label="E-mail" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo label="CPF" value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} />
            <Campo label="Data de nascimento" type="date" value={form.data_nascimento} onChange={(e) => setForm({ ...form, data_nascimento: e.target.value })} />
          </div>
          <Campo label="Cidade" value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} />
          <Area label="Observações" rows={2} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} placeholder="Preferências, tamanho de aro, etc." />
          {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{erro}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Botao type="button" variante="secundario" onClick={() => setModalAberto(false)}>Cancelar</Botao>
            <Botao type="submit" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</Botao>
          </div>
        </form>
      </Modal>
    </div>
  )
}
