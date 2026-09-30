import { useEffect, useMemo, useState } from 'react'
import { Eye, Truck, PackageCheck, ExternalLink, X, ShieldCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Botao, Campo, Card, Badge, CabecalhoPagina, Vazio, Carregando } from '@/components/ui'
import { ModalCertificado } from '@/components/ModalCertificado'
import { formatBRL, formatDataHora } from '@/lib/format'
import type { Endereco, EnvioStatus, Produto, Venda, VendaItem } from '@/types/db'

/**
 * Envios — as vendas que saem pelos Correios.
 *
 * A venda vira um envio quando é marcada como "será enviado" na tela de
 * Vendas. Aqui fica a fila do que postar, o código de rastreio e a baixa de
 * entrega — o que antes vivia no WhatsApp e no papel.
 *
 * Mesmo desenho da tela Envios da Luar, que nasceu antes. As duas operações
 * são independentes, mas o problema é o mesmo, então o fluxo é igual: quem
 * aprende num sistema sabe usar o outro.
 */

type VendaCli = Venda & { clientes?: { id: string; nome: string } | null }

interface Envio {
  id: string
  ref: string
  cliente_nome: string | null
  endereco: Endereco | null
  cidade: string | null
  uf: string | null
  total: number
  estado: EnvioStatus
  rotulo: string
  cor: string
  codigo_rastreio: string | null
  rastreio_url: string | null
  enviado_em: string | null
  entregue_em: string | null
  data_venda: string
  venda: VendaCli
}

const MAPA: Record<EnvioStatus, { rotulo: string; cor: string }> = {
  a_enviar: { rotulo: 'A enviar', cor: 'ambar' },
  enviado: { rotulo: 'Enviado', cor: 'azul' },
  entregue: { rotulo: 'Entregue', cor: 'verde' },
}

const agoraIso = () => new Date().toISOString()

function enderecoLinha(e: Endereco | null): string | null {
  if (!e) return null
  const partes = [
    e.rua && e.numero ? `${e.rua}, ${e.numero}` : e.rua,
    e.complemento,
    e.bairro,
    e.cidade && e.uf ? `${e.cidade}/${e.uf}` : e.cidade,
    e.cep,
  ].filter(Boolean)
  return partes.length ? partes.join(' · ') : null
}

function normalizar(v: VendaCli): Envio {
  const estado: EnvioStatus = v.envio_status ?? 'a_enviar'
  const m = MAPA[estado] ?? MAPA.a_enviar
  const end = v.endereco_envio ?? null
  return {
    id: v.id,
    ref: `#${v.numero}`,
    cliente_nome: v.clientes?.nome ?? null,
    endereco: end,
    cidade: end?.cidade ?? null,
    uf: end?.uf ?? null,
    total: v.total,
    estado,
    rotulo: m.rotulo,
    cor: m.cor,
    codigo_rastreio: v.codigo_rastreio,
    rastreio_url: v.rastreio_url,
    enviado_em: v.enviado_em,
    entregue_em: v.entregue_em,
    data_venda: v.data_venda,
    venda: v,
  }
}

