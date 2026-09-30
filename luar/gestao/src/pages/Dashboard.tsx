import { useEffect, useState } from 'react'
import { Gem, Users, Truck, AlertCircle, Cake } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { CabecalhoPagina, Card, Carregando } from '@/components/ui'
import { formatBRL } from '@/lib/format'
import type { Cliente } from '@/types/db'

interface Indicadores {
  produtos: number
  clientes: number
  aEnviar: number
  contasAbertas: number
  vendasMes: number
  faturamentoMes: number
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

    // Sem loja online desde 31/07/2026: todo faturamento vem de `vendas`.
    const [produtos, clientes, vendasEnviar, contas, vendas, todosClientes] = await Promise.all([
      supabase.from('produtos').select('id', { count: 'exact', head: true }).eq('ativo', true),
      supabase.from('clientes').select('id', { count: 'exact', head: true }),
      supabase.from('vendas').select('id', { count: 'exact', head: true }).eq('precisa_envio', true).eq('envio_status', 'a_enviar'),
      supabase.from('contas').select('id', { count: 'exact', head: true }).eq('pago', false).eq('tipo', 'pagar'),
      // `em_andamento` entra junto (0021): o registro da venda já lançou a
      // entrada no caixa, então tirar daqui deixaria o Painel abaixo do
      // Financeiro. Só `cancelada` e `orcamento` ficam de fora.
      supabase.from('vendas').select('total_centavos').in('status', ['concluida', 'em_andamento']).gte('data_venda', inicioMes),
      supabase.from('clientes').select('*').not('data_nascimento', 'is', null),
    ])

    const faturamentoMes = (vendas.data ?? []).reduce((s, v) => s + Number(v.total_centavos), 0)
    const aniversariantes = (todosClientes.data ?? []).filter((c: Cliente) => {
      if (!c.data_nascimento) return false
      return Number(c.data_nascimento.slice(5, 7)) === mesAtual
    })

    setDados({
      produtos: produtos.count ?? 0,
      clientes: clientes.count ?? 0,
      aEnviar: vendasEnviar.count ?? 0,
      contasAbertas: contas.count ?? 0,
      vendasMes: (vendas.data ?? []).length,
      faturamentoMes,
      aniversariantes,
    })
    setCarregando(false)
  }

  if (carregando || !dados) return <Carregando />

  const cards = [
    { rotulo: 'Peças no estoque', valor: dados.produtos, icone: Gem, link: '/estoque' },
    { rotulo: 'A enviar', valor: dados.aEnviar, icone: Truck, link: '/envios', destaque: dados.aEnviar > 0 },
    { rotulo: 'Clientes', valor: dados.clientes, icone: Users, link: '/clientes' },
    { rotulo: 'Contas a pagar em aberto', valor: dados.contasAbertas, icone: AlertCircle, link: '/financeiro' },
  ]

  return (
    <div>
      <CabecalhoPagina titulo="Painel" subtitulo="Visão geral da loja" />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.rotulo} to={c.link}>
            <Card className={`p-4 transition-shadow hover:shadow-md ${c.destaque ? 'ring-1 ring-fendi-400' : ''}`}>
              <c.icone className={c.destaque ? 'text-fendi-600' : 'text-marca-500'} size={22} />
              <p className="mt-3 text-2xl font-bold text-marca-800">{c.valor}</p>
              <p className="text-xs text-marca-500">{c.rotulo}</p>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <p className="text-sm font-medium text-marca-500">Faturamento do mês</p>
          <p className="mt-1 font-serif text-4xl font-semibold text-marca-900">{formatBRL(dados.faturamentoMes)}</p>
          <p className="mt-3 text-sm text-marca-500">
            {dados.vendasMes} venda(s) concluída(s) no mês
          </p>
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <Cake size={18} className="text-marca-600" />
            <p className="text-sm font-medium text-marca-600">Aniversariantes do mês</p>
          </div>
          {dados.aniversariantes.length === 0 ? (
            <p className="text-sm text-marca-400">Nenhum aniversariante este mês.</p>
          ) : (
            <ul className="space-y-1.5">
              {dados.aniversariantes.slice(0, 6).map((c) => (
                <li key={c.id} className="flex justify-between text-sm">
                  <span className="text-marca-700">{c.nome}</span>
                  <span className="text-marca-400">dia {c.data_nascimento?.slice(8, 10)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
