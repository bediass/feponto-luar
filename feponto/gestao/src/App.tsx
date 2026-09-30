import { Routes, Route } from 'react-router-dom'
import Layout from '@/components/Layout'
import ProtectedRoute from '@/components/ProtectedRoute'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import Estoque from '@/pages/Estoque'
import Clientes from '@/pages/Clientes'
import Vendas from '@/pages/Vendas'
import Envios from '@/pages/Envios'
import Financeiro from '@/pages/Financeiro'
import Producao from '@/pages/Producao'
import OrdensServico from '@/pages/OrdensServico'
import Consignacao from '@/pages/Consignacao'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/estoque" element={<Estoque />} />
        <Route path="/clientes" element={<Clientes />} />
        <Route path="/vendas" element={<Vendas />} />
        <Route path="/envios" element={<Envios />} />
        <Route path="/financeiro" element={<Financeiro />} />
        <Route path="/producao" element={<Producao />} />
        <Route path="/ordens" element={<OrdensServico />} />
        <Route path="/consignacao" element={<Consignacao />} />
      </Route>
    </Routes>
  )
}