export default function Envios() {
  const [envios, setEnvios] = useState<Envio[]>([])
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [carregando, setCarregando] = useState(true)
  const [estado, setEstado] = useState<'todos' | EnvioStatus>('a_enviar')
  const [aberto, setAberto] = useState<Envio | null>(null)

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    setCarregando(true)
    const [vendas, prods] = await Promise.all([
      supabase
        .from('vendas')
        .select('*, clientes(id, nome)')
        .eq('precisa_envio', true)
        .neq('status', 'cancelada')
        .order('data_venda', { ascending: false }),
      supabase.from('produtos').select('*').eq('ativo', true),
    ])
    setEnvios(((vendas.data as VendaCli[]) ?? []).map(normalizar))
    setProdutos((prods.data as Produto[]) ?? [])
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
      .select('*, clientes(id, nome)')
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

  const filtros: { id: 'todos' | EnvioStatus; rotulo: string; contador?: number }[] = [
    { id: 'a_enviar', rotulo: 'A enviar', contador: aEnviar },
    { id: 'enviado', rotulo: 'Enviados' },
    { id: 'entregue', rotulo: 'Entregues' },
    { id: 'todos', rotulo: 'Todos' },
  ]

  return (
    <div>
      <CabecalhoPagina titulo="Envios" subtitulo="Vendas que saem pelos Correios" />

      <div className="mb-4 flex flex-wrap gap-2">
        {filtros.map((f) => (
          <button
            key={f.id}
            onClick={() => setEstado(f.id)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              estado === f.id
                ? 'bg-zinc-900 text-white'
                : 'border border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
            }`}
          >
            {f.rotulo}
            {f.contador ? (
              <span className={`rounded-full px-1.5 text-xs ${estado === f.id ? 'bg-white/20' : 'bg-stone-100 text-stone-600'}`}>
                {f.contador}
              </span>
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
              ? 'Na tela de Vendas, marque "será enviado" e preencha o endereço — a venda aparece aqui para você postar.'
              : 'Ajuste os filtros para ver outros envios.'
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
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
                  <tr key={e.id} className="border-b border-stone-100 last:border-0 hover:bg-stone-50/60">
                    <td className="px-4 py-3 font-medium text-stone-700">{e.ref}</td>
                    <td className="px-4 py-3 text-stone-500">{formatDataHora(e.data_venda)}</td>
                    <td className="px-4 py-3 text-stone-700">
                      {e.cliente_nome ?? <span className="text-stone-300">Sem cliente</span>}
                    </td>
                    <td className="px-4 py-3 text-stone-500">
                      {e.cidade ? `${e.cidade}${e.uf ? '/' + e.uf : ''}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-stone-700">{formatBRL(e.total)}</td>
                    <td className="px-4 py-3 text-center">
                      <Badge cor={e.cor}>{e.rotulo}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => setAberto(e)}
                          title={e.estado === 'a_enviar' ? 'Postar / adicionar rastreio' : 'Ver envio'}
                          className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-marca-600"
                        >
                          {e.estado === 'a_enviar' ? <Truck size={16} /> : <Eye size={16} />}
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

      {aberto && (
        <DetalheEnvio
          envio={aberto}
          produtos={produtos}
          onFechar={() => setAberto(null)}
          onAtualizar={atualizar}
        />
      )}
    </div>
  )
}

function DetalheEnvio({
  envio,
  produtos,
  onFechar,
  onAtualizar,
}: {
  envio: Envio
  produtos: Produto[]
  onFechar: () => void
  onAtualizar: (env: Envio, patch: Record<string, unknown>) => Promise<Envio | null>
}) {
  const [itens, setItens] = useState<VendaItem[]>([])
  const [codigo, setCodigo] = useState(envio.codigo_rastreio ?? '')
  const [url, setUrl] = useState(envio.rastreio_url ?? '')
  const [salvando, setSalvando] = useState(false)
  const [certificadoAberto, setCertificadoAberto] = useState(false)
  const endereco = enderecoLinha(envio.endereco)

  useEffect(() => {
    let vivo = true
    supabase
      .from('venda_itens')
      .select('*')
      .eq('venda_id', envio.id)
      .then(({ data }) => {
        if (vivo) setItens((data as VendaItem[]) ?? [])
      })
    return () => {
      vivo = false
    }
  }, [envio.id])

  const podeEnviar = envio.estado === 'a_enviar'
  const jaEnviado = envio.estado === 'enviado' || envio.estado === 'entregue'

  async function marcarEnviado() {
    if (!codigo.trim()) {
      alert('Informe o código de rastreio para marcar como enviado.')
      return
    }
    setSalvando(true)
    await onAtualizar(envio, {
      envio_status: 'enviado',
      codigo_rastreio: codigo.trim(),
      rastreio_url: url.trim() || null,
      enviado_em: envio.enviado_em ?? agoraIso(),
    })
    setSalvando(false)
  }

  async function salvarRastreio() {
    setSalvando(true)
    await onAtualizar(envio, {
      codigo_rastreio: codigo.trim() || null,
      rastreio_url: url.trim() || null,
    })
    setSalvando(false)
  }

  async function marcarEntregue() {
    if (!confirm('Marcar esta venda como entregue?')) return
    setSalvando(true)
    await onAtualizar(envio, { envio_status: 'entregue', entregue_em: agoraIso() })
    setSalvando(false)
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40">
      <div className="flex min-h-full items-start justify-center p-4 sm:items-center">
        <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-stone-200 px-5 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold text-stone-800">Venda {envio.ref}</h3>
              <Badge cor={envio.cor}>{envio.rotulo}</Badge>
            </div>
            <button
              onClick={onFechar}
              className="rounded-lg p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
            >
              <X size={20} />
            </button>
          </div>

          <div className="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-4">
            <p className="text-sm text-stone-500">{formatDataHora(envio.data_venda)}</p>

            <div className="rounded-lg bg-stone-50 p-3 text-sm">
              <p className="font-medium text-stone-800">{envio.cliente_nome ?? 'Cliente não identificado'}</p>
              {endereco ? (
                <p className="mt-1 text-stone-600">{endereco}</p>
              ) : (
                <p className="mt-1 text-stone-400">Sem endereço na venda — confira antes de postar.</p>
              )}
            </div>

            <ul className="divide-y divide-stone-100">
              {itens.map((it) => (
                <li key={it.id} className="flex justify-between py-2 text-sm">
                  <span className="text-stone-700">
                    {it.quantidade}x {it.descricao}
                  </span>
                  <span className="font-medium text-stone-700">{formatBRL(it.subtotal)}</span>
                </li>
              ))}
            </ul>
            <div className="flex justify-between border-t border-stone-200 pt-3">
              <span className="font-medium text-stone-600">Total</span>
              <span className="text-lg font-bold text-stone-800">{formatBRL(envio.total)}</span>
            </div>

            {/* O certificado vai dentro da caixa — por isso fica aqui, no
                momento de embalar, além da tela de Vendas. */}
            <div className="flex justify-end">
              <Botao variante="secundario" onClick={() => setCertificadoAberto(true)}>
                <ShieldCheck size={16} /> Certificado de garantia
              </Botao>
            </div>

            <div className="rounded-lg border border-stone-200 p-3">
              <p className="mb-2 flex items-center gap-2 text-sm font-medium text-stone-700">
                <Truck size={16} /> Envio e rastreio
              </p>
              <div className="space-y-2">
                <Campo
                  label="Código de rastreio"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  placeholder="Ex.: AA123456789BR"
                />
                <Campo
                  label="Link de rastreio (opcional)"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://..."
                  inputMode="url"
                />
              </div>
              <div className="mt-3 flex flex-wrap justify-end gap-2">
                {podeEnviar && (
                  <Botao onClick={marcarEnviado} disabled={salvando}>
                    <PackageCheck size={16} /> {salvando ? 'Salvando…' : 'Marcar como enviado'}
                  </Botao>
                )}
                {jaEnviado && (
                  <>
                    <Botao variante="secundario" onClick={salvarRastreio} disabled={salvando}>
                      Salvar rastreio
                    </Botao>
                    {envio.estado === 'enviado' && (
                      <Botao onClick={marcarEntregue} disabled={salvando}>
                        <PackageCheck size={16} /> Marcar entregue
                      </Botao>
                    )}
                  </>
                )}
              </div>
              {envio.enviado_em && (
                <p className="mt-2 text-xs text-stone-400">Enviado em {formatDataHora(envio.enviado_em)}</p>
              )}
              {envio.entregue_em && (
                <p className="text-xs text-stone-400">Entregue em {formatDataHora(envio.entregue_em)}</p>
              )}
              {envio.rastreio_url && (
                <a
                  href={envio.rastreio_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-xs text-stone-400 hover:text-marca-600"
                >
                  <ExternalLink size={13} /> Abrir rastreio
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      <ModalCertificado
        aberto={certificadoAberto}
        onFechar={() => setCertificadoAberto(false)}
        venda={envio.venda}
        itens={itens}
        produtos={produtos}
        clienteNome={envio.cliente_nome ?? ''}
      />
    </div>
  )
}
