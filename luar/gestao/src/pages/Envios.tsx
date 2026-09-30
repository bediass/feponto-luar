import { useEffect, useMemo, useState } from 'react'
import { Eye, Truck, PackageCheck, ExternalLink, X, ShieldCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  Botao, Campo, Card, Badge, CabecalhoPagina, Vazio, Carregando,
} from '@/components/ui'
import { ModalGarantia } from '@/components/ModalGarantia'
import { formatBRL, formatDataHora } from '@/lib/format'
import type { Venda, Endereco } from '@/types/db'

/**
 * Envios — o que já foi vendido e precisa sair pelos Correios.
 *
 * Era a tela "Pedidos", que juntava os pedidos pagos no site com as vendas
 * marcadas como "será enviado". Em 31/07/2026 a compra online foi desligada
 * (o pedido passa pelo WhatsApp e é lançado em Vendas), então tudo que era do
 * site saiu daqui: origem, filtro Site/Fora do site, status de pagamento do
 * Mercado Pago, código de acompanhamento e reembolso.
 *
 * O que sobrou é o que a operação usa de verdade: a fila do que postar,
 * o código de rastreio e a baixa de entrega.
 */

type Estado = 'a_enviar' | 'enviado' | 'entregue'

interface Envio {
  id: string
  ref: string
  created_at: string
  cliente_nome: string | null
  cliente_email: string | null
  cliente_telefone: string | null
  endereco: Endereco | null
  cidade: string | null
  uf: string | null
  total_centavos: number
  estado: Estado
  rotulo: string
  cor: string
  codigo_rastreio: string | null
  rastreio_url: string | null
  enviado_em: string | null
  entregue_em: string | null
  data_venda: string
}

interface ItemEnvio { nome: string; quantidade: number; preco_unitario_centavos: number }

type VendaCli = Venda & { clientes?: { id: string; nome: string; telefone?: string | null; email?: string | null } | null }

const nowIso = () => new Date().toISOString()

const MAPA: Record<string, { estado: Estado; rotulo: string; cor: string }> = {
  a_enviar: { estado: 'a_enviar', rotulo: 'A enviar', cor: 'azul' },
  enviado: { estado: 'enviado', rotulo: 'Enviado', cor: 'roxo' },
  entregue: { estado: 'entregue', rotulo: 'Entregue', cor: 'verde' },
}

function enderecoLinha(e: Endereco | null): string | null {
  if (!e) return null
  const partes = [
    e.logradouro && e.numero ? `${e.logradouro}, ${e.numero}` : e.logradouro,
    e.complemento,
    e.bairro,
    e.cidade && e.uf ? `${e.cidade}/${e.uf}` : e.cidade,
    e.cep,
  ].filter(Boolean)
  return partes.length ? partes.join(' · ') : null
}

function normalizar(v: VendaCli): Envio {
  const m = MAPA[v.envio_status ?? 'a_enviar'] ?? MAPA.a_enviar
  const end = v.endereco_envio ?? null
  return {
    id: v.id,
    ref: `#${v.numero}`,
    created_at: v.created_at,
    cliente_nome: v.clientes?.nome ?? null,
    cliente_email: v.clientes?.email ?? null,
    cliente_telefone: v.clientes?.telefone ?? null,
    endereco: end,
    cidade: end?.cidade ?? null,
    uf: end?.uf ?? null,
    total_centavos: v.total_centavos,
    estado: m.estado,
    rotulo: m.rotulo,
    cor: m.cor,
    codigo_rastreio: v.codigo_rastreio,
    rastreio_url: v.rastreio_url,
    enviado_em: v.enviado_em,
    entregue_em: v.entregue_em,
    data_venda: v.data_venda,
  }
}

