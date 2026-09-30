import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { Plus, Pencil, Trash2, Star, StarOff, Search, X, Package, AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Botao, Card, Campo, Area, Interruptor, Badge, Modal, CabecalhoPagina, Vazio, Carregando } from '@/components/ui'
import { formatBRL, parseCentavos } from '@/lib/format'
import { GaleriaFotos, VisorFoto } from '@/components/GaleriaFotos'
import { useLixoFotos, apagarFotosDoStorage } from '@/lib/lixoFotos'
import { slugify } from '@/lib/taxonomia'
import type { Kit, KitItem, Produto } from '@/types/db'

// As três posições da home. O grid `.kits` do index.html tem exatamente
// três espaços, e o banco recusa uma quarta (índice único parcial em
// `destaque_ordem` — ver 0016_kits.sql).
const POSICOES = [1, 2, 3] as const

type KitComItens = Kit & { itens: (KitItem & { produto: Produto })[] }

type FormKit = {
  nome: string
  subtitulo: string
  selo: string
  precoTexto: string
  preco_manual: boolean
  fotos: string[]
  ativo: boolean
  visivel_no_site: boolean
  destaque_site: boolean
  destaque_ordem: number | null
  esconder_sem_estoque: boolean
  itens: { produto_id: string; quantidade: number }[]
}

const FORM_VAZIO: FormKit = {
  nome: '', subtitulo: '', selo: '', precoTexto: '', preco_manual: false,
  fotos: [], ativo: true, visivel_no_site: false,
  destaque_site: false, destaque_ordem: null, esconder_sem_estoque: true,
  itens: [],
}

/** Quantos kits dá pra montar com o estoque de hoje. Mesma conta da
 *  view `kits_site` do banco — se mudar aqui, mudar lá. */
function montaveis(itens: { quantidade: number; produto: Produto }[]): number {
  if (itens.length === 0) return 0
  return Math.min(...itens.map((i) => Math.floor(i.produto.estoque / i.quantidade)))
}

function somaPecas(itens: { quantidade: number; produto: Produto }[]): number {
  return itens.reduce((t, i) => t + i.produto.preco_centavos * i.quantidade, 0)
}

