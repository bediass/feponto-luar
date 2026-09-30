import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Plus, Search, Pencil, Trash2, Eye, EyeOff, Globe, RefreshCw, Check, Tag, Printer, X, ImagePlus, DollarSign, Star, Download, Image as ImageIcon, Users, ArrowUp, ArrowDown, SlidersHorizontal } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { buscarOuro24kMercado } from '@/lib/cotacao'
import { prepararFoto } from '@/lib/foto'
import { EtiquetaProduto } from '@/components/EtiquetaProduto'
import { PortalImpressao } from '@/components/PortalImpressao'
import {
  Botao,
  Campo,
  CampoMoeda,
  Area,
  Selecao,
  Card,
  Modal,
  Badge,
  Interruptor,
  CabecalhoPagina,
  Vazio,
  Carregando,
} from '@/components/ui'
import { formatBRL, formatDataHora, parseValor } from '@/lib/format'
import { CORES_OURO, PUBLICOS, PEDRAS, unidadeTamanho, ehAlianca, pesoTotal, arredondarIndice, indiceAutomatico, custoDaPeca } from '@/lib/joias'
import type { Categoria, Produto } from '@/types/db'

/* MKs oferecidos no seletor de markup. Qualquer outro valor cai no "Outro...",
   com a caixa de digitar do lado. A lista mora aqui, e não solta dentro do JSX,
   porque ela decide duas coisas que precisam concordar: o que aparece pra
   escolher e o que, ao abrir uma peça salva, abre como escolha em vez de
   abrir como valor digitado à mão. */
const MARKUPS = ['1,5', '1,8', '2', '2,2']

const vazio = {
  familia_id: '',
  categoria_id: '',
  nome: '',
  fornecedor: '',
  quantidade: '1',
  tamanho: '',
  peso_gramas: '',
  largura_mm: '',
  espessura_mm: '',
  // Par de alianças: a 2ª peça mora no mesmo produto (colunas par_*)
  eh_par: false,
  par_tamanho: '',
  par_largura_mm: '',
  par_espessura_mm: '',
  par_peso_gramas: '',
  par_indice: '',
  cor_ouro: '',
  publico: '',
  pedras: '',
  codigo: '',
  indice: '',
  mk_custo: '',
  markup: '',
  cotacao_compra: '',
  cotacao_venda: '',
  custo: '',
  preco_venda: '',
  preco_automatico: true,
  descricao: '',
  visivel_no_site: false,
  mostrar_preco: false,
  fotos: [] as string[],
}

type FormState = typeof vazio

function fmtQtd(n: number) {
  if (n === 0.5) return '½'
  return n.toLocaleString('pt-BR')
}

/*
 * O `arredondarIndice` mudou de casa em 12/08/2026: mora em `lib/joias.ts`, junto
 * com `indiceAutomatico` e `custoDaPeca`, para as três contas de dinheiro ficarem
 * cobertas por `npm run teste`. Peso × MK de custo dá float sujo
 * (3,5 × 1,2 = 4,199999…), e é esse número que vai gravado no banco e volta na
 * próxima edição: sem arredondar, a peça nunca "confere" com a conta e cai em
 * manual sozinha. 4 casas porque a cotação é da ordem de centenas de R$/g, então
 * o erro que sobra no preço fica abaixo de um centavo.
 */

/** Número para input pt-BR, sem casas sobrando: 4.2 -> "4,2". */
function numeroParaInput(n: number): string {
  return String(n).replace('.', ',')
}

/**
 * Número do banco → texto de campo de dinheiro, já em pt-BR com 2 casas
 * (345.5 vira "345,50", 1234.5 vira "1.234,50"). Formata direto do número, sem
 * passar por texto: `String(1234.567)` daria "1234.567", e a regra do ponto do
 * `parseValor` leria isso como milhar. Casa com o que o `CampoMoeda` escreve ao
 * sair do campo, então abrir uma peça e salvar sem tocar em nada não muda nada.
 */
function moedaParaInput(n: number): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtIndice(n: number): string {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 4 })
}

/**
 * Como o site trata o preço das peças publicadas. Mora em
 * `configuracoes.preco_site_modo` (numérico, porque a tabela é chave/valor
 * numérico) e quem aplica é a função `catalogo_site()` no banco — o preço
 * escondido nem sai do Supabase. Ver `sql/bloco-12`.
 *
 * ⚠️ Nenhum dos três estados escreve em `produtos.mostrar_preco`: "manual" é
 * a seleção peça a peça que a Fernanda já fez, e ela precisa sobreviver a
 * ligar e desligar o modo global.
 */
type PrecoSiteModo = 0 | 1 | 2

const PRECO_SITE_MODOS: { valor: PrecoSiteModo; rotulo: string; ajuda: string }[] = [
  { valor: 1, rotulo: 'Mostrar todos', ajuda: 'Todas as peças do site aparecem com preço.' },
  { valor: 2, rotulo: 'Não mostrar nenhum', ajuda: 'Nenhum preço aparece no site — tudo fica "Sob consulta".' },
  { valor: 0, rotulo: 'Manual', ajuda: 'Vale a opção "Mostrar o preço no site" de cada peça.' },
]