export default function Envios() {
  const [envios, setEnvios] = useState<Envio[]>([])
  const [carregando, setCarregando] = useState(true)
  const [estado, setEstado] = useState<'todos' | Estado>('a_enviar')
  const [aberto, setAberto] = useState<Envio | null>(null)

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    setCarregando(true)
    const { data } = await supabase
      .from('vendas')
      .select('*, clientes(id, nome, telefone, email)')
      .eq('precisa_envio', true)
      .neq('status', 'cancelada')
      .order('created_at', { ascending: false })
    setEnvios(((data as VendaCli[]) ?? []).map(normalizar))
    setCarregando(false)
  }

  const filtrados = useMemo(
    () => envios.filter((e) => estado === 'todos' || e.estado === estado),
    [envios, estado],
  )
  const aEnviar = useMemo(() => envios.filter((e) => e.estado === 'a_enviar').length, [envios])

  async function atualizar(env: Envio, patch: Record<string, unknown>): Promise<Envio | null> {
    const { data, error } = await supabase
      .from('vendas')
      .update(patch)
      .eq('id', env.id)
      .select('*, clientes(id, nome, telefone, email)')
      .single()
    if (error) {
      alert('Erro ao atualizar: ' + error.message)
      return null
    }
    const novo = normalizar(data as unknown as VendaCli)
    setEnvios((atual) => atual.map((x) => (x.id === novo.id ? novo : x)))
    setAberto((a) => (a && a.id === novo.id ? novo : a))
    return novo
  }

  const estados: { id: 'todos' | Estado; rotulo: string; contador?: number }[] = [
    { id: 'a_enviar', rotulo: 'A enviar', contador: aEnviar },
    { id: 'enviado', rotulo: 'Enviados' },
    { id: 'entregue', rotulo: 'Entregues' },
    { id: 'todos', rotulo: 'Todos' },
  ]

  return (
    <div>
      <CabecalhoPagina titulo="Envios" subtitulo="Vendas marcadas para envio pelos Correios" />

      <div className="mb-4 flex flex-wrap gap-2">
        {estados.map((f) => (
          <button
            key={f.id}
            onClick={() => setEstado(f.id)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              estado === f.id ? 'bg-marca-900 text-white' : 'bg-white text-marca-600 border border-marca-200 hover:bg-marca-50'
            }`}
          >
            {f.rotulo}
            {f.contador ? (
              <span className={`rounded-full px-1.5 text-xs ${estado === f.id ? 'bg-white/20' : 'bg-fendi-100 text-fendi-800'}`}>{f.contador}</span>
            ) : null}
          </button>
        ))}
      </div>

      {carregando ? (
        <Carregando />
      ) : filtrados.length === 0 ? (
        <Vazio
          titulo={estado === 'a_enviar' ? 'Nenhum envio pendente' : 'Nenhum envio aqui'}
          descricao={
            estado === 'a_enviar'
              ? 'Ao registrar a venda, marque "será enviado" e preencha o endereço — ela aparece aqui para você postar.'
              : 'Ajuste os filtros para ver outros envios.'
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-marca-200 bg-marca-50 text-left text-xs uppercase tracking-wide text-marca-500">
                  <th className="px-4 py-3 font-medium">Venda</th>
                  <th className="px-4 py-3 font-medium">Data</th>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Cidade</th>
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                  <th className="px-4 py-3 text-center font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((e) => (
                  <tr key={e.id} className="border-b border-marca-100 last:border-0 hover:bg-marca-50/60">
                    <td className="px-4 py-3 font-medium text-marca-700">{e.ref}</td>
                    <td className="px-4 py-3 text-marca-500">{formatDataHora(e.created_at)}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-marca-700">{e.cliente_nome ?? <span className="text-marca-300">-</span>}</p>
                      {e.cliente_email && <p className="text-xs text-marca-400">{e.cliente_email}</p>}
                    </td>
                    <td className="px-4 py-3 text-marca-500">{e.cidade ? `${e.cidade}${e.uf ? '/' + e.uf : ''}` : '-'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-marca-800">{formatBRL(e.total_centavos)}</td>
                    <td className="px-4 py-3 text-center"><Badge cor={e.cor}>{e.rotulo}</Badge></td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {e.estado === 'a_enviar' && (
                          <button onClick={() => setAberto(e)} className="rounded-lg p-1.5 text-marca-400 hover:bg-fendi-50 hover:text-fendi-700" title="Enviar / adicionar rastreio">
                            <Truck size={16} />
                          </button>
                        )}
                        <button onClick={() => setAberto(e)} className="rounded-lg p-1.5 text-marca-400 hover:bg-marca-100 hover:text-marca-700" title="Ver envio">
                          <Eye size={16} />
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

      {aberto && <DetalheEnvio envio={aberto} onFechar={() => setAberto(null)} onAtualizar={atualizar} />}
    </div>
  )
}

function DetalheEnvio({
  envio,
  onFechar,
  onAtualizar,
}: {
  envio: Envio
  onFechar: () => void
  onAtualizar: (env: Envio, patch: Record<string, unknown>) => Promise<Envio | null>
}) {
  const [itens, setItens] = useState<ItemEnvio[]>([])
  const [codigo, setCodigo] = useState(envio.codigo_rastreio ?? '')
  const [url, setUrl] = useState(envio.rastreio_url ?? '')
  const [salvando, setSalvando] = useState(false)
  const [garantiaAberta, setGarantiaAberta] = useState(false)
  const endereco = enderecoLinha(envio.endereco)
  const listaPecas = itens.map((i) => `${i.quantidade}x ${i.nome}`).join(' · ')

  useEffect(() => {
    let vivo = true
    supabase
      .from('venda_itens')
      .select('*')
      .eq('venda_id', envio.id)
      .then(({ data }) => {
        if (vivo) {
          setItens((data ?? []).map((i) => ({
            nome: i.descricao ?? 'Item',
            quantidade: i.quantidade,
            preco_unitario_centavos: i.preco_unitario_centavos,
          })))
        }
      })
    return () => { vivo = false }
  }, [envio.id])

  const podeEnviar = envio.estado === 'a_enviar'
  const jaEnviado = envio.estado === 'enviado' || envio.estado === 'entregue'

  async function salvarEnvio() {
    if (!codigo.trim()) {
      alert('Informe o código de rastreio para marcar como enviado.')
      return
    }
    setSalvando(true)
    await onAtualizar(envio, {
      envio_status: 'enviado',
      codigo_rastreio: codigo.trim(),
      rastreio_url: url.trim() || null,
      enviado_em: envio.enviado_em ?? nowIso(),
    })
    setSalvando(false)
  }

  async function salvarRastreio() {
    setSalvando(true)
    await onAtualizar(envio, { codigo_rastreio: codigo.trim() || null, rastreio_url: url.trim() || null })
    setSalvando(false)
  }

  async function marcarEntregue() {
    if (!confirm('Marcar esta venda como entregue?')) return
    setSalvando(true)
    await onAtualizar(envio, { envio_status: 'entregue', entregue_em: nowIso() })
    setSalvando(false)
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40">
      <div className="flex min-h-full items-start justify-center p-4 sm:items-center">
        <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-marca-200 px-5 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold text-marca-800">Venda {envio.ref}</h3>
              <Badge cor={envio.cor}>{envio.rotulo}</Badge>
            </div>
            <button onClick={onFechar} className="rounded-lg p-1 text-marca-400 hover:bg-marca-100 hover:text-marca-600">
              <X size={20} />
            </button>
          </div>

          <div className="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-4">
            <p className="text-sm text-marca-500">{formatDataHora(envio.created_at)}</p>

            <div className="rounded-lg bg-marca-50 p-3 text-sm">
              <p className="font-medium text-marca-800">{envio.cliente_nome ?? 'Cliente não identificado'}</p>
              {envio.cliente_email && <p className="text-marca-500">{envio.cliente_email}</p>}
              {envio.cliente_telefone && <p className="text-marca-500">{envio.cliente_telefone}</p>}
              {endereco ? (
                <p className="mt-1 text-marca-600">{endereco}</p>
              ) : (
                <p className="mt-1 text-marca-400">Sem endereço na venda — confira no WhatsApp antes de postar.</p>
              )}
            </div>

            <ul className="divide-y divide-marca-100">
              {itens.map((it, i) => (
                <li key={i} className="flex justify-between py-2 text-sm">
                  <span className="text-marca-700">{it.quantidade}x {it.nome}</span>
                  <span className="font-medium text-marca-700">{formatBRL(it.preco_unitario_centavos * it.quantidade)}</span>
                </li>
              ))}
            </ul>
            <div className="flex justify-between border-t border-marca-200 pt-3">
              <span className="font-medium text-marca-600">Total</span>
              <span className="text-lg font-bold text-marca-800">{formatBRL(envio.total_centavos)}</span>
            </div>

            {/* Cartão que vai dentro da caixa — por isso fica aqui, no momento
                de embalar, e não numa tela à parte. */}
            <div className="flex justify-end">
              <Botao variante="secundario" onClick={() => setGarantiaAberta(true)}>
                <ShieldCheck size={16} /> Cartão de garantia
              </Botao>
            </div>

            <div className="rounded-lg border border-marca-200 p-3">
              <p className="mb-2 flex items-center gap-2 text-sm font-medium text-marca-700">
                <Truck size={16} /> Envio e rastreio
              </p>
              <div className="space-y-2">
                <Campo label="Código de rastreio" value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Ex.: AA123456789BR" />
                <Campo label="Link de rastreio (opcional)" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." inputMode="url" />
              </div>
              <div className="mt-3 flex flex-wrap justify-end gap-2">
                {podeEnviar && (
                  <Botao onClick={salvarEnvio} disabled={salvando}>
                    <PackageCheck size={16} /> {salvando ? 'Salvando...' : 'Marcar como enviado'}
                  </Botao>
                )}
                {jaEnviado && (
                  <>
                    <Botao variante="secundario" onClick={salvarRastreio} disabled={salvando}>Salvar rastreio</Botao>
                    {envio.estado === 'enviado' && (
                      <Botao onClick={marcarEntregue} disabled={salvando}>
                        <PackageCheck size={16} /> Marcar entregue
                      </Botao>
                    )}
                  </>
                )}
              </div>
              {envio.enviado_em && <p className="mt-2 text-xs text-marca-400">Enviado em {formatDataHora(envio.enviado_em)}</p>}
              {envio.entregue_em && <p className="text-xs text-marca-400">Entregue em {formatDataHora(envio.entregue_em)}</p>}
              {envio.rastreio_url && (
                <a href={envio.rastreio_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-marca-400 hover:text-marca-700">
                  <ExternalLink size={13} /> Abrir rastreio
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      <ModalGarantia
        aberto={garantiaAberta}
        onFechar={() => setGarantiaAberta(false)}
        referencia={envio.ref}
        cliente={envio.cliente_nome}
        pecas={listaPecas}
        dataISO={envio.data_venda}
      />
    </div>
  )
}
