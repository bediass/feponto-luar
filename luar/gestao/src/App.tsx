import { Routes, Route } from 'react-router-dom'
import Layout from '@/components/Layout'
import ProtectedRoute from '@/components/ProtectedRoute'
import Login from '@/pages/Login'
import RedefinirSenha from '@/pages/RedefinirSenha'
import Dashboard from '@/pages/Dashboard'
import Catalogo from '@/pages/Catalogo'
import Kits from '@/pages/Kits'
import Envios from '@/pages/Envios'
import Clientes from '@/pages/Clientes'
import Vendas from '@/pages/Vendas'
import Financeiro from '@/pages/Financeiro'
import Producao from '@/pages/Producao'
import OrdensServico from '@/pages/OrdensServico'
import Consignacao from '@/pages/Consignacao'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/redefinir-senha" element={<RedefinirSenha />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/estoque" element={<Catalogo />} />
        <Route path="/kits" element={<Kits />} />
        <Route path="/envios" element={<Envios />} />
        <Route path="/vendas" element={<Vendas />} />
        <Route path="/clientes" element={<Clientes />} />
        <Route path="/financeiro" element={<Financeiro />} />
        <Route path="/producao" element={<Producao />} />
        <Route path="/ordens" element={<OrdensServico />} />
        <Route path="/consignacao" element={<Consignacao />} />
      </Route>
    </Routes>
  )
}
