import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import {
  Plus, Search, Pencil, Trash2, Eye, EyeOff, X, ImagePlus, Star, Download,
  Image as ImageIcon, Tag, Printer, Percent, AlertTriangle,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  Botao, Campo, Area, Selecao, Card, Modal, Badge, CabecalhoPagina, Vazio, Carregando,
} from '@/components/ui'
import { EtiquetaProduto } from '@/components/EtiquetaProduto'
import { PortalImpressao } from '@/components/PortalImpressao'
import { formatBRL, parseCentavos } from '@/lib/format'
import {
  MARKUP_PADRAO, MARKUPS_RAPIDOS, parseMarkup, formatMarkup, margemPercentual,
  aoMudarCusto, aoMudarMarkup, aoMudarPreco, markupParaSalvar, planejarRemarcacao,
} from '@/lib/preco'
import { GaleriaFotos, VisorFoto } from '@/components/GaleriaFotos'
import { useLixoFotos } from '@/lib/lixoFotos'
import { TAXONOMIA, MATERIAIS, PUBLICOS, slugify } from '@/lib/taxonomia'
import type { Produto } from '@/types/db'

const vazio = {
  nome: '',
  slug: '',
  codigo: '',
  categoria: '',
  material: '',
  publico: '',
  tamanho: '',
  fornecedor: '',
  preco: '',
  custo: '',
  markup: formatMarkup(MARKUP_PADRAO),
  estoque: '1',
  descricao: '',
  visivel_no_site: false,
  mostrar_preco: true,
  destaque_site: false,
  fotos: [] as string[],
}
type FormState = typeof vazio