export default function Estoque() {
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [cotacao, setCotacao] = useState(0)
  const [carregando, setCarregando] = useState(true)
  const [busca, setBusca] = useState('')
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<Produto | null>(null)
  const [form, setForm] = useState<FormState>(vazio)
  const [salvando, setSalvando] = useState(false)
  const [enviandoFoto, setEnviandoFoto] = useState(false)
  const [dragFoto, setDragFoto] = useState<number | null>(null)
  const [dragOverFoto, setDragOverFoto] = useState<number | null>(null)
  const [fotoZoom, setFotoZoom] = useState<{ url: string; nome: string } | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  // Edição da cotação do ouro
  const [editandoCotacao, setEditandoCotacao] = useState(false)
  const [cotacaoInput, setCotacaoInput] = useState('')
  const [recalculando, setRecalculando] = useState(false)
  const [cotacaoAuto, setCotacaoAuto] = useState(false)
  const [cotacaoFator, setCotacaoFator] = useState(1)
  const [cotacaoAtualizadaEm, setCotacaoAtualizadaEm] = useState<string | null>(null)
  const [atualizandoCotacao, setAtualizandoCotacao] = useState(false)
  const primeiraCarga = useRef(true)

  // Preço no site: chave global, sem tocar no `mostrar_preco` de cada peça.
  // Ver PROJETO FEPONTO/sql/bloco-12. É por isso que existe o estado "manual":
  // ocultar tudo e voltar depois devolve a seleção peça a peça intacta.
  const [precoSiteModo, setPrecoSiteModo] = useState<PrecoSiteModo>(0)
  const [salvandoPrecoSite, setSalvandoPrecoSite] = useState(false)

  // Custo automático com opção de editar manualmente (lápis).
  // O preço usa a chave "automático/manual" do próprio produto (form.preco_automatico).
  const [custoManual, setCustoManual] = useState(false)
  const [markupOutro, setMarkupOutro] = useState(false)
  // Índice: sai de peso × MK de custo, com lápis para sobrescrever à mão.
  // Peça antiga (sem MK de custo) abre em manual — ver abrirEdicao.
  const [indiceManual, setIndiceManual] = useState(false)

  // Etiquetas
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [etiquetasProdutos, setEtiquetasProdutos] = useState<Produto[] | null>(null)

  function alternarSelecionado(id: string) {
    setSelecionados((atual) => {
      const novo = new Set(atual)
      if (novo.has(id)) novo.delete(id)
      else novo.add(id)
      return novo
    })
  }

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    setCarregando(true)
    const [prod, cat, cfg] = await Promise.all([
      supabase.from('produtos').select('*, categorias(id, nome)').eq('ativo', true).order('created_at', { ascending: false }),
      supabase.from('categorias').select('*').order('ordem'),
      supabase.from('configuracoes').select('chave, valor, updated_at'),
    ])
    setProdutos((prod.data as Produto[]) ?? [])
    setCategorias((cat.data as Categoria[]) ?? [])

    const cfgRows = (cfg.data as { chave: string; valor: number; updated_at: string }[]) ?? []
    const mapa = Object.fromEntries(cfgRows.map((r) => [r.chave, r]))
    const auto = Number(mapa['cotacao_auto']?.valor ?? 0) === 1
    const fator = Number(mapa['cotacao_fator']?.valor ?? 1)
    const modo = Number(mapa['preco_site_modo']?.valor ?? 0)
    setPrecoSiteModo(modo === 1 || modo === 2 ? modo : 0)
    setCotacao(Number(mapa['cotacao_ouro']?.valor ?? 0))
    setCotacaoAuto(auto)
    setCotacaoFator(fator)
    setCotacaoAtualizadaEm(mapa['cotacao_ouro']?.updated_at ?? null)
    setCarregando(false)

    // Na primeira abertura da tela, se estiver automática, já busca a cotação do mercado
    if (primeiraCarga.current && auto) {
      primeiraCarga.current = false
      atualizarPeloMercado(fator)
    }
  }

  async function atualizarPeloMercado(fator = cotacaoFator) {
    setAtualizandoCotacao(true)
    const mercado = await buscarOuro24kMercado()
    if (mercado == null || mercado <= 0) {
      setAtualizandoCotacao(false)
      alert('Não consegui buscar a cotação do ouro agora. Confira a internet e tente novamente.')
      return
    }
    const nova = Number((mercado * fator).toFixed(2))
    await supabase.from('configuracoes').update({ valor: nova }).eq('chave', 'cotacao_ouro')
    await supabase.rpc('recalcular_precos_ouro')
    setAtualizandoCotacao(false)
    carregar()
  }

  async function trocarPrecoSiteModo(novo: PrecoSiteModo) {
    if (novo === precoSiteModo || salvandoPrecoSite) return
    const anterior = precoSiteModo
    setPrecoSiteModo(novo) // otimista: o clique responde na hora
    setSalvandoPrecoSite(true)
    const { error } = await supabase.from('configuracoes').update({ valor: novo }).eq('chave', 'preco_site_modo')
    setSalvandoPrecoSite(false)
    if (error) {
      setPrecoSiteModo(anterior)
      alert('Não consegui salvar essa mudança: ' + error.message)
    }
  }

  async function alternarCotacaoAuto() {
    if (cotacaoAuto) {
      await supabase.from('configuracoes').update({ valor: 0 }).eq('chave', 'cotacao_auto')
      setCotacaoAuto(false)
      return
    }
    // Ligar: usa a cotação de mercado do ouro 24k direto (sem ajuste)
    await supabase.from('configuracoes').update({ valor: 1 }).eq('chave', 'cotacao_auto')
    setCotacaoAuto(true)
    atualizarPeloMercado(cotacaoFator)
  }

  // Famílias (nível 1) e subcategorias (nível 2) da família selecionada no form.
  const familias = useMemo(
    () => categorias.filter((c) => c.parent_id === null).sort((a, b) => a.ordem - b.ordem),
    [categorias],
  )
  const subcategorias = useMemo(
    () =>
      categorias
        .filter((c) => c.parent_id === form.familia_id)
        .sort((a, b) => a.ordem - b.ordem),
    [categorias, form.familia_id],
  )
  // A unidade do tamanho vem da FAMÍLIA (Anéis→aro, Brincos→mm, Colares/Pulseiras→cm).
  const familiaSelecionada = useMemo(
    () => familias.find((c) => c.id === form.familia_id)?.nome ?? '',
    [familias, form.familia_id],
  )
  const unidade = unidadeTamanho(familiaSelecionada)

  // Aliança abre os campos de largura/espessura e a opção de par.
  // Olha a subcategoria E a família — hoje "Alianças" é família própria, com
  // "Aliança" e "Meia Aliança" dentro. Os dois casam.
  const subcategoriaSelecionada = useMemo(
    () => categorias.find((c) => c.id === form.categoria_id)?.nome ?? '',
    [categorias, form.categoria_id],
  )
  const alianca = ehAlianca(subcategoriaSelecionada, familiaSelecionada)
  // Derivado, não o form.eh_par cru: se a categoria mudar para algo que não é
  // aliança, o par deixa de valer sem depender de limpar o estado na mão.
  const ehPar = alianca && form.eh_par

  // Cálculo de custo e preço de ouro. As duas contas são INDEPENDENTES:
  // custo  = peso × MK de custo × cotação de CUSTO   (só os 3 campos de Custo)
  // índice = peso × MK de custo                      (base da venda, editável)
  // preço  = índice × cotação de VENDA × MK (markup)
  // No par, peso e índice somam as duas peças, mesma conta do banco.
  const mkNum = parseValor(form.markup)
  const mkCustoNum = parseValor(form.mk_custo)
  // Campo em branco e zero digitado são coisas diferentes. MK de custo 0 é uma
  // escolha válida (peça que não tem MK no custo) e precisa sobreviver ao salvar,
  // então quem decide se a conta roda é o campo estar PREENCHIDO, não o número
  // ser maior que zero. Com `> 0` a Fernanda digitava 0 e o sistema tratava como
  // se ela não tivesse preenchido nada.
  const mkCustoPreenchido = form.mk_custo.trim() !== ''
  const pesoNum = parseValor(form.peso_gramas)
  const parPesoNum = parseValor(form.par_peso_gramas)
  const pesoParaCusto = ehPar ? pesoNum + parPesoNum : pesoNum
  const mkCustoOuNulo = mkCustoPreenchido ? mkCustoNum : null
  const indicePecaAuto = indiceAutomatico(pesoNum, mkCustoOuNulo)
  const parIndiceAuto = indiceAutomatico(parPesoNum, mkCustoOuNulo)
  const indicePeca = indiceManual ? parseValor(form.indice) : indicePecaAuto
  const parIndiceNum = indiceManual ? parseValor(form.par_indice) : parIndiceAuto
  const indiceNum = ehPar ? indicePeca + parIndiceNum : indicePeca
  const cotCompraNum = parseValor(form.cotacao_compra)
  const cotVendaNum = parseValor(form.cotacao_venda)
  // cotação de venda: automática usa a cotação global; manual usa o valor digitado
  const cotVendaEfetiva = form.preco_automatico ? cotacao : cotVendaNum
  // ⚠️ O custo NÃO passa pelo índice, de propósito. Ele sai só dos três campos da
  // seção Custo. Até 12/08/2026 a conta era `indiceNum × cotação de custo`, e o
  // efeito colateral era grave: mexer no índice da Precificação remarcava o custo
  // da peça. A Fernanda digitava índice 3,1 para vender mais caro numa peça de
  // 2,4 g × MK 1 e o custo saltava de R$ 744 para R$ 961, mudando a margem de um
  // jeito que ela não pediu e sem aviso nenhum na tela. Índice manual agora move
  // só o PREÇO DE VENDA; o custo continua preso a peso × MK de custo × cotação.
  const custoAuto = custoDaPeca(pesoParaCusto, mkCustoOuNulo, cotCompraNum)
  const custoBase = custoManual ? parseValor(form.custo) : custoAuto
  // A conta escrita por extenso, para a Fernanda conferir o número na tela.
  // É sempre a conta do peso: o índice não entra aqui, nem quando é manual.
  const detalheCusto =
    cotCompraNum > 0 && pesoParaCusto > 0 && mkCustoPreenchido
      ? `${fmtIndice(pesoParaCusto)} g × ${fmtIndice(mkCustoNum)} × ${formatBRL(cotCompraNum)}/g`
      : ''
  const precoBase = cotVendaEfetiva > 0 && indiceNum > 0 && mkNum > 0 ? indiceNum * cotVendaEfetiva * mkNum : 0

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase()
    if (!t) return produtos
    return produtos.filter(
      (p) =>
        p.nome.toLowerCase().includes(t) ||
        (p.codigo ?? '').toLowerCase().includes(t) ||
        (p.fornecedor ?? '').toLowerCase().includes(t) ||
        (p.categorias?.nome ?? '').toLowerCase().includes(t),
    )
  }, [produtos, busca])

  function abrirNovo() {
    setEditando(null)
    const cotStr = cotacao > 0 ? moedaParaInput(cotacao) : ''
    // cotação de venda e de compra já vêm com a cotação atual (ambas editáveis)
    setForm({ ...vazio, cotacao_compra: cotStr, cotacao_venda: cotStr })
    setCustoManual(false)
    setMarkupOutro(false)
    setIndiceManual(false)
    setErro(null)
    setModalAberto(true)
  }

  function abrirEdicao(p: Produto) {
    setEditando(p)
    // A família é o pai da subcategoria gravada no produto.
    const familiaId = categorias.find((c) => c.id === p.categoria_id)?.parent_id ?? ''
    setForm({
      familia_id: familiaId,
      categoria_id: p.categoria_id ?? '',
      nome: p.nome,
      fornecedor: p.fornecedor ?? '',
      quantidade: String(p.quantidade),
      tamanho: p.tamanho ?? '',
      peso_gramas: p.peso_gramas != null ? String(p.peso_gramas).replace('.', ',') : '',
      largura_mm: p.largura_mm != null ? String(p.largura_mm).replace('.', ',') : '',
      espessura_mm: p.espessura_mm != null ? String(p.espessura_mm).replace('.', ',') : '',
      eh_par: p.eh_par ?? false,
      par_tamanho: p.par_tamanho ?? '',
      par_largura_mm: p.par_largura_mm != null ? String(p.par_largura_mm).replace('.', ',') : '',
      par_espessura_mm: p.par_espessura_mm != null ? String(p.par_espessura_mm).replace('.', ',') : '',
      par_peso_gramas: p.par_peso_gramas != null ? String(p.par_peso_gramas).replace('.', ',') : '',
      par_indice: p.par_indice != null ? String(p.par_indice).replace('.', ',') : '',
      cor_ouro: p.cor_ouro ?? '',
      publico: p.publico ?? '',
      pedras: p.pedras ?? '',
      codigo: p.codigo ?? '',
      indice: p.indice != null ? String(p.indice).replace('.', ',') : '',
      mk_custo: p.mk_custo != null ? String(p.mk_custo).replace('.', ',') : '',
      markup: p.markup != null ? String(p.markup).replace('.', ',') : '',
      cotacao_compra: p.cotacao_compra != null ? moedaParaInput(p.cotacao_compra) : '',
      cotacao_venda: p.cotacao_venda != null ? moedaParaInput(p.cotacao_venda) : '',
      custo: p.custo != null ? moedaParaInput(p.custo) : '',
      preco_venda: String(p.preco_venda).replace('.', ','),
      preco_automatico: p.preco_automatico,
      descricao: p.descricao ?? '',
      visivel_no_site: p.visivel_no_site,
      mostrar_preco: p.mostrar_preco,
      fotos: p.foto_urls ?? [],
    })
    // ao editar, mantém o custo gravado (congelado) — lápis em modo manual
    setCustoManual(true)
    // O índice só volta ao automático quando o gravado CONFERE com peso × MK
    // de custo. Peça antiga (mk_custo nulo, ou peso em branco) fica no índice
    // digitado: recalcular às cegas zeraria o índice e, com ele, o preço.
    // `mk_custo` null é peça antiga (nunca teve MK de custo) e cai no manual.
    // `mk_custo` 0 é escolha da Fernanda e conta como automático: peso × 0 = 0,
    // e se o índice gravado também for 0 o par confere.
    const mkCustoGravado = p.mk_custo
    const pesoGravado = p.peso_gramas ?? 0
    const confere = (indice: number | null, peso: number | null) =>
      Math.abs((indice ?? 0) - arredondarIndice((peso ?? 0) * (mkCustoGravado ?? 0))) < 1e-4
    const indiceEhAuto =
      mkCustoGravado != null &&
      pesoGravado > 0 &&
      confere(p.indice, pesoGravado) &&
      (!p.eh_par || confere(p.par_indice, p.par_peso_gramas))
    setIndiceManual(!indiceEhAuto)
    const mkStr = p.markup != null ? String(p.markup).replace('.', ',') : ''
    setMarkupOutro(mkStr !== '' && !MARKUPS.includes(mkStr))
    setErro(null)
    setModalAberto(true)
  }

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    if (!form.nome.trim()) {
      setErro('O nome é obrigatório.')
      return
    }
    setSalvando(true)
    const payload = {
      categoria_id: form.categoria_id || null,
      nome: form.nome.trim(),
      fornecedor: form.fornecedor.trim() || null,
      quantidade: parseFloat(form.quantidade) || 0,
      tamanho: form.tamanho.trim() || null,
      peso_gramas: form.peso_gramas ? parseValor(form.peso_gramas) : null,
      largura_mm: form.largura_mm ? parseValor(form.largura_mm) : null,
      espessura_mm: form.espessura_mm ? parseValor(form.espessura_mm) : null,
      // Sem par, as colunas da 2ª peça voltam a nulo: "desmarcou" = não é par,
      // e sobra de dado invisível confunde preço, etiqueta e site.
      eh_par: ehPar,
      par_tamanho: ehPar ? form.par_tamanho.trim() || null : null,
      par_largura_mm: ehPar && form.par_largura_mm ? parseValor(form.par_largura_mm) : null,
      par_espessura_mm: ehPar && form.par_espessura_mm ? parseValor(form.par_espessura_mm) : null,
      par_peso_gramas: ehPar && form.par_peso_gramas ? parseValor(form.par_peso_gramas) : null,
      par_indice: ehPar && parIndiceNum > 0 ? parIndiceNum : null,
      cor_ouro: form.cor_ouro || null,
      publico: form.publico || null,
      pedras: form.pedras.trim() || null,
      codigo: form.codigo.trim() || null,
      descricao: form.descricao.trim() || null,
      // indice é o da PEÇA. A soma com o par acontece no preço (e no banco,
      // no recalcular_precos_ouro) — gravar a soma aqui contaria em dobro.
      indice: indicePeca > 0 ? indicePeca : null,
      // Preenchido com 0 grava 0, não null: null significa "peça antiga, nunca
      // teve MK de custo" e liga o índice em modo manual na próxima abertura.
      mk_custo: mkCustoPreenchido ? mkCustoNum : null,
      markup: mkNum > 0 ? mkNum : null,
      cotacao_compra: cotCompraNum > 0 ? cotCompraNum : null,
      cotacao_venda: cotVendaEfetiva > 0 ? Number(cotVendaEfetiva.toFixed(2)) : null,
      custo: custoBase > 0 ? Number(custoBase.toFixed(2)) : 0,
      preco_venda: precoBase > 0 ? Number(precoBase.toFixed(2)) : 0,
      preco_automatico: form.preco_automatico,
      visivel_no_site: form.visivel_no_site,
      mostrar_preco: form.mostrar_preco,
      foto_urls: form.fotos,
    }
    const resposta = editando
      ? await supabase.from('produtos').update(payload).eq('id', editando.id)
      : await supabase.from('produtos').insert(payload)
    setSalvando(false)
    if (resposta.error) {
      setErro(resposta.error.message)
      return
    }
    setModalAberto(false)
    carregar()
  }

  async function alternarSite(p: Produto) {
    setProdutos((atual) => atual.map((x) => (x.id === p.id ? { ...x, visivel_no_site: !x.visivel_no_site } : x)))
    await supabase.from('produtos').update({ visivel_no_site: !p.visivel_no_site }).eq('id', p.id)
  }

  // Envia as fotos selecionadas pro Storage (bucket "produtos") e guarda as URLs públicas no form.
  async function onSelecionarFotos(e: ChangeEvent<HTMLInputElement>) {
    const arquivos = e.target.files
    if (!arquivos || arquivos.length === 0) return
    setEnviandoFoto(true)
    setErro(null)
    const novas: string[] = []
    for (const bruto of Array.from(arquivos)) {
      if (!bruto.type.startsWith('image/')) continue
      // Comprime no navegador ANTES de subir: JPEG q88, teto de 2000 px.
      // Sem isso o acervo volta a encher de foto de 2 MB — ver src/lib/foto.ts.
      const arquivo = await prepararFoto(bruto)
      const ext = (arquivo.name.split('.').pop() || 'jpg').toLowerCase()
      const caminho = `${crypto.randomUUID()}.${ext}`
      const { error } = await supabase.storage
        .from('produtos')
        // cacheControl de 1 ano + immutable: o caminho é um UUID novo a cada envio e
        // o upsert é false, então um arquivo nunca é sobrescrito — o conteúdo dessa
        // URL não muda nunca. Trocar a foto de uma peça gera outra URL. Com o padrão
        // do Supabase (max-age=3600) o visitante rebaixava o catálogo inteiro de hora
        // em hora à toa. Não replicar isso no bucket `documentos`: lá o modelo do
        // certificado É reenviado por cima, e cache longo prenderia a arte velha.
        .upload(caminho, arquivo, {
          upsert: false,
          contentType: arquivo.type,
          cacheControl: 'public, max-age=31536000, immutable',
        })
      if (error) {
        setErro('Não consegui enviar a foto: ' + error.message)
        continue
      }
      const { data } = supabase.storage.from('produtos').getPublicUrl(caminho)
      novas.push(data.publicUrl)
    }
    setForm((f) => ({ ...f, fotos: [...f.fotos, ...novas] }))
    setEnviandoFoto(false)
    e.target.value = '' // permite reenviar o mesmo arquivo depois
  }

  function removerFoto(indice: number) {
    setForm((f) => ({ ...f, fotos: f.fotos.filter((_, i) => i !== indice) }))
  }

  // Reordena as fotos (arrastar-e-soltar). A posição 0 é sempre a capa.
  function moverFoto(de: number, para: number) {
    if (de === para || de < 0 || para < 0) return
    setForm((f) => {
      const arr = [...f.fotos]
      const [movida] = arr.splice(de, 1)
      arr.splice(para, 0, movida)
      return { ...f, fotos: arr }
    })
  }

  function definirCapa(indice: number) {
    moverFoto(indice, 0)
  }

  function abrirZoom(url: string, nome?: string) {
    setFotoZoom({ url, nome: nome ?? '' })
  }

  // Baixa a foto de fato (força o download), mesmo sendo de outro domínio (Storage).
  async function baixarFoto(url: string, nomeBase?: string) {
    const ext = (url.split('?')[0].split('.').pop() || 'jpg').toLowerCase()
    const nome = `${(nomeBase || 'foto').trim().replace(/[^\w-]+/g, '_') || 'foto'}.${ext}`
    try {
      const resp = await fetch(url)
      const blob = await resp.blob()
      const objUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objUrl
      a.download = nome
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(objUrl)
    } catch {
      window.open(url, '_blank') // se falhar (rede/CORS), abre em nova aba
    }
  }

  async function excluir(p: Produto) {
    if (!confirm(`Remover a peça "${p.nome}" do estoque?`)) return
    await supabase.from('produtos').update({ ativo: false }).eq('id', p.id)
    carregar()
  }

  async function salvarCotacao() {
    const nova = parseValor(cotacaoInput)
    await supabase.from('configuracoes').update({ valor: nova }).eq('chave', 'cotacao_ouro')
    setCotacao(nova)
    setEditandoCotacao(false)
  }

  async function recalcularPrecos() {
    if (cotacao <= 0) {
      alert('Defina a cotação do ouro antes de recalcular.')
      return
    }
    if (!confirm('Recalcular o preço de venda de todas as peças de ouro (com peso e MK) pela cotação atual?')) return
    setRecalculando(true)
    const { data, error } = await supabase.rpc('recalcular_precos_ouro')
    setRecalculando(false)
    if (error) {
      alert('Erro: ' + error.message)
      return
    }
    await carregar()
    alert(`${data ?? 0} peça(s) recalculada(s).`)
  }

  return (
    <div>
      <CabecalhoPagina
        titulo="Estoque"
        subtitulo={`${produtos.length} peça(s) ativa(s)`}
        acao={
          <div className="flex gap-2">
            {selecionados.size > 0 && (
              <Botao variante="secundario" onClick={() => setEtiquetasProdutos(produtos.filter((p) => selecionados.has(p.id)))}>
                <Tag size={16} /> Etiquetas ({selecionados.size})
              </Botao>
            )}
            <Botao onClick={abrirNovo}><Plus size={16} /> Nova peça</Botao>
          </div>
        }
      />

      {/* Cotação do ouro */}
      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-sm text-stone-500">Cotação do ouro (R$/grama):</span>
            {editandoCotacao ? (
              <div className="flex items-center gap-2">
                {/* ⚠️ Este campo é o mais perigoso do ERP: ele alimenta o
                    "Recalcular preços", que reescreve o preço de TODAS as peças
                    de ouro. Até 11/08/2026 ele abria preenchido com
                    `String(cotacao)`, ou seja "345.53" com PONTO, e o
                    `parseValor` de então jogava o ponto fora: clicar em editar e
                    salvar sem digitar nada gravava 34553 e remarcava o catálogo
                    inteiro ~100× pra cima. Agora abre em "345,53" e o
                    `parseValor` entende ponto decimal. Não voltar a usar
                    `String(numero)` para preencher campo de dinheiro. */}
                <div className="w-36">
                  <CampoMoeda
                    autoFocus
                    value={cotacaoInput}
                    onChange={setCotacaoInput}
                    sufixo="/g"
                  />
                </div>
                <Botao tamanho="md" onClick={salvarCotacao}><Check size={15} /> Salvar</Botao>
                <button onClick={() => setEditandoCotacao(false)} className="text-sm text-stone-500 hover:text-stone-700">Cancelar</button>
              </div>
            ) : (
              <>
                <span className="text-xl font-semibold text-zinc-900">{formatBRL(cotacao)}</span>
                {!cotacaoAuto && (
                  <button
                    onClick={() => { setCotacaoInput(cotacao ? moedaParaInput(cotacao) : ''); setEditandoCotacao(true) }}
                    className="text-sm font-medium text-marca-600 hover:text-marca-700"
                  >
                    editar
                  </button>
                )}
              </>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1.5 text-sm text-stone-500">
              {cotacaoAuto ? 'Automática' : 'Manual'}
              <Interruptor ligado={cotacaoAuto} onToggle={alternarCotacaoAuto} titulo="Atualizar a cotação pelo mercado do ouro" />
            </span>
            {cotacaoAuto && (
              <Botao variante="secundario" onClick={() => atualizarPeloMercado()} disabled={atualizandoCotacao}>
                <RefreshCw size={15} className={atualizandoCotacao ? 'animate-spin' : ''} /> Atualizar agora
              </Botao>
            )}
            <Botao variante="secundario" onClick={recalcularPrecos} disabled={recalculando}>
              <RefreshCw size={15} className={recalculando ? 'animate-spin' : ''} /> Recalcular preços
            </Botao>
          </div>
        </div>
        {cotacaoAuto && (
          <p className="mt-2 text-xs text-stone-400">
            Ouro 24k de mercado{cotacaoFator !== 1 ? ` × ${cotacaoFator.toLocaleString('pt-BR')}` : ''} · atualizada em {formatDataHora(cotacaoAtualizadaEm)}
          </p>
        )}
      </Card>

      {/* Preço no site — chave global, não mexe no cadastro das peças */}
      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <DollarSign size={18} className="text-zinc-700" />
            <span className="text-sm text-stone-500">Preço no site:</span>
          </div>
          <div className="flex flex-wrap gap-1 rounded-lg border border-stone-200 bg-stone-50 p-1">
            {PRECO_SITE_MODOS.map((m) => {
              const ativo = precoSiteModo === m.valor
              const Icone = m.valor === 1 ? Eye : m.valor === 2 ? EyeOff : SlidersHorizontal
              return (
                <button
                  key={m.valor}
                  type="button"
                  onClick={() => trocarPrecoSiteModo(m.valor)}
                  disabled={salvandoPrecoSite}
                  aria-pressed={ativo}
                  title={m.ajuda}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                    ativo ? 'bg-zinc-900 text-white shadow-sm' : 'text-stone-600 hover:bg-white hover:text-stone-800'
                  }`}
                >
                  <Icone size={15} /> {m.rotulo}
                </button>
              )
            })}
          </div>
        </div>
        <p className="mt-2 text-xs text-stone-400">
          {PRECO_SITE_MODOS.find((m) => m.valor === precoSiteModo)?.ajuda}
          {precoSiteModo !== 0 && ' A seleção de cada peça fica guardada e volta a valer no modo Manual.'}
        </p>
      </Card>

      <div className="relative mb-4">
        <Search size={18} className="absolute left-3 top-2.5 text-stone-400" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome, código, fornecedor ou tipo…"
          className="w-full rounded-lg border border-stone-300 bg-white py-2 pl-10 pr-3 text-sm outline-none focus:border-marca-500 focus:ring-2 focus:ring-marca-200"
        />
      </div>

      {carregando ? (
        <Carregando />
      ) : filtrados.length === 0 ? (
        <Vazio
          titulo={busca ? 'Nenhuma peça encontrada' : 'Nenhuma peça cadastrada'}
          descricao={busca ? 'Tente outra busca.' : 'Cadastre a primeira peça do estoque.'}
          acao={!busca && <Botao onClick={abrirNovo}><Plus size={16} /> Nova peça</Botao>}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
                  <th className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={filtrados.length > 0 && filtrados.every((p) => selecionados.has(p.id))}
                      onChange={(e) => setSelecionados(e.target.checked ? new Set(filtrados.map((p) => p.id)) : new Set())}
                      className="h-4 w-4 accent-zinc-900"
                      title="Selecionar todos"
                    />
                  </th>
                  <th className="px-4 py-3 font-medium">Foto</th>
                  <th className="px-4 py-3 font-medium">Código</th>
                  <th className="px-4 py-3 font-medium">Peça</th>
                  <th className="px-4 py-3 font-medium">Tipo</th>
                  <th className="px-4 py-3 font-medium">Tamanho</th>
                  <th className="px-4 py-3 text-right font-medium">Preço</th>
                  <th className="px-4 py-3 text-center font-medium">Qtd</th>
                  <th className="px-4 py-3 text-center font-medium">Site</th>
                  <th className="px-4 py-3 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((p) => (
                  <tr key={p.id} className={`border-b border-stone-100 last:border-0 hover:bg-stone-50/60 ${selecionados.has(p.id) ? 'bg-marca-50/60' : ''}`}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selecionados.has(p.id)}
                        onChange={() => alternarSelecionado(p.id)}
                        className="h-4 w-4 accent-zinc-900"
                      />
                    </td>
                    <td className="px-4 py-3">
                      {p.foto_urls && p.foto_urls[0] ? (
                        <button
                          type="button"
                          onClick={() => abrirZoom(p.foto_urls[0], p.nome)}
                          title="Ver foto"
                          className="block h-10 w-10 overflow-hidden rounded-md border border-stone-200 bg-white transition hover:ring-2 hover:ring-marca-300"
                        >
                          <img src={p.foto_urls[0]} alt={p.nome} className="h-full w-full object-cover" />
                        </button>
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-md border border-dashed border-stone-200 bg-stone-50 text-stone-300" title="Sem foto">
                          <ImageIcon size={16} />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-stone-500">{p.codigo ?? '—'}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-stone-800">
                        {p.nome}
                        {p.eh_par && (
                          <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 align-middle text-[10px] font-medium uppercase tracking-wide text-zinc-600">
                            Par
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-stone-400">
                        {[p.cor_ouro, pesoTotal(p) ? `${pesoTotal(p)}g` : null, p.pedras].filter(Boolean).join(' · ')}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {p.categorias?.nome ? <Badge>{p.categorias.nome}</Badge> : <span className="text-stone-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-stone-600">
                      {p.eh_par && p.par_tamanho ? `${p.tamanho ?? '—'} e ${p.par_tamanho}` : (p.tamanho ?? '—')}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-stone-700">{formatBRL(p.preco_venda)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={p.quantidade <= 0 ? 'text-red-500' : 'text-stone-600'}>{fmtQtd(p.quantidade)}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => alternarSite(p)}
                        title={p.visivel_no_site ? 'Visível no site' : 'Oculto do site'}
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                          p.visivel_no_site
                            ? 'bg-zinc-900 text-white hover:bg-zinc-800'
                            : 'bg-zinc-100 text-zinc-400 hover:bg-zinc-200'
                        }`}
                      >
                        {p.visivel_no_site ? <Eye size={13} /> : <EyeOff size={13} />}
                        {p.visivel_no_site ? 'No site' : 'Oculto'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => setEtiquetasProdutos([p])} className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-marca-600" title="Gerar etiqueta">
                          <Tag size={16} />
                        </button>
                        <button onClick={() => abrirEdicao(p)} className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-marca-600" title="Editar">
                          <Pencil size={16} />
                        </button>
                        <button onClick={() => excluir(p)} className="rounded-lg p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-600" title="Remover">
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

      <Modal
        aberto={modalAberto}
        titulo={editando ? 'Editar peça' : 'Nova peça'}
        onFechar={() => setModalAberto(false)}
        largura="max-w-2xl"
      >
        <form onSubmit={salvar} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Selecao
              label="Família *"
              value={form.familia_id}
              onChange={(e) => {
                const fid = e.target.value
                const filhos = categorias.filter((c) => c.parent_id === fid)
                // se a família tem só uma subcategoria, já seleciona; senão, limpa
                setForm({ ...form, familia_id: fid, categoria_id: filhos.length === 1 ? filhos[0].id : '' })
              }}
            >
              <option value="">Selecione…</option>
              {familias.map((c) => (<option key={c.id} value={c.id}>{c.nome}</option>))}
            </Selecao>
            <Selecao
              label="Subcategoria *"
              value={form.categoria_id}
              onChange={(e) => setForm({ ...form, categoria_id: e.target.value })}
              disabled={!form.familia_id}
            >
              <option value="">{form.familia_id ? 'Selecione…' : '—'}</option>
              {subcategorias.map((c) => (<option key={c.id} value={c.id}>{c.nome}</option>))}
            </Selecao>
          </div>

          <Campo label="Nome do produto *" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex.: Anel solitário com brilhante" />

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo label="Código (SKU do fornecedor)" value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} placeholder="Ex.: 12345" />
            <Selecao label="Público" value={form.publico} onChange={(e) => setForm({ ...form, publico: e.target.value })}>
              <option value="">—</option>
              {PUBLICOS.map((p) => (<option key={p.valor} value={p.valor}>{p.rotulo}</option>))}
            </Selecao>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo label="Fornecedor / ourives" value={form.fornecedor} onChange={(e) => setForm({ ...form, fornecedor: e.target.value })} />
            <Selecao label="Cor do ouro" value={form.cor_ouro} onChange={(e) => setForm({ ...form, cor_ouro: e.target.value })}>
              <option value="">—</option>
              {CORES_OURO.map((c) => (<option key={c} value={c}>{c}</option>))}
            </Selecao>
          </div>

          {/* O peso não fica aqui: ele é a base do custo (peso × MK de custo ×
              cotação) e mora na seção Custo, um campo só, sem cópia. */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo label="Quantidade" type="number" step="0.5" min={0} value={form.quantidade} onChange={(e) => setForm({ ...form, quantidade: e.target.value })} />
            <Campo
              label={unidade.label}
              value={form.tamanho}
              onChange={(e) => setForm({ ...form, tamanho: e.target.value })}
              placeholder={unidade.placeholder}
              disabled={!form.familia_id}
            />
          </div>

          {/* Medidas e par — só para aliança, que é onde largura/espessura
              importam e onde a venda costuma ser em duas peças. */}
          {alianca && (
            <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
              <p className="mb-3 text-sm font-medium text-stone-600">Aliança</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Campo label="Largura (mm)" value={form.largura_mm} onChange={(e) => setForm({ ...form, largura_mm: e.target.value })} placeholder="Ex.: 4,5" inputMode="decimal" />
                <Campo label="Espessura (mm)" value={form.espessura_mm} onChange={(e) => setForm({ ...form, espessura_mm: e.target.value })} placeholder="Ex.: 1,8" inputMode="decimal" />
              </div>

              <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-lg border border-stone-200 bg-white px-4 py-3">
                <input
                  type="checkbox"
                  checked={form.eh_par}
                  onChange={(e) => setForm({ ...form, eh_par: e.target.checked })}
                  className="h-4 w-4 accent-zinc-900"
                />
                <Users size={18} className="text-zinc-700" />
                <span className="text-sm text-stone-700">
                  É um par (2 peças)
                  <span className="block text-xs text-stone-400">Uma unidade no estoque, um card no site, preço somado das duas.</span>
                </span>
              </label>

              {ehPar && (
                <div className="mt-4 rounded-lg border border-stone-200 bg-white p-4">
                  <p className="mb-3 text-sm font-medium text-stone-600">Segunda peça do par</p>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Campo label={unidade.label} value={form.par_tamanho} onChange={(e) => setForm({ ...form, par_tamanho: e.target.value })} placeholder={unidade.placeholder} />
                    <Campo label="Largura (mm)" value={form.par_largura_mm} onChange={(e) => setForm({ ...form, par_largura_mm: e.target.value })} placeholder="Ex.: 4,5" inputMode="decimal" />
                    <Campo label="Espessura (mm)" value={form.par_espessura_mm} onChange={(e) => setForm({ ...form, par_espessura_mm: e.target.value })} placeholder="Ex.: 1,8" inputMode="decimal" />
                  </div>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <Campo label="Peso (g)" value={form.par_peso_gramas} onChange={(e) => setForm({ ...form, par_peso_gramas: e.target.value })} placeholder="Ex.: 3,5" inputMode="decimal" />
                    {indiceManual ? (
                      <Campo label="Índice (ouro)" value={form.par_indice} onChange={(e) => setForm({ ...form, par_indice: e.target.value })} placeholder="Ex.: 3,5" inputMode="decimal" />
                    ) : (
                      <div>
                        <span className="mb-1 block text-sm font-medium text-stone-600">Índice (ouro)</span>
                        <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700">
                          {parIndiceAuto > 0 ? fmtIndice(parIndiceAuto) : <span className="text-stone-300">peso × MK de custo</span>}
                        </div>
                      </div>
                    )}
                  </div>
                  <p className="mt-3 text-xs text-stone-400">
                    Cor do ouro, teor, pedra e fornecedor valem para as duas peças. O índice daqui sai do peso desta peça × MK de custo e soma com o da primeira no preço.
                  </p>
                </div>
              )}
            </div>
          )}

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-stone-600">Pedra</span>
            <input
              list="lista-pedras"
              value={form.pedras}
              onChange={(e) => setForm({ ...form, pedras: e.target.value })}
              placeholder="Pesquise a pedra…"
              className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-marca-500 focus:ring-2 focus:ring-marca-200"
            />
            <datalist id="lista-pedras">
              {PEDRAS.map((p) => (<option key={p} value={p} />))}
            </datalist>
          </label>

          {/* Custo — de onde sai o índice. Vem antes da precificação porque é
              a base dela: o índice calculado aqui é o que precifica a peça. */}
          <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
            <p className="mb-3 text-sm font-medium text-stone-600">Custo</p>
            <div className="grid gap-4 sm:grid-cols-3">
              <Campo
                label={ehPar ? 'Peso (g) da 1ª peça' : 'Peso (g)'}
                value={form.peso_gramas}
                onChange={(e) => setForm({ ...form, peso_gramas: e.target.value })}
                placeholder="Ex.: 3,5"
                inputMode="decimal"
              />
              <Campo
                label="MK de custo"
                value={form.mk_custo}
                onChange={(e) => setForm({ ...form, mk_custo: e.target.value })}
                placeholder="Ex.: 1,2"
                inputMode="decimal"
              />
              <CampoMoeda
                label="Cotação de custo (por grama)"
                value={form.cotacao_compra}
                onChange={(v) => setForm({ ...form, cotacao_compra: v })}
                sufixo="/g"
              />
            </div>

            <div className="mt-3 grid items-end gap-4 sm:grid-cols-3">
              <ValorAutoEditavel
                label="Custo (R$)"
                manual={custoManual}
                valorAuto={custoAuto}
                valorManual={form.custo}
                onEditar={() => { setForm({ ...form, custo: custoAuto > 0 ? moedaParaInput(custoAuto) : '' }); setCustoManual(true) }}
                onAuto={() => setCustoManual(false)}
                onChange={(v) => setForm({ ...form, custo: v })}
              />
              {detalheCusto && (
                <p className="text-xs text-stone-500 sm:col-span-2 sm:pb-2">
                  {detalheCusto}
                  {custoManual && custoAuto > 0 && ` · calculado: ${formatBRL(custoAuto)}`}
                </p>
              )}
            </div>

            <p className="mt-3 text-xs text-stone-400">
              Custo = peso × MK de custo × cotação de custo (lápis para editar à mão).
              {ehPar ? ' Em par entram os pesos das duas peças, e o peso da 2ª fica na seção Aliança.' : ''}{' '}
              O MK de custo também dá o índice inicial da precificação, mas mudar o índice
              lá embaixo <b>não altera este custo</b>.
            </p>
            {/* Sem peso ou sem MK de custo preenchido o índice fica nulo e o preço
                vai a zero. Avisar aqui, que é onde os dois campos estão. Note que
                MK 0 conta como preenchido: cai no aviso de baixo, não neste. */}
            {!indiceManual && !(pesoNum > 0 && mkCustoPreenchido) && (
              <p className="mt-1 text-xs text-amber-600">
                Preencha o peso e o MK de custo para o sistema calcular o índice, o custo e o preço.
              </p>
            )}
            {!indiceManual && pesoNum > 0 && mkCustoPreenchido && mkCustoNum <= 0 && (
              <p className="mt-1 text-xs text-amber-600">
                Com MK de custo 0 o custo fica em R$ 0,00 e o índice em 0, então o preço de
                venda também vai a zero. Use o lápis do índice na precificação para dar preço
                à peça, ou o lápis do custo para digitar o custo à mão.
              </p>
            )}
          </div>

          {/* Precificação */}
          <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
            <p className="mb-3 text-sm font-medium text-stone-600">Precificação (ouro)</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <ValorAutoEditavel
                  label={ehPar ? 'Índice (1ª peça)' : 'Índice (ouro)'}
                  manual={indiceManual}
                  valorAuto={indicePecaAuto}
                  valorManual={form.indice}
                  formatar={fmtIndice}
                  vazioRotulo="peso × MK de custo"
                  moeda={false}
                  onEditar={() => {
                    setForm({
                      ...form,
                      indice: indicePecaAuto > 0 ? numeroParaInput(indicePecaAuto) : form.indice,
                      par_indice: parIndiceAuto > 0 ? numeroParaInput(parIndiceAuto) : form.par_indice,
                    })
                    setIndiceManual(true)
                  }}
                  onAuto={() => setIndiceManual(false)}
                  onChange={(v) => setForm({ ...form, indice: v })}
                />
                {ehPar && (
                  <p className="mt-1 text-xs text-stone-500">
                    Índice do par: <b>{indiceNum > 0 ? fmtIndice(indiceNum) : '—'}</b>
                    {parIndiceNum > 0 ? ` (${fmtIndice(indicePeca)} + ${fmtIndice(parIndiceNum)})` : ' — falta o peso da 2ª peça'}
                  </p>
                )}
              </div>
              <div>
                <Selecao
                  label="MK (markup)"
                  value={markupOutro ? 'outro' : form.markup}
                  onChange={(e) => {
                    const v = e.target.value
                    if (v === 'outro') setMarkupOutro(true)
                    else { setMarkupOutro(false); setForm({ ...form, markup: v }) }
                  }}
                >
                  <option value="">—</option>
                  {MARKUPS.map((mk) => (
                    <option key={mk} value={mk}>{mk}</option>
                  ))}
                  <option value="outro">Outro…</option>
                </Selecao>
                {markupOutro && (
                  <input
                    value={form.markup}
                    onChange={(e) => setForm({ ...form, markup: e.target.value })}
                    placeholder="Ex.: 2,5"
                    inputMode="decimal"
                    className="mt-2 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-marca-500 focus:ring-2 focus:ring-marca-200"
                  />
                )}
              </div>
            </div>

            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-medium text-stone-600">Cotação de venda (por grama)</span>
                  <span className="flex items-center gap-1.5 text-xs text-stone-500">
                    {form.preco_automatico ? 'Automática' : 'Manual'}
                    <Interruptor
                      ligado={form.preco_automatico}
                      onToggle={() => setForm({ ...form, preco_automatico: !form.preco_automatico })}
                      titulo="Automática acompanha a cotação do mercado"
                    />
                  </span>
                </div>
                {form.preco_automatico ? (
                  <div className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700">
                    {cotacao > 0 ? formatBRL(cotacao) : <span className="text-stone-300">automática</span>}
                  </div>
                ) : (
                  <CampoMoeda
                    value={form.cotacao_venda}
                    onChange={(v) => setForm({ ...form, cotacao_venda: v })}
                    sufixo="/g"
                  />
                )}
              </div>
            </div>

            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <span className="mb-1 block text-sm font-medium text-stone-600">
                  {ehPar ? 'Preço de venda do par (R$)' : 'Preço de venda (R$)'}
                </span>
                <div className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-800">
                  {precoBase > 0 ? formatBRL(precoBase) : <span className="font-normal text-stone-300">—</span>}
                </div>
              </div>
            </div>
            <p className="mt-3 text-xs text-stone-400">
              Índice = peso × MK de custo (lápis para digitar outro valor). Preço = índice × cotação de venda × MK.
              {ehPar && ' Em par, o índice é a soma das duas peças, e o preço já é o do par.'} Na cotação de venda <b>Automática</b>, ela acompanha o mercado; em <b>Manual</b>, você fixa o valor.
            </p>
            <p className="mt-1 text-xs text-stone-400">
              O índice digitado aqui mexe <b>só no preço de venda</b>. O custo da seção acima
              continua sendo peso × MK de custo × cotação de custo.
            </p>
            {cotacao <= 0 && (
              <p className="mt-1 text-xs text-amber-600">Defina a cotação do ouro (acima) para calcular custo e preço.</p>
            )}
          </div>

          <Area label="Descrição / observações" rows={2} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />

          {/* Fotos da peça (vão pro site) */}
          <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium text-stone-600">Fotos (para o site)</p>
              {form.fotos.length > 0 && (
                <>
                  <span className="foto-so-hover text-xs text-stone-400">Arraste para reordenar · a 1ª é a capa</span>
                  <span className="foto-legenda text-xs text-stone-400">Use as setas para ordenar · a 1ª é a capa</span>
                </>
              )}
            </div>
            <div className="fotos-grade">
              {form.fotos.map((url, i) => (
                <div key={url} className="foto-item">
                  <div
                    draggable
                    onDragStart={() => setDragFoto(i)}
                    onDragEnter={() => setDragOverFoto(i)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); if (dragFoto !== null) moverFoto(dragFoto, i); setDragFoto(null); setDragOverFoto(null) }}
                    onDragEnd={() => { setDragFoto(null); setDragOverFoto(null) }}
                    className={`foto-thumb group relative shrink-0 cursor-grab overflow-hidden rounded-lg border bg-white transition active:cursor-grabbing ${
                      dragOverFoto === i && dragFoto !== i ? 'border-marca-500 ring-2 ring-marca-300' : 'border-stone-200'
                    } ${dragFoto === i ? 'opacity-40' : ''}`}
                  >
                    <img
                      src={url}
                      alt={`Foto ${i + 1}`}
                      draggable={false}
                      onClick={() => abrirZoom(url, form.nome)}
                      className="h-full w-full cursor-zoom-in object-cover"
                    />
                    {i === 0 && (
                      <span className="pointer-events-none absolute left-1 top-1 rounded bg-zinc-900/85 px-1.5 py-0.5 text-[10px] font-medium text-white">Capa</span>
                    )}
                    <button
                      type="button"
                      onClick={() => removerFoto(i)}
                      title="Remover foto"
                      className="foto-so-hover absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity hover:bg-red-600 group-hover:opacity-100"
                    >
                      <X size={12} />
                    </button>
                    <div className="foto-so-hover absolute inset-x-0 bottom-0 flex justify-center gap-1 bg-gradient-to-t from-black/70 to-transparent p-1 opacity-0 transition-opacity group-hover:opacity-100">
                      {i !== 0 && (
                        <button type="button" onClick={() => definirCapa(i)} title="Definir como capa" className="rounded-md bg-white/90 p-1 text-stone-700 hover:bg-white">
                          <Star size={13} />
                        </button>
                      )}
                      <button type="button" onClick={() => baixarFoto(url, form.nome)} title="Baixar foto" className="rounded-md bg-white/90 p-1 text-stone-700 hover:bg-white">
                        <Download size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Aparelho de toque: sem hover e sem arrastar, então setas e
                      lixeira ficam sempre à vista, com alvo de 44px. */}
                  <div className="foto-acoes min-w-0 flex-1 items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-xs text-stone-500">
                      {i === 0 ? 'Capa' : `Foto ${i + 1}`}
                    </span>
                    <button
                      type="button"
                      onClick={() => moverFoto(i, i - 1)}
                      disabled={i === 0}
                      aria-label={`Mover a foto ${i + 1} para trás`}
                      className="flex h-11 w-11 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-600 disabled:opacity-30"
                    >
                      <ArrowUp size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => moverFoto(i, i + 1)}
                      disabled={i === form.fotos.length - 1}
                      aria-label={`Mover a foto ${i + 1} para frente`}
                      className="flex h-11 w-11 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-600 disabled:opacity-30"
                    >
                      <ArrowDown size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => removerFoto(i)}
                      aria-label={`Remover a foto ${i + 1}`}
                      className="flex h-11 w-11 items-center justify-center rounded-lg border border-red-200 bg-white text-red-600"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
              <label
                className={`flex h-24 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-stone-300 bg-white text-stone-400 hover:border-marca-400 hover:text-marca-600 ${
                  enviandoFoto ? 'pointer-events-none opacity-60' : ''
                }`}
              >
                {enviandoFoto ? (
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-stone-300 border-t-marca-500" />
                ) : (
                  <ImagePlus size={20} />
                )}
                <span className="text-[11px]">{enviandoFoto ? 'Enviando…' : 'Adicionar'}</span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={onSelecionarFotos} disabled={enviandoFoto} />
              </label>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-stone-200 bg-white px-4 py-3">
              <input
                type="checkbox"
                checked={form.visivel_no_site}
                onChange={(e) => setForm({ ...form, visivel_no_site: e.target.checked })}
                className="h-4 w-4 accent-zinc-900"
              />
              <Globe size={18} className="text-zinc-700" />
              <span className="text-sm text-stone-700">Mostrar esta peça no site</span>
            </label>

            {/* A marcação continua sendo salva mesmo quando o modo global manda
                no site — é ela que volta a valer quando a Fernanda escolhe
                "Manual" lá em cima. Por isso o campo não fica desabilitado:
                só avisa que hoje quem decide é o modo. */}
            <div>
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-stone-200 bg-white px-4 py-3">
                <input
                  type="checkbox"
                  checked={form.mostrar_preco}
                  onChange={(e) => setForm({ ...form, mostrar_preco: e.target.checked })}
                  className="h-4 w-4 accent-zinc-900"
                />
                <DollarSign size={18} className="text-zinc-700" />
                <span className="text-sm text-stone-700">Mostrar o preço no site</span>
              </label>
              {precoSiteModo !== 0 && (
                <p className="mt-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  O site está com <strong>{precoSiteModo === 1 ? 'todos os preços à mostra' : 'todos os preços ocultos'}</strong>, então
                  esta opção fica guardada e volta a valer quando o modo do estoque for “Manual”.
                </p>
              )}
            </div>
          </div>

          {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{erro}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Botao type="button" variante="secundario" onClick={() => setModalAberto(false)}>Cancelar</Botao>
            <Botao type="submit" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</Botao>
          </div>
        </form>
      </Modal>

      {/* Zoom da foto com botão de download */}
      {fotoZoom && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4" onClick={() => setFotoZoom(null)}>
          <div className="relative max-h-full" onClick={(e) => e.stopPropagation()}>
            <img src={fotoZoom.url} alt={fotoZoom.nome || 'Foto da peça'} className="max-h-[85vh] w-auto rounded-lg shadow-2xl" />
            <div className="absolute right-2 top-2 flex gap-2">
              <button
                type="button"
                onClick={() => baixarFoto(fotoZoom.url, fotoZoom.nome)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white/95 px-3 py-1.5 text-sm font-medium text-stone-700 shadow hover:bg-white"
              >
                <Download size={16} /> Baixar
              </button>
              <button
                type="button"
                onClick={() => setFotoZoom(null)}
                title="Fechar"
                className="rounded-lg bg-white/95 p-2 text-stone-700 shadow hover:bg-white"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de impressão de etiquetas */}
      {etiquetasProdutos && (
        <div className="modal-etiquetas fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
          <div className="modal-etiquetas-box w-full max-w-3xl rounded-2xl bg-white shadow-xl">
            <div className="nao-imprimir flex items-center justify-between border-b border-stone-200 px-5 py-3">
              <h3 className="text-lg font-semibold text-stone-800">Etiquetas ({etiquetasProdutos.length})</h3>
              <div className="flex items-center gap-2">
                <Botao onClick={() => window.print()}><Printer size={16} /> Imprimir</Botao>
                <button onClick={() => setEtiquetasProdutos(null)} className="rounded-lg p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600">
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="px-5 py-4">
              <p className="nao-imprimir mb-3 text-xs text-stone-400">
                Prévia das etiquetas. Na janela de impressão escolha a Zebra, layout <strong>Retrato</strong>,
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

/** Campo de valor calculado automaticamente, com lápis para editar à mão. */
function ValorAutoEditavel({
  label,
  manual,
  valorAuto,
  valorManual,
  onEditar,
  onAuto,
  onChange,
  // O índice não é dinheiro: quem usa o componente pode trocar o formato e o
  // texto de "sem valor ainda" para explicar de onde o número sairia.
  formatar = formatBRL,
  vazioRotulo = 'automático',
  // Dinheiro ganha o "R$" fixo e a formatação pt-BR ao sair do campo. O índice
  // não: ele é um multiplicador em 4 casas, e arredondar para 2 mudaria a conta.
  moeda = true,
}: {
  label: string
  manual: boolean
  valorAuto: number
  valorManual: string
  onEditar: () => void
  onAuto: () => void
  onChange: (v: string) => void
  formatar?: (n: number) => string
  vazioRotulo?: string
  moeda?: boolean
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-stone-600">{label}</span>
      <div className="flex items-center gap-2">
        {manual ? (
          <>
            {moeda ? (
              <div className="w-full">
                <CampoMoeda value={valorManual} onChange={onChange} />
              </div>
            ) : (
              <input
                value={valorManual}
                onChange={(e) => onChange(e.target.value)}
                placeholder="0,00"
                inputMode="decimal"
                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-marca-500 focus:ring-2 focus:ring-marca-200"
              />
            )}
            <button
              type="button"
              onClick={onAuto}
              title="Voltar ao cálculo automático"
              className="shrink-0 rounded-lg border border-stone-300 bg-white p-2 text-stone-500 hover:bg-stone-100"
            >
              <RefreshCw size={15} />
            </button>
          </>
        ) : (
          <>
            <div className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700">
              {valorAuto > 0 ? formatar(valorAuto) : <span className="text-stone-300">{vazioRotulo}</span>}
            </div>
            <button
              type="button"
              onClick={onEditar}
              title="Editar manualmente"
              className="shrink-0 rounded-lg border border-stone-300 bg-white p-2 text-stone-500 hover:bg-marca-50 hover:text-marca-600"
            >
              <Pencil size={15} />
            </button>
          </>
        )}
      </div>
    </label>
  )
}