export default function Kits() {
  const [kits, setKits] = useState<KitComItens[]>([])
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const [modalAberto, setModalAberto] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [form, setForm] = useState<FormKit>(FORM_VAZIO)
  const [buscaPeca, setBuscaPeca] = useState('')
  const [enviandoFoto, setEnviandoFoto] = useState(false)
  const lixoFotos = useLixoFotos()
  const [fotoZoom, setFotoZoom] = useState<{ url: string; nome: string } | null>(null)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setCarregando(true)
    const [rk, rp] = await Promise.all([
      supabase.from('kits').select('*, kit_itens(*, produto:produtos(*))').order('created_at', { ascending: false }),
      supabase.from('produtos').select('*').eq('ativo', true).order('nome'),
    ])
    if (rk.error) setErro(rk.error.message)
    setKits(((rk.data as unknown as (Kit & { kit_itens: (KitItem & { produto: Produto })[] })[]) ?? [])
      .map((k) => ({ ...k, itens: k.kit_itens ?? [] })))
    setProdutos((rp.data as Produto[]) ?? [])
    setCarregando(false)
  }

  // Peças escolhidas, já com o produto junto — base de todas as contas do form.
  const itensDoForm = useMemo(
    () => form.itens
      .map((i) => ({ ...i, produto: produtos.find((p) => p.id === i.produto_id) }))
      .filter((i): i is { produto_id: string; quantidade: number; produto: Produto } => !!i.produto),
    [form.itens, produtos],
  )
  const somaForm = somaPecas(itensDoForm)
  const montaveisForm = montaveis(itensDoForm)
  const precoForm = form.preco_manual ? parseCentavos(form.precoTexto) : somaForm
  const economiaForm = Math.max(somaForm - precoForm, 0)

  const destacados = useMemo(
    () => POSICOES.map((pos) => kits.find((k) => k.destaque_site && k.destaque_ordem === pos) ?? null),
    [kits],
  )

  const pecasFiltradas = useMemo(() => {
    const q = buscaPeca.trim().toLowerCase()
    const jaEscolhidas = new Set(form.itens.map((i) => i.produto_id))
    return produtos
      .filter((p) => !jaEscolhidas.has(p.id))
      .filter((p) => !q || p.nome.toLowerCase().includes(q) || (p.codigo ?? '').toLowerCase().includes(q))
      .slice(0, 8)
  }, [produtos, buscaPeca, form.itens])

  function abrirNovo() {
    setEditandoId(null); setForm(FORM_VAZIO); setBuscaPeca(''); setErro(null)
    lixoFotos.limpar(); setModalAberto(true)
  }

  /** Fechar sem salvar: o que subiu nessa sessão nunca entrou no banco, então
   *  é lixo no Storage. Ver src/lib/lixoFotos.ts. */
  function fecharSemSalvar() {
    setModalAberto(false)
    void lixoFotos.aoDescartar()
  }

  function abrirEdicao(k: KitComItens) {
    setEditandoId(k.id)
    setForm({
      nome: k.nome, subtitulo: k.subtitulo ?? '', selo: k.selo ?? '',
      precoTexto: (k.preco_centavos / 100).toFixed(2).replace('.', ','),
      preco_manual: k.preco_manual, fotos: k.foto_urls ?? [],
      ativo: k.ativo, visivel_no_site: k.visivel_no_site,
      destaque_site: k.destaque_site, destaque_ordem: k.destaque_ordem,
      esconder_sem_estoque: k.esconder_sem_estoque,
      itens: k.itens.map((i) => ({ produto_id: i.produto_id, quantidade: i.quantidade })),
    })
    setBuscaPeca(''); setErro(null); lixoFotos.limpar(); setModalAberto(true)
  }

  function addPeca(id: string) {
    setForm((f) => ({ ...f, itens: [...f.itens, { produto_id: id, quantidade: 1 }] }))
    setBuscaPeca('')
  }

  function mudarQtd(id: string, qtd: number) {
    setForm((f) => ({
      ...f,
      itens: f.itens.map((i) => (i.produto_id === id ? { ...i, quantidade: Math.max(1, qtd) } : i)),
    }))
  }

  function tirarPeca(id: string) {
    setForm((f) => ({ ...f, itens: f.itens.filter((i) => i.produto_id !== id) }))
  }


  async function salvar(e: FormEvent) {
    e.preventDefault()
    setErro(null)

    if (!form.nome.trim()) return setErro('Dá um nome pro kit.')
    if (form.itens.length === 0) return setErro('Escolhe pelo menos uma peça pra compor o kit.')
    if (form.visivel_no_site && form.fotos.length === 0)
      return setErro('Kit publicado precisa de foto. Sobe a foto do conjunto ou desmarca "Mostrar no site".')
    if (form.destaque_site && !form.destaque_ordem)
      return setErro('Escolhe em qual das 3 posições da home esse kit entra.')

    setSalvando(true)
    const dados = {
      slug: slugify(form.nome),
      nome: form.nome.trim(),
      subtitulo: form.subtitulo.trim() || null,
      selo: form.selo.trim() || null,
      preco_centavos: precoForm,
      preco_manual: form.preco_manual,
      foto_urls: form.fotos,
      ativo: form.ativo,
      visivel_no_site: form.visivel_no_site,
      destaque_site: form.destaque_site,
      destaque_ordem: form.destaque_site ? form.destaque_ordem : null,
      esconder_sem_estoque: form.esconder_sem_estoque,
    }

    const { data, error } = editandoId
      ? await supabase.from('kits').update(dados).eq('id', editandoId).select('id').single()
      : await supabase.from('kits').insert(dados).select('id').single()

    if (error) {
      setSalvando(false)
      // O banco recusa duas peças na mesma posição de destaque.
      if (error.code === '23505' && error.message.includes('destaque_ordem'))
        return setErro('Já tem outro kit nessa posição da home. Tira ele do destaque primeiro, ou escolhe outra posição.')
      if (error.code === '23505') return setErro('Já existe um kit com esse nome.')
      return setErro('Não consegui salvar: ' + error.message)
    }

    // Composição: troca inteira. São poucas linhas e evita diff manual.
    const kitId = data!.id
    await supabase.from('kit_itens').delete().eq('kit_id', kitId)
    const { error: e2 } = await supabase.from('kit_itens').insert(
      form.itens.map((i) => ({ kit_id: kitId, produto_id: i.produto_id, quantidade: i.quantidade })),
    )
    setSalvando(false)
    if (e2) return setErro('Kit salvo, mas as peças não foram: ' + e2.message)

    setModalAberto(false)
    // Banco confirmou: agora dá pra apagar do Storage o que o "x" tirou.
    void lixoFotos.aposSalvar(form.fotos)
    carregar()
  }

  async function apagar(k: KitComItens) {
    if (!confirm(`Apagar o kit "${k.nome}"? As peças continuam no estoque, só o conjunto deixa de existir.`)) return
    const { error } = await supabase.from('kits').delete().eq('id', k.id)
    if (error) return setErro('Não consegui apagar: ' + error.message)
    // Kit é DELETE de verdade (peça é `ativo = false`), então as fotos do
    // conjunto ficariam órfãs no bucket. Depois do delete, ninguém mais cita.
    void apagarFotosDoStorage(k.foto_urls ?? [])
    carregar()
  }

  async function tirarDoDestaque(k: KitComItens) {
    const { error } = await supabase.from('kits')
      .update({ destaque_site: false, destaque_ordem: null }).eq('id', k.id)
    if (error) return setErro(error.message)
    carregar()
  }

  if (carregando) return <Carregando texto="Carregando os kits..." />

  return (
    <div>
      <CabecalhoPagina
        titulo="Kits"
        subtitulo="Conjuntos de peças vendidos juntos. O estoque continua sendo das peças."
        acao={<Botao onClick={abrirNovo}><Plus size={16} /> Novo kit</Botao>}
      />

      {erro && !modalAberto && (
        <div role="alert" className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {erro}
        </div>
      )}

      {/* ── Os 3 espaços de destaque da home ───────────────────────── */}
      <section className="mb-8">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-marca-500">Destaques da home</h2>
        <p className="mb-3 text-sm text-marca-400">
          A home tem três espaços. Só cabem três kits. Pra trocar, tira um daqui primeiro.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {destacados.map((k, i) => (
            <Card key={POSICOES[i]} className="p-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-marca-400">
                <Star size={13} className={k ? 'text-fendi-500' : 'text-marca-300'} /> Posição {POSICOES[i]}
              </div>
              {k ? (
                <>
                  {k.selo && <Badge cor="ouro">{k.selo}</Badge>}
                  <p className="mt-1 font-medium text-marca-800">{k.nome}</p>
                  <p className="mt-0.5 text-sm tabular-nums text-marca-500">{formatBRL(k.preco_centavos)}</p>
                  <div className="mt-3 flex gap-2">
                    <Botao variante="secundario" onClick={() => abrirEdicao(k)}>
                      <Pencil size={14} /> Editar
                    </Botao>
                    <Botao variante="fantasma" onClick={() => tirarDoDestaque(k)}>
                      <StarOff size={14} /> Tirar
                    </Botao>
                  </div>
                </>
              ) : (
                <p className="py-3 text-sm text-marca-400">Vazio. Nenhum kit nessa posição.</p>
              )}
            </Card>
          ))}
        </div>
      </section>

      {/* ── Todos os kits ──────────────────────────────────────────── */}
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-marca-500">Todos os kits</h2>
      {kits.length === 0 ? (
        <Vazio
          titulo="Nenhum kit ainda"
          descricao="Kit é um conjunto de peças com preço próprio, bom pra aumentar o valor da venda e sugerir combinações."
          acao={<Botao onClick={abrirNovo}><Plus size={16} /> Criar o primeiro kit</Botao>}
        />
      ) : (
        <div className="grid gap-3">
          {kits.map((k) => {
            const disp = montaveis(k.itens)
            const soma = somaPecas(k.itens)
            const economia = Math.max(soma - k.preco_centavos, 0)
            return (
              <Card key={k.id} className="flex flex-wrap items-center gap-4 p-4">
                {/* clicar amplia, igual à miniatura do catálogo */}
                {k.foto_urls?.[0] ? (
                  <button
                    type="button"
                    onClick={() => setFotoZoom({ url: k.foto_urls[0], nome: k.nome })}
                    title="Ver foto"
                    className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-marca-100 transition hover:ring-2 hover:ring-fendi-300"
                  >
                    <img src={k.foto_urls[0]} alt={k.nome} className="h-full w-full cursor-zoom-in object-cover" />
                  </button>
                ) : (
                  <div className="grid h-16 w-16 shrink-0 place-items-center rounded-lg bg-marca-100 text-marca-300">
                    <Package size={22} />
                  </div>
                )}

                <div className="min-w-[12rem] flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-marca-800">{k.nome}</span>
                    {k.destaque_site && <Badge cor="ouro">Destaque {k.destaque_ordem}</Badge>}
                    {!k.ativo && <Badge cor="vermelho">Arquivado</Badge>}
                    {k.ativo && !k.visivel_no_site && <Badge>Rascunho</Badge>}
                  </div>
                  {k.subtitulo && <p className="mt-0.5 line-clamp-1 text-sm text-marca-500">{k.subtitulo}</p>}
                  <p className="mt-1 text-xs text-marca-400">
                    {k.itens.length} {k.itens.length === 1 ? 'peça' : 'peças'}
                    {' · '}
                    {disp > 0
                      ? `dá pra montar ${disp}`
                      : 'sem estoque pra montar'}
                  </p>
                </div>

                <div className="text-right">
                  <p className="font-medium tabular-nums text-marca-900">{formatBRL(k.preco_centavos)}</p>
                  {economia > 0 && (
                    <p className="text-xs tabular-nums text-emerald-600">
                      economia de {formatBRL(economia)}
                    </p>
                  )}
                  {!k.preco_manual && <p className="text-xs text-marca-400">soma das peças</p>}
                </div>

                <div className="flex gap-1">
                  <Botao variante="fantasma" onClick={() => abrirEdicao(k)} aria-label={`Editar ${k.nome}`}>
                    <Pencil size={16} />
                  </Botao>
                  <Botao variante="fantasma" onClick={() => apagar(k)} aria-label={`Apagar ${k.nome}`}
                    className="text-red-500 hover:bg-red-50">
                    <Trash2 size={16} />
                  </Botao>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* ── Formulário ─────────────────────────────────────────────── */}
      <Modal aberto={modalAberto} titulo={editandoId ? 'Editar kit' : 'Novo kit'}
        onFechar={fecharSemSalvar} largura="max-w-2xl">
        <form onSubmit={salvar} className="space-y-5">
          {erro && (
            <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" /> {erro}
            </div>
          )}

          <Campo label="Nome do kit" value={form.nome} required
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
            placeholder="Kit Camadas" />

          <Area label="Subtítulo" rows={2} value={form.subtitulo}
            onChange={(e) => setForm({ ...form, subtitulo: e.target.value })}
            placeholder="Três colares para usar sobrepostos, o look do momento." />

          {/* Peças */}
          <div>
            <span className="mb-1 block text-sm font-medium text-marca-600">Peças do kit</span>
            <p className="mb-2 text-xs text-marca-400">
              Ao vender o kit, estas peças dão baixa sozinhas no estoque.
            </p>

            {itensDoForm.length > 0 && (
              <ul className="mb-2 divide-y divide-marca-100 rounded-lg border border-marca-200">
                {itensDoForm.map((i) => (
                  <li key={i.produto_id} className="flex items-center gap-3 px-3 py-2">
                    <span className="flex-1 text-sm text-marca-800">
                      {i.produto.nome}
                      <span className="ml-2 text-xs tabular-nums text-marca-400">
                        {formatBRL(i.produto.preco_centavos)} · {i.produto.estoque} em estoque
                      </span>
                    </span>
                    <label className="flex items-center gap-1 text-xs text-marca-500">
                      qtd
                      <input type="number" min={1} value={i.quantidade}
                        onChange={(e) => mudarQtd(i.produto_id, Number(e.target.value))}
                        aria-label={`Quantidade de ${i.produto.nome}`}
                        className="w-14 rounded border border-marca-300 px-2 py-1 text-sm tabular-nums outline-none focus:border-fendi-500" />
                    </label>
                    <button type="button" onClick={() => tirarPeca(i.produto_id)}
                      aria-label={`Tirar ${i.produto.nome} do kit`}
                      className="rounded p-1 text-marca-400 hover:bg-marca-100 hover:text-red-600">
                      <X size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-marca-400" />
              <input value={buscaPeca} onChange={(e) => setBuscaPeca(e.target.value)}
                placeholder="Buscar peça pelo nome ou código..."
                aria-label="Buscar peça para adicionar ao kit"
                className="w-full rounded-lg border border-marca-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-fendi-500 focus:ring-2 focus:ring-fendi-200" />
            </div>
            {buscaPeca && (
              <ul className="mt-1 max-h-52 overflow-y-auto rounded-lg border border-marca-200">
                {pecasFiltradas.length === 0 && (
                  <li className="px-3 py-2 text-sm text-marca-400">Nenhuma peça encontrada.</li>
                )}
                {pecasFiltradas.map((p) => (
                  <li key={p.id}>
                    <button type="button" onClick={() => addPeca(p.id)}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-marca-50">
                      <span className="text-marca-800">{p.nome}</span>
                      <span className="text-xs tabular-nums text-marca-400">
                        {formatBRL(p.preco_centavos)} · {p.estoque} un
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {itensDoForm.length > 0 && (
              <p className={`mt-2 text-xs ${montaveisForm === 0 ? 'text-amber-700' : 'text-marca-500'}`}>
                {montaveisForm === 0
                  ? 'Sem estoque pra montar nenhum kit agora, falta alguma das peças.'
                  : `Dá pra montar ${montaveisForm} ${montaveisForm === 1 ? 'kit' : 'kits'} com o estoque de hoje.`}
              </p>
            )}
          </div>

          {/* Preço */}
          <div className="rounded-lg border border-marca-200 p-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-marca-600">Preço do kit</span>
                <p className="text-xs text-marca-400">
                  Soma das peças: <span className="tabular-nums">{formatBRL(somaForm)}</span>
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm text-marca-600">
                Definir manualmente
                <Interruptor ligado={form.preco_manual}
                  titulo="Definir o preço manualmente"
                  onToggle={() => setForm((f) => ({
                    ...f, preco_manual: !f.preco_manual,
                    // ao ligar, começa da soma — quase sempre ela quer só dar um desconto
                    precoTexto: !f.preco_manual ? (somaForm / 100).toFixed(2).replace('.', ',') : f.precoTexto,
                  }))} />
              </label>
            </div>
            {form.preco_manual ? (
              <div className="mt-3">
                <Campo label="Valor cobrado" inputMode="decimal" value={form.precoTexto}
                  onChange={(e) => setForm({ ...form, precoTexto: e.target.value })} placeholder="0,00" />
                {economiaForm > 0 && (
                  <p className="mt-1 text-xs tabular-nums text-emerald-600">
                    O cliente economiza {formatBRL(economiaForm)} levando o kit.
                  </p>
                )}
                {precoForm > somaForm && (
                  <p className="mt-1 text-xs text-amber-700">
                    Esse valor está acima da soma das peças. Confere se é isso mesmo.
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-2 text-sm tabular-nums text-marca-800">
                {formatBRL(somaForm)} <span className="text-xs text-marca-400">acompanha as peças</span>
              </p>
            )}
          </div>

          {/* Mesmo componente do catálogo: arrastar pra reordenar, definir capa,
              baixar e ampliar. Ver components/GaleriaFotos.tsx. */}
          <GaleriaFotos
            fotos={form.fotos}
            aoMudar={(fotos) => setForm((f) => ({ ...f, fotos }))}
            nomeBase={form.nome}
            titulo="Fotos do conjunto (para o site)"
            aoErrar={setErro}
            aoEnviar={setEnviandoFoto}
            aoAdicionar={lixoFotos.registrarEnvio}
            aoRemover={lixoFotos.registrarRemocao}
          />

          {/* Publicação */}
          <div className="space-y-3 rounded-lg border border-marca-200 p-3">
            <label className="flex items-center justify-between text-sm text-marca-700">
              <span>Mostrar no site</span>
              <Interruptor ligado={form.visivel_no_site} titulo="Mostrar no site"
                onToggle={() => setForm((f) => ({ ...f, visivel_no_site: !f.visivel_no_site }))} />
            </label>

            <label className="flex items-center justify-between text-sm text-marca-700">
              <span>
                Esconder quando faltar peça
                <span className="block text-xs text-marca-400">
                  Desligado, o kit continua no site marcado como esgotado.
                </span>
              </span>
              <Interruptor ligado={form.esconder_sem_estoque} titulo="Esconder quando faltar peça"
                onToggle={() => setForm((f) => ({ ...f, esconder_sem_estoque: !f.esconder_sem_estoque }))} />
            </label>

            <label className="flex items-center justify-between text-sm text-marca-700">
              <span>Destacar na home</span>
              <Interruptor ligado={form.destaque_site} titulo="Destacar na home"
                onToggle={() => setForm((f) => ({
                  ...f, destaque_site: !f.destaque_site,
                  destaque_ordem: !f.destaque_site ? (POSICOES.find((p) => !destacados[p - 1] || destacados[p - 1]?.id === editandoId) ?? null) : null,
                }))} />
            </label>

            {/* Progressive disclosure: posição e selo só existem se for destaque */}
            {form.destaque_site && (
              <div className="space-y-3 border-t border-marca-100 pt-3">
                <div>
                  <span className="mb-1 block text-sm font-medium text-marca-600">Posição na home</span>
                  <div className="flex gap-2">
                    {POSICOES.map((pos) => {
                      const ocupante = destacados[pos - 1]
                      const ocupada = !!ocupante && ocupante.id !== editandoId
                      return (
                        <button key={pos} type="button" disabled={ocupada}
                          onClick={() => setForm({ ...form, destaque_ordem: pos })}
                          title={ocupada ? `Ocupada por ${ocupante!.nome}` : undefined}
                          className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-colors ${
                            form.destaque_ordem === pos
                              ? 'border-fendi-500 bg-fendi-50 font-medium text-fendi-800'
                              : ocupada
                                ? 'cursor-not-allowed border-marca-200 bg-marca-50 text-marca-300'
                                : 'border-marca-300 text-marca-600 hover:border-fendi-400'
                          }`}>
                          {pos}
                          {ocupada && <span className="block text-[11px] leading-tight">ocupada</span>}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <Campo label="Tarja do card" value={form.selo} maxLength={20}
                  onChange={(e) => setForm({ ...form, selo: e.target.value })}
                  placeholder="Mais amado" />
                <p className="-mt-1 text-xs text-marca-400">
                  Aparece acima do nome, no card da home. Curto funciona melhor.
                </p>
              </div>
            )}

            <label className="flex items-center justify-between text-sm text-marca-700">
              <span>
                Ativo
                <span className="block text-xs text-marca-400">Desligado, some do ERP e do site.</span>
              </span>
              <Interruptor ligado={form.ativo} titulo="Kit ativo"
                onToggle={() => setForm((f) => ({ ...f, ativo: !f.ativo }))} />
            </label>
          </div>

          <div className="flex justify-end gap-2 border-t border-marca-200 pt-4">
            <Botao type="button" variante="secundario" onClick={fecharSemSalvar}>Cancelar</Botao>
            <Botao type="submit" disabled={salvando || enviandoFoto}>
              {salvando ? 'Salvando...' : editandoId ? 'Salvar alterações' : 'Criar kit'}
            </Botao>
          </div>
        </form>
      </Modal>

      {fotoZoom && <VisorFoto url={fotoZoom.url} nome={fotoZoom.nome} aoFechar={() => setFotoZoom(null)} />}
    </div>
  )
}
