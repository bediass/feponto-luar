import { useEffect, useState } from 'react'
import { Gem, Users, ShoppingBag, AlertCircle, Cake } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { CabecalhoPagina, Card, Carregando } from '@/components/ui'
import { formatBRL } from '@/lib/format'
import type { Cliente } from '@/types/db'

interface Indicadores {
  produtos: number
  clientes: number
  vendasMes: number
  faturamentoMes: number
  contasVencendo: number
  aniversariantes: Cliente[]
}

export default function Dashboard() {
  const [dados, setDados] = useState<Indicadores | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    setCarregando(true)
    const agora = new Date()
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString()
    const mesAtual = agora.getMonth() + 1

    const [produtos, clientes, vendas, contas, todosClientes] = await Promise.all([
      supabase.from('produtos').select('id', { count: 'exact', head: true }).eq('ativo', true),
      supabase.from('clientes').select('id', { count: 'exact', head: true }),
      supabase.from('vendas').select('total').eq('status', 'concluida').gte('data_venda', inicioMes),
      supabase
        .from('contas')
        .select('id', { count: 'exact', head: true })
        .eq('pago', false)
        .eq('tipo', 'pagar'),
      supabase.from('clientes').select('*').not('data_nascimento', 'is', null),
    ])

    const faturamento = (vendas.data ?? []).reduce((s, v) => s + Number(v.total), 0)
    const aniversariantes = (todosClientes.data ?? []).filter((c: Cliente) => {
      if (!c.data_nascimento) return false
      return Number(c.data_nascimento.slice(5, 7)) === mesAtual
    })

    setDados({
      produtos: produtos.count ?? 0,
      clientes: clientes.count ?? 0,
      vendasMes: (vendas.data ?? []).length,
      faturamentoMes: faturamento,
      contasVencendo: contas.count ?? 0,
      aniversariantes,
    })
    setCarregando(false)
  }

  if (carregando || !dados) return <Carregando />

  const cards = [
    { rotulo: 'Peças no estoque', valor: dados.produtos, icone: Gem, cor: 'text-zinc-700', link: '/estoque' },
    { rotulo: 'Clientes', valor: dados.clientes, icone: Users, cor: 'text-zinc-700', link: '/clientes' },
    { rotulo: 'Vendas no mês', valor: dados.vendasMes, icone: ShoppingBag, cor: 'text-zinc-700', link: '/vendas' },
    { rotulo: 'Contas a pagar em aberto', valor: dados.contasVencendo, icone: AlertCircle, cor: 'text-zinc-700', link: '/financeiro' },
  ]

  return (
    <div>
      <CabecalhoPagina titulo="Painel" subtitulo="Visão geral da loja" />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.rotulo} to={c.link}>
            <Card className="p-4 transition-shadow hover:shadow-md">
              <c.icone className={c.cor} size={22} />
              <p className="mt-3 text-2xl font-bold text-stone-800">{c.valor}</p>
              <p className="text-xs text-stone-500">{c.rotulo}</p>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <p className="text-sm font-medium text-stone-500">Faturamento do mês</p>
          <p className="mt-1 font-serif text-4xl font-semibold text-zinc-900">{formatBRL(dados.faturamentoMes)}</p>
          <p className="mt-1 text-xs text-stone-400">{dados.vendasMes} venda(s) concluída(s)</p>
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <Cake size={18} className="text-zinc-700" />
            <p className="text-sm font-medium text-stone-600">Aniversariantes do mês</p>
          </div>
          {dados.aniversariantes.length === 0 ? (
            <p className="text-sm text-stone-400">Nenhum aniversariante este mês.</p>
          ) : (
            <ul className="space-y-1.5">
              {dados.aniversariantes.slice(0, 6).map((c) => (
                <li key={c.id} className="flex justify-between text-sm">
                  <span className="text-stone-700">{c.nome}</span>
                  <span className="text-stone-400">dia {c.data_nascimento?.slice(8, 10)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