export default function Catalogo() {
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [carregando, setCarregando] = useState(true)
  const [busca, setBusca] = useState('')
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<Produto | null>(null)
  const [form, setForm] = useState<FormState>(vazio)
  const [slugManual, setSlugManual] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [enviandoFoto, setEnviandoFoto] = useState(false)
  const lixoFotos = useLixoFotos()

  // Etiquetas
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [etiquetasProdutos, setEtiquetasProdutos] = useState<Produto[] | null>(null)

  function alternarSelecao(id: string) {
    setSelecionados((atual) => {
      const proximo = new Set(atual)
      if (proximo.has(id)) proximo.delete(id)
      else proximo.add(id)
      return proximo
    })
  }
  // Aplicar um MK nas peças marcadas, de uma vez
  const [loteAberto, setLoteAberto] = useState(false)
  const [mkLote, setMkLote] = useState(formatMarkup(MARKUP_PADRAO))
  const [aplicandoLote, setAplicandoLote] = useState(false)
  const [erroLote, setErroLote] = useState<string | null>(null)

  const [fotoZoom, setFotoZoom] = useState<{ url: string; nome: string } | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    setCarregando(true)
    const { data } = await supabase
      .from('produtos')
      .select('*')
      .eq('ativo', true)
      .order('created_at', { ascending: false })
    setProdutos((data as Produto[]) ?? [])
    setCarregando(false)
  }

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase()
    if (!t) return produtos
    return produtos.filter(
      (p) =>
        p.nome.toLowerCase().includes(t) ||
        (p.codigo ?? '').toLowerCase().includes(t) ||
        (p.fornecedor ?? '').toLowerCase().includes(t) ||
        (p.categoria ?? '').toLowerCase().includes(t),
    )
  }, [produtos, busca])

  function abrirNovo() {
    setEditando(null)
    setForm(vazio)
    setSlugManual(false)
    setErro(null)
    lixoFotos.limpar()
    setModalAberto(true)
  }

  /** Fechar sem salvar: o que subiu nessa sessão nunca entrou no banco, então
   *  é lixo no Storage. Ver src/lib/lixoFotos.ts. */
  function fecharSemSalvar() {
    setModalAberto(false)
    void lixoFotos.aoDescartar()
  }

  function abrirEdicao(p: Produto) {
    setEditando(p)
    lixoFotos.limpar()
    setForm({
      nome: p.nome,
      slug: p.slug,
      codigo: p.codigo ?? '',
      categoria: p.categoria ?? '',
      material: p.material ?? '',
      publico: p.publico ?? '',
      tamanho: p.tamanho ?? '',
      fornecedor: p.fornecedor ?? '',
      preco: p.preco_centavos ? (p.preco_centavos / 100).toFixed(2).replace('.', ',') : '',
      custo: p.custo_centavos ? (p.custo_centavos / 100).toFixed(2).replace('.', ',') : '',
      // MK da peça, não o padrão: peça antiga tem que abrir com a margem que ela
      // já pratica, senão salvar sem querer remarcaria o preço.
      markup: p.markup ? formatMarkup(p.markup) : '',
      estoque: String(p.estoque),
      descricao: p.descricao ?? '',
      visivel_no_site: p.visivel_no_site,
      mostrar_preco: p.mostrar_preco,
      destaque_site: p.destaque_site,
      fotos: p.foto_urls ?? [],
    })
    setSlugManual(true)
    setErro(null)
    setModalAberto(true)
  }

  function mudarNome(nome: string) {
    setForm((f) => ({ ...f, nome, slug: slugManual ? f.slug : slugify(nome) }))
  }

  /* Custo, MK e preço são três campos ligados. Quem manda depende de onde ela
     digitou: mexer no custo ou no MK reescreve o preço; escrever o preço na mão
     reescreve o MK, pra ela ver a margem que aquele preço representa de fato.
     A conta em si mora em lib/preco.ts, fora do componente, pra ser testada sem
     navegador e sem login. Aqui só entra o encaixe no estado do formulário. */
  const mudarCusto = (t: string) => setForm((f) => ({ ...f, ...aoMudarCusto(f, t) }))
  const mudarMarkup = (t: string) => setForm((f) => ({ ...f, ...aoMudarMarkup(f, t) }))
  const mudarPreco = (t: string) => setForm((f) => ({ ...f, ...aoMudarPreco(f, t) }))

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    if (!form.nome.trim()) return setErro('O nome é obrigatório.')
    if (!form.categoria) return setErro('Escolha a categoria.')
    const preco = parseCentavos(form.preco)
    if (preco <= 0) return setErro('Informe o preço de venda.')

    const custo = form.custo ? parseCentavos(form.custo) : 0
    const markup = markupParaSalvar(form)   // ver a regra em lib/preco.ts

    setSalvando(true)
    const payload = {
      slug: (form.slug || slugify(form.nome)).trim(),
      nome: form.nome.trim(),
      descricao: form.descricao.trim() || null,
      categoria: form.categoria || null,
      material: form.material.trim() || null,
      publico: form.publico || null,
      tamanho: form.tamanho.trim() || null,
      codigo: form.codigo.trim() || null,
      fornecedor: form.fornecedor.trim() || null,
      preco_centavos: preco,
      custo_centavos: custo > 0 ? custo : null,
      markup,
      estoque: parseInt(form.estoque, 10) || 0,
      foto_urls: form.fotos,
      imagem_url: form.fotos[0] ?? null,
      visivel_no_site: form.visivel_no_site,
      mostrar_preco: form.mostrar_preco,
      destaque_site: form.destaque_site,
      ativo: true,
    }
    const resposta = editando
      ? await supabase.from('produtos').update(payload).eq('id', editando.id)
      : await supabase.from('produtos').insert(payload)
    setSalvando(false)
    if (resposta.error) {
      if (resposta.error.code === '23505')
        setErro('Já existe uma peça com esse endereço (slug). Ajuste o nome ou o slug.')
      else setErro(resposta.error.message)
      return
    }
    setModalAberto(false)
    // Banco confirmou: agora dá pra apagar do Storage o que o "x" tirou.
    void lixoFotos.aposSalvar(form.fotos)
    carregar()
  }

  async function alternarSite(p: Produto) {
    setProdutos((atual) =>
      atual.map((x) => (x.id === p.id ? { ...x, visivel_no_site: !x.visivel_no_site } : x)),
    )
    await supabase.from('produtos').update({ visivel_no_site: !p.visivel_no_site }).eq('id', p.id)
  }





  /* ---- Aplicar um MK nas peças marcadas ------------------------------------
     O plano se refaz a cada tecla, então a prévia embaixo do campo é sempre o
     que o "Aplicar" vai gravar. Nada toca no banco até o clique. */
  const marcadas = useMemo(() => produtos.filter((p) => selecionados.has(p.id)), [produtos, selecionados])
  const plano = useMemo(() => planejarRemarcacao(marcadas, parseMarkup(mkLote)), [marcadas, mkLote])

  function abrirLote() {
    setMkLote(formatMarkup(MARKUP_PADRAO))
    setErroLote(null)
    setLoteAberto(true)
  }

  async function aplicarLote() {
    const mk = parseMarkup(mkLote)
    if (mk <= 0) return setErroLote('Digite o MK que você quer aplicar.')
    if (plano.mudam.length === 0) return setErroLote('Nenhuma das peças marcadas muda de preço com esse MK.')

    setAplicandoLote(true)
    setErroLote(null)
    // Uma peça por vez, na ordem da prévia. São dezenas de linhas, não milhares,
    // e assim a primeira falha (rede, RLS) para o lote em vez de deixar metade
    // do catálogo remarcado sem ninguém saber quais.
    let gravadas = 0
    for (const linha of plano.mudam) {
      const { error } = await supabase
        .from('produtos')
        .update({ preco_centavos: linha.precoNovo, markup: mk })
        .eq('id', linha.id)
      if (error) {
        setAplicandoLote(false)
        setErroLote(`Parou em "${linha.nome}": ${error.message}. ${gravadas} peça(s) já foram remarcadas; as outras ficaram como estavam.`)
        await carregar()
        return
      }
      gravadas++
    }
    setAplicandoLote(false)
    setLoteAberto(false)
    // Solta a seleção: com ela presa, um segundo clique sem querer remarcaria
    // as mesmas peças de novo.
    setSelecionados(new Set())
    await carregar()
  }

  async function excluir(p: Produto) {
    if (!confirm(`Remover a peça "${p.nome}" do catálogo?`)) return
    await supabase.from('produtos').update({ ativo: false }).eq('id', p.id)
    carregar()
  }

  return (
    <div>
      <CabecalhoPagina
        titulo="Catálogo"
        subtitulo={`${produtos.length} peça(s) no estoque`}
        acao={
          <div className="flex items-center gap-2">
            {selecionados.size > 0 && (
              <>
                <Botao variante="secundario" onClick={abrirLote}>
                  <Percent size={16} /> Aplicar MK ({selecionados.size})
                </Botao>
                <Botao variante="secundario" onClick={() => setEtiquetasProdutos(produtos.filter((p) => selecionados.has(p.id)))}>
                  <Tag size={16} /> Etiquetas ({selecionados.size})
                </Botao>
              </>
            )}
            <Botao onClick={abrirNovo}><Plus size={16} /> Nova peça</Botao>
          </div>
        }
      />

      <div className="relative mb-4">
        <Search size={18} className="absolute left-3 top-2.5 text-marca-400" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome, código, fornecedor ou categoria..."
          className="w-full rounded-lg border border-marca-300 bg-white py-2 pl-10 pr-3 text-sm text-marca-900 outline-none focus:border-fendi-500 focus:ring-2 focus:ring-fendi-200"
        />
      </div>

      {carregando ? (
        <Carregando />
      ) : filtrados.length === 0 ? (
        <Vazio
          titulo={busca ? 'Nenhuma peça encontrada' : 'Nenhuma peça cadastrada'}
          descricao={busca ? 'Tente outra busca.' : 'Cadastre a primeira peça do catálogo.'}
          acao={!busca && <Botao onClick={abrirNovo}><Plus size={16} /> Nova peça</Botao>}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-marca-200 bg-marca-50 text-left text-xs uppercase tracking-wide text-marca-500">
                  <th className="px-4 py-3 font-medium">
                    <input
                      type="checkbox"
                      aria-label="Selecionar todas as peças da lista"
                      className="h-4 w-4 cursor-pointer accent-marca-900"
                      checked={filtrados.length > 0 && filtrados.every((p) => selecionados.has(p.id))}
                      onChange={(e) => {
                        const ids = filtrados.map((p) => p.id)
                        setSelecionados((atual) => {
                          const proximo = new Set(atual)
                          if (e.target.checked) ids.forEach((id) => proximo.add(id))
                          else ids.forEach((id) => proximo.delete(id))
                          return proximo
                        })
                      }}
                    />
                  </th>
                  <th className="px-4 py-3 font-medium">Foto</th>
                  <th className="px-4 py-3 font-medium">Código</th>
                  <th className="px-4 py-3 font-medium">Peça</th>
                  <th className="px-4 py-3 font-medium">Categoria</th>
                  <th className="px-4 py-3 text-right font-medium">Preço</th>
                  <th className="px-4 py-3 text-center font-medium" title="Markup: preço dividido pelo custo">MK</th>
                  <th className="px-4 py-3 text-center font-medium">Estoque</th>
                  <th className="px-4 py-3 text-center font-medium">Site</th>
                  <th className="px-4 py-3 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((p) => (
                  <tr key={p.id} className={`border-b border-marca-100 last:border-0 hover:bg-marca-50/60 ${selecionados.has(p.id) ? 'bg-fendi-50/60' : ''}`}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        aria-label={`Selecionar ${p.nome}`}
                        className="h-4 w-4 cursor-pointer accent-marca-900"
                        checked={selecionados.has(p.id)}
                        onChange={() => alternarSelecao(p.id)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      {p.imagem_url || p.foto_urls?.[0] ? (
                        <button
                          type="button"
                          onClick={() => setFotoZoom({ url: p.imagem_url || p.foto_urls[0], nome: p.nome })}
                          title="Ver foto"
                          className="block h-10 w-10 overflow-hidden rounded-md border border-marca-200 bg-white transition hover:ring-2 hover:ring-fendi-300"
                        >
                          <img src={p.imagem_url || p.foto_urls[0]} alt={p.nome} className="h-full w-full object-cover" />
                        </button>
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-md border border-dashed border-marca-200 bg-marca-50 text-marca-300" title="Sem foto">
                          <ImageIcon size={16} />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-marca-500">{p.codigo ?? '-'}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-marca-800">{p.nome}</p>
                      <p className="text-xs text-marca-400">
                        {[p.material, p.tamanho].filter(Boolean).join(' · ') || ''}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {p.categoria ? <Badge>{p.categoria}</Badge> : <span className="text-marca-300">-</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-marca-700">{formatBRL(p.preco_centavos)}</td>
                    {/* Vermelho quando a peça sai abaixo do custo. É como se acha
                        o erro de digitação sem abrir peça por peça. */}
                    <td className={`px-4 py-3 text-center tabular-nums ${
                      p.markup !== null && p.markup < 1 ? 'font-semibold text-red-600' : 'text-marca-500'
                    }`}>
                      {p.markup ? `${formatMarkup(p.markup)}x` : '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={p.estoque <= 0 ? 'text-red-500' : 'text-marca-600'}>{p.estoque}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => alternarSite(p)}
                        title={p.visivel_no_site ? 'Visível no site' : 'Oculto do site'}
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                          p.visivel_no_site
                            ? 'bg-marca-900 text-white hover:bg-marca-800'
                            : 'bg-marca-100 text-marca-400 hover:bg-marca-200'
                        }`}
                      >
                        {p.visivel_no_site ? <Eye size={13} /> : <EyeOff size={13} />}
                        {p.visivel_no_site ? 'No site' : 'Oculto'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => setEtiquetasProdutos([p])} className="rounded-lg p-1.5 text-marca-400 hover:bg-marca-100 hover:text-fendi-600" title="Gerar etiqueta">
                          <Tag size={16} />
                        </button>
                        <button onClick={() => abrirEdicao(p)} className="rounded-lg p-1.5 text-marca-400 hover:bg-marca-100 hover:text-marca-700" title="Editar">
                          <Pencil size={16} />
                        </button>
                        <button onClick={() => excluir(p)} className="rounded-lg p-1.5 text-marca-400 hover:bg-red-50 hover:text-red-600" title="Remover">
                          <Trash2 size={16} />
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

      {/* Aplicar um MK nas peças marcadas. A prévia não é enfeite: o preço da
          loja é valor gravado, então o UPDATE já é o preço que o cliente vê, e
          não existe desfazer. Ela confere linha a linha antes de confirmar. */}
      <Modal
        aberto={loteAberto}
        titulo={`Aplicar MK em ${marcadas.length} peça(s) marcada(s)`}
        onFechar={() => { if (!aplicandoLote) setLoteAberto(false) }}
        largura="max-w-2xl"
      >
        <div className="space-y-4">
          <div>
            <Campo
              label="MK a aplicar"
              value={mkLote}
              onChange={(e) => { setMkLote(e.target.value); setErroLote(null) }}
              placeholder={formatMarkup(MARKUP_PADRAO)}
              inputMode="decimal"
              autoFocus
            />
            <div className="mt-1.5 flex gap-1.5">
              {MARKUPS_RAPIDOS.map((mk) => {
                const texto = formatMarkup(mk)
                const ativo = parseMarkup(mkLote) === mk
                return (
                  <button
                    key={mk}
                    type="button"
                    onClick={() => { setMkLote(texto); setErroLote(null) }}
                    className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                      ativo
                        ? 'bg-marca-900 text-white'
                        : 'bg-white text-marca-600 border border-marca-300 hover:bg-marca-100'
                    }`}
                  >
                    {texto}x
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <p>
              O preço gravado é o preço que a loja mostra: as peças que estão no site
              mudam de preço assim que você confirmar, e não dá pra desfazer. Confira a
              lista abaixo antes.
            </p>
          </div>

          <p className="text-sm text-marca-600">
            <b>{plano.mudam.length}</b> peça(s) mudam
            {plano.iguais.length > 0 && <> · {plano.iguais.length} já estão nesse preço</>}
            {plano.semCusto.length > 0 && <> · {plano.semCusto.length} sem custo cadastrado</>}
          </p>

          {plano.mudam.length > 0 && (
            <div className="max-h-64 overflow-y-auto rounded-lg border border-marca-200">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-marca-50 text-left text-xs uppercase tracking-wide text-marca-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">Peça</th>
                    <th className="px-3 py-2 text-center font-medium">MK hoje</th>
                    <th className="px-3 py-2 text-right font-medium">Preço hoje</th>
                    <th className="px-3 py-2 text-right font-medium">Preço novo</th>
                  </tr>
                </thead>
                <tbody>
                  {plano.mudam.map((l) => {
                    const sobe = l.precoNovo > l.precoAtual
                    return (
                      <tr key={l.id} className="border-t border-marca-100">
                        <td className="px-3 py-2 text-marca-800">{l.nome}</td>
                        <td className="px-3 py-2 text-center tabular-nums text-marca-500">
                          {l.markupAtual ? `${formatMarkup(l.markupAtual)}x` : '-'}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-marca-500">{formatBRL(l.precoAtual)}</td>
                        <td className={`px-3 py-2 text-right font-medium tabular-nums ${sobe ? 'text-marca-800' : 'text-red-600'}`}>
                          {formatBRL(l.precoNovo)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {plano.semCusto.length > 0 && (
            <p className="text-xs text-marca-500">
              Sem custo cadastrado, então ficam de fora (o MK precisa do custo pra
              calcular o preço): {plano.semCusto.map((x) => x.nome).join(', ')}.
            </p>
          )}

          {erroLote && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erroLote}</div>
          )}

          <div className="flex justify-end gap-2 border-t border-marca-200 pt-3">
            <Botao variante="secundario" onClick={() => setLoteAberto(false)} disabled={aplicandoLote}>
              Cancelar
            </Botao>
            <Botao onClick={aplicarLote} disabled={aplicandoLote || plano.mudam.length === 0}>
              {aplicandoLote ? 'Aplicando...' : `Aplicar em ${plano.mudam.length} peça(s)`}
            </Botao>
          </div>
        </div>
      </Modal>

      <Modal
        aberto={modalAberto}
        titulo={editando ? 'Editar peça' : 'Nova peça'}
        onFechar={fecharSemSalvar}
        largura="max-w-2xl"
      >
        <form onSubmit={salvar} className="space-y-4">
          <Campo label="Nome da peça *" value={form.nome} onChange={(e) => mudarNome(e.target.value)} placeholder="Ex.: Colar ponto de luz prata 925" />

          <div className="grid gap-4 sm:grid-cols-2">
            <Selecao label="Categoria *" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
              <option value="">Selecione...</option>
              {TAXONOMIA.map((t) => (
                <optgroup key={t.principal} label={t.principal}>
                  {t.subs.map((s) => (<option key={s} value={s}>{s}</option>))}
                </optgroup>
              ))}
            </Selecao>
            <Selecao label="Público" value={form.publico} onChange={(e) => setForm({ ...form, publico: e.target.value })}>
              <option value="">—</option>
              {PUBLICOS.map((p) => (<option key={p.valor} value={p.valor}>{p.rotulo}</option>))}
            </Selecao>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-marca-600">Material</span>
              <input
                list="lista-materiais"
                value={form.material}
                onChange={(e) => setForm({ ...form, material: e.target.value })}
                placeholder="Ex.: Prata 925"
                className="w-full rounded-lg border border-marca-300 bg-white px-3 py-2 text-sm text-marca-900 outline-none focus:border-fendi-500 focus:ring-2 focus:ring-fendi-200"
              />
              <datalist id="lista-materiais">
                {MATERIAIS.map((m) => (<option key={m} value={m} />))}
              </datalist>
            </label>
            <Campo label="Tamanho / medida" value={form.tamanho} onChange={(e) => setForm({ ...form, tamanho: e.target.value })} placeholder="Ex.: 45cm, aro 18" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo label="Código (SKU)" value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} placeholder="Ex.: LUAR-001" />
            <Campo label="Fornecedor" value={form.fornecedor} onChange={(e) => setForm({ ...form, fornecedor: e.target.value })} />
          </div>

          {/* Custo -> MK -> Preço, nessa ordem: é o caminho do raciocínio.
              O preço continua editável; se ela escrever outro valor, o MK ao
              lado passa a mostrar a margem real daquele preço. */}
          <div className="rounded-xl border border-marca-200 bg-marca-50/50 p-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <Campo label="Custo (R$)" value={form.custo} onChange={(e) => mudarCusto(e.target.value)} placeholder="0,00" inputMode="decimal" />
              <div>
                <Campo label="Markup (MK)" value={form.markup} onChange={(e) => mudarMarkup(e.target.value)} placeholder={formatMarkup(MARKUP_PADRAO)} inputMode="decimal" />
                <div className="mt-1.5 flex gap-1.5">
                  {MARKUPS_RAPIDOS.map((mk) => {
                    const texto = formatMarkup(mk)
                    const ativo = parseMarkup(form.markup) === mk
                    return (
                      <button
                        key={mk}
                        type="button"
                        onClick={() => mudarMarkup(texto)}
                        className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                          ativo
                            ? 'bg-marca-900 text-white'
                            : 'bg-white text-marca-600 border border-marca-300 hover:bg-marca-100'
                        }`}
                      >
                        {texto}x
                      </button>
                    )
                  })}
                </div>
              </div>
              <Campo label="Preço de venda (R$) *" value={form.preco} onChange={(e) => mudarPreco(e.target.value)} placeholder="0,00" inputMode="decimal" />
            </div>
            <ResumoMargem custo={parseCentavos(form.custo)} preco={parseCentavos(form.preco)} />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Campo label="Estoque" type="number" min={0} value={form.estoque} onChange={(e) => setForm({ ...form, estoque: e.target.value })} />
          </div>

          <Campo label="Endereço no site (slug)" value={form.slug} onChange={(e) => { setSlugManual(true); setForm({ ...form, slug: slugify(e.target.value) }) }} placeholder="colar-ponto-de-luz" />

          <Area label="Descrição" rows={2} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />

          <GaleriaFotos
            fotos={form.fotos}
            aoMudar={(fotos) => setForm((f) => ({ ...f, fotos }))}
            nomeBase={form.nome}
            aoErrar={setErro}
            aoEnviar={setEnviandoFoto}
            aoAdicionar={lixoFotos.registrarEnvio}
            aoRemover={lixoFotos.registrarRemocao}
          />

          {/* Flags do site */}
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-marca-200 bg-white px-3 py-3 text-sm text-marca-700">
              <input type="checkbox" checked={form.visivel_no_site} onChange={(e) => setForm({ ...form, visivel_no_site: e.target.checked })} className="h-4 w-4 accent-marca-900" />
              Mostrar no site
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-marca-200 bg-white px-3 py-3 text-sm text-marca-700">
              <input type="checkbox" checked={form.mostrar_preco} onChange={(e) => setForm({ ...form, mostrar_preco: e.target.checked })} className="h-4 w-4 accent-marca-900" />
              Mostrar preço
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-marca-200 bg-white px-3 py-3 text-sm text-marca-700">
              <input type="checkbox" checked={form.destaque_site} onChange={(e) => setForm({ ...form, destaque_site: e.target.checked })} className="h-4 w-4 accent-marca-900" />
              Destaque (mais vendidos)
            </label>
          </div>

          {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{erro}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Botao type="button" variante="secundario" onClick={fecharSemSalvar}>Cancelar</Botao>
            {/* trava enquanto a foto sobe: salvar no meio grava a peça sem ela */}
            <Botao type="submit" disabled={salvando || enviandoFoto}>{salvando ? 'Salvando...' : 'Salvar'}</Botao>
          </div>
        </form>
      </Modal>

      {fotoZoom && <VisorFoto url={fotoZoom.url} nome={fotoZoom.nome} aoFechar={() => setFotoZoom(null)} />}

      {/* Modal de impressão de etiquetas */}
      {etiquetasProdutos && (
        <div className="modal-etiquetas fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
          <div className="modal-etiquetas-box w-full max-w-3xl rounded-2xl bg-white shadow-xl">
            <div className="nao-imprimir flex items-center justify-between border-b border-marca-200 px-5 py-3">
              <h3 className="text-lg font-semibold text-marca-800">Etiquetas ({etiquetasProdutos.length})</h3>
              <div className="flex items-center gap-2">
                <Botao onClick={() => window.print()}><Printer size={16} /> Imprimir</Botao>
                <button onClick={() => setEtiquetasProdutos(null)} className="rounded-lg p-1 text-marca-400 hover:bg-marca-100 hover:text-marca-600">
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="px-5 py-4">
              <p className="nao-imprimir mb-3 text-xs text-marca-400">
                Prévia das etiquetas. Na janela de impressão escolha a etiquetadora, layout <strong>Retrato</strong>,
                margens <strong>Nenhuma</strong> e escala <strong>100%</strong>.
              </p>
              <div className="flex flex-wrap gap-3">
                {etiquetasProdutos.map((p) => (
                  <EtiquetaProduto key={p.id} produto={p} />
                ))}
              </div>
            </div>
          </div>

          {/* O que vai pro papel. Sai do #root via portal porque de dentro do
              modal o overflow do Layout cortava a etiqueta. A prévia acima é
              só tela; as duas listas vêm do mesmo array, então não divergem. */}
          <PortalImpressao>
            <div className="area-impressao">
              {etiquetasProdutos.map((p) => (
                <EtiquetaProduto key={p.id} produto={p} />
              ))}
            </div>
          </PortalImpressao>
        </div>
      )}
    </div>
  )
}

/* Linha de conferência embaixo do bloco de preço. Traduz o MK em dinheiro e em
   margem, que é como se pensa o negócio, e grita quando a peça está sendo
   vendida abaixo do custo. Existe uma peça assim no catálogo hoje (MK 0,18,
   quase certamente erro de digitação no custo). */
function ResumoMargem({ custo, preco }: { custo: number; preco: number }) {
  if (custo <= 0 || preco <= 0) {
    return (
      <p className="mt-3 text-xs text-marca-500">
        Preencha o custo e o markup que o preço de venda sai sozinho, arredondado
        pra cima de R$ 5 em R$ 5. Você pode escrever outro preço por cima.
      </p>
    )
  }
  const lucro = preco - custo
  const margem = margemPercentual(custo, preco)
  const prejuizo = lucro < 0
  return (
    <p className={`mt-3 text-xs ${prejuizo ? 'font-medium text-red-600' : 'text-marca-500'}`}>
      {prejuizo ? 'Atenção: preço abaixo do custo. ' : ''}
      Lucro de {formatBRL(lucro)} por peça, margem de {margem}% sobre a venda.
    </p>
  )
}
