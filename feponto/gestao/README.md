# Feponto Gestão

Sistema de gestão interna (ERP) da joalheria **Feponto**. Uso interno da dona e da filha, com banco de dados compartilhado com o site público da loja.

## Tecnologias

- **Front-end:** React + TypeScript + Vite + Tailwind CSS
- **Back-end / Banco:** Supabase (PostgreSQL + Autenticação + Storage)
- **Roteamento:** React Router

## Como rodar localmente

```bash
npm install
npm run dev
```

O app sobe em `http://localhost:5173`.

As credenciais do Supabase ficam em `.env.local` (não versionado):

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## Login de teste

- **E-mail:** `teste@feponto.com.br`
- **Senha:** `feponto123`

> Trocar/remover antes de entregar para a loja. As contas reais (dona e filha) devem ser criadas no painel do Supabase (Authentication → Users).

## Estrutura

```
src/
  components/   # Layout, ProtectedRoute, kit de UI (ui.tsx)
  contexts/     # AuthContext (sessão Supabase)
  lib/          # supabase.ts (cliente), format.ts (moeda/data)
  pages/        # Login, Dashboard, Estoque, Clientes, EmBreve (stubs)
  types/        # db.ts (tipos das tabelas)
```

## Módulos

| Módulo | Status |
|---|---|
| Login / Autenticação | ✅ Pronto |
| Painel (indicadores) | ✅ Pronto |
| Estoque (peças + visível no site) | ✅ Pronto |
| Clientes (com aniversário) | ✅ Pronto |
| Vendas + Fluxo de caixa | ✅ Pronto |
| Financeiro (a receber / a pagar + recorrência) | ✅ Pronto |
| Produção / Encomendas | ✅ Pronto |
| Consertos (Ordens de serviço) | ✅ Pronto |
| Consignação (de fornecedores) | ✅ Pronto |
| Certificado de garantia (PDF) | 🔜 Futuro |
| Cupom fiscal (NFC-e) | 🔜 Futuro (com contador) |
| Integração WhatsApp | 🔜 Futuro |

## Integração com o site

O site público usa a **mesma base Supabase**. Uma peça só aparece no site quando o campo `visivel_no_site` está marcado (botão "No site / Oculto" na tela de Estoque). As políticas de segurança (RLS) garantem que visitantes anônimos leem **apenas** peças visíveis e ativas — nunca clientes, vendas ou financeiro.

## Banco de dados

Migrations aplicadas via Supabase. Tabelas principais: `produtos`, `categorias`, `clientes`, `vendas`, `venda_itens`, `pagamentos`, `contas`, `movimentacoes_caixa`, `producao`, `ordens_servico`, `consignacoes`, `profiles`.
