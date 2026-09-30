import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Gem,
  Users,
  ShoppingBag,
  Truck,
  Wallet,
  Hammer,
  Wrench,
  Handshake,
  LogOut,
  Menu,
  X,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Logo } from '@/components/Logo'

const navItens = [
  { para: '/', rotulo: 'Painel', icone: LayoutDashboard, fim: true },
  { para: '/estoque', rotulo: 'Estoque', icone: Gem },
  { para: '/clientes', rotulo: 'Clientes', icone: Users },
  { para: '/vendas', rotulo: 'Vendas', icone: ShoppingBag },
  { para: '/envios', rotulo: 'Envios', icone: Truck },
  { para: '/financeiro', rotulo: 'Financeiro', icone: Wallet },
  { para: '/producao', rotulo: 'Produção', icone: Hammer },
  { para: '/ordens', rotulo: 'Consertos', icone: Wrench },
  { para: '/consignacao', rotulo: 'Consignação', icone: Handshake },
]

export default function Layout() {
  const { sair, session } = useAuth()
  const navigate = useNavigate()
  const [menuAberto, setMenuAberto] = useState(false)

  async function handleSair() {
    await sair()
    navigate('/login')
  }

  const conteudoNav = (
    <>
      <div className="flex items-center gap-3 px-5 py-6">
        <Logo className="h-11 text-white" titulo="Fê Ponto Joias" />
        <div>
          <p className="font-serif text-lg font-semibold leading-tight tracking-wide text-white">Fê Ponto</p>
          <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Joias</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {navItens.map((item) => (
          <NavLink
            key={item.para}
            to={item.para}
            end={item.fim}
            onClick={() => setMenuAberto(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-white text-zinc-900'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
              }`
            }
          >
            <item.icone size={18} />
            {item.rotulo}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-zinc-800 px-3 py-3">
        <p className="truncate px-3 pb-2 text-xs text-zinc-500">{session?.user.email}</p>
        <button
          onClick={handleSair}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-zinc-400 hover:bg-zinc-800 hover:text-white"
        >
          <LogOut size={18} />
          Sair
        </button>
      </div>
    </>
  )

  return (
    <div className="flex h-full">
      {/* Sidebar desktop */}
      <aside className="hidden w-60 flex-col bg-zinc-950 lg:flex">{conteudoNav}</aside>

      {/* Sidebar mobile */}
      {menuAberto && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMenuAberto(false)} />
          <aside className="absolute left-0 top-0 flex h-full w-60 flex-col bg-zinc-950">
            {conteudoNav}
          </aside>
        </div>
      )}

      {/* Conteúdo */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center gap-3 border-b border-stone-200 bg-white px-4 py-3 lg:hidden">
          <button onClick={() => setMenuAberto(true)} className="rounded-lg p-1 text-stone-600">
            {menuAberto ? <X size={22} /> : <Menu size={22} />}
          </button>
          <span className="font-serif text-lg font-semibold tracking-wide text-zinc-900">Fê Ponto Joias</span>
        </header>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
