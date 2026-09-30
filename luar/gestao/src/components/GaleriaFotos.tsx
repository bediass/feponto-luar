import { useState, type ChangeEvent } from 'react'
import { X, ImagePlus, Star, Download, ArrowUp, ArrowDown, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { prepararFoto } from '@/lib/foto'

/* Galeria de fotos do formulário: enviar, arrastar pra reordenar, definir capa,
 * baixar, ampliar e remover.
 *
 * POR QUE É COMPONENTE E NÃO CÓDIGO REPETIDO
 *   Nasceu dentro do Catalogo.tsx. Quando o Kits precisou das mesmas coisas
 *   (03/08/2026), copiar as ~60 linhas garantiria que as duas telas iam divergir
 *   no primeiro ajuste. Aqui as duas usam o mesmo código: corrigiu num lugar,
 *   corrigiu nos dois.
 *
 * NO CELULAR É OUTRO LAYOUT (06/08/2026)
 *   Tela de toque não tem hover e não dispara o arrastar-e-soltar do HTML5, e o
 *   Tailwind v4 embrulha `group-hover` em @media (hover: hover). Então excluir,
 *   definir capa e reordenar simplesmente não existiam no celular: só dava pra
 *   adicionar. Sem hover a grade vira lista, com setas e lixeira sempre à vista
 *   (alvo de 44px). As regras estão em src/index.css (`.fotos-grade`,
 *   `.foto-thumb`, `.foto-acoes`, `.foto-so-hover`) — não trocar por utilitário
 *   do Tailwind: as duas regras empatariam em especificidade.
 *
 * ATENÇÃO AO ENVIO
 *   `prepararFoto` comprime no navegador (JPEG q88, teto de 2000 px) ANTES de
 *   subir. Sem isso o acervo volta a encher de foto de 2 MB. Ver src/lib/foto.ts.
 *   O caminho é um UUID novo a cada envio, com `upsert: false`: arquivo nunca é
 *   sobrescrito, então o cache de 1 ano + immutable é seguro. Trocar a foto de
 *   uma peça gera outra URL.
 */

type Props = {
  /** URLs já enviadas, na ordem. A primeira é a capa. */
  fotos: string[]
  /** Devolve a lista nova. O pai é quem guarda o estado. */
  aoMudar: (fotos: string[]) => void
  /** Vira o nome do arquivo ao baixar. */
  nomeBase?: string
  titulo?: string
  /** Some quando o formulário está salvando. */
  desabilitado?: boolean
  aoErrar?: (mensagem: string) => void
  /** Avisa o pai enquanto sobe foto, pra ele travar o botão de salvar.
   *  Sem isso dá pra salvar com a foto no meio do caminho e a peça fica sem ela. */
  aoEnviar?: (enviando: boolean) => void
  /** Rastro pro lixo do Storage: o que subiu e o que saiu nessa sessão.
   *  Quem apaga de verdade é o useLixoFotos do pai, e só depois do banco
   *  confirmar. Ver src/lib/lixoFotos.ts. */
  aoAdicionar?: (urls: string[]) => void
  aoRemover?: (url: string) => void
}

export function GaleriaFotos({
  fotos, aoMudar, nomeBase, titulo = 'Fotos (para o site)', desabilitado, aoErrar, aoEnviar,
  aoAdicionar, aoRemover,
}: Props) {
  const [enviando, setEnviando] = useState(false)
  const [arrastando, setArrastando] = useState<number | null>(null)
  const [alvo, setAlvo] = useState<number | null>(null)
  const [zoom, setZoom] = useState<string | null>(null)

  async function aoSelecionar(e: ChangeEvent<HTMLInputElement>) {
    const arquivos = e.target.files
    if (!arquivos || arquivos.length === 0) return
    setEnviando(true); aoEnviar?.(true)
    const novas: string[] = []
    for (const bruto of Array.from(arquivos)) {
      if (!bruto.type.startsWith('image/')) continue
      const arquivo = await prepararFoto(bruto)
      const ext = (arquivo.name.split('.').pop() || 'jpg').toLowerCase()
      const caminho = `${crypto.randomUUID()}.${ext}`
      const { error } = await supabase.storage.from('produtos').upload(caminho, arquivo, {
        upsert: false,
        cacheControl: '31536000, immutable',
        contentType: arquivo.type || 'image/jpeg',
      })
      if (error) { aoErrar?.('Não consegui enviar a foto: ' + error.message); continue }
      novas.push(supabase.storage.from('produtos').getPublicUrl(caminho).data.publicUrl)
    }
    aoMudar([...fotos, ...novas])
    if (novas.length) aoAdicionar?.(novas)
    setEnviando(false); aoEnviar?.(false)
    e.target.value = ''
  }

  function mover(de: number, para: number) {
    if (de === para || de < 0 || para < 0) return
    const arr = [...fotos]
    const [movida] = arr.splice(de, 1)
    arr.splice(para, 0, movida)
    aoMudar(arr)
  }

  const baixar = (url: string) => baixarFoto(url, nomeBase)

  function remover(i: number) {
    aoRemover?.(fotos[i])
    aoMudar(fotos.filter((_, x) => x !== i))
  }

  return (
    <>
      <div className="rounded-xl border border-marca-200 bg-marca-50 p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium text-marca-600">{titulo}</p>
          {fotos.length > 0 && (
            <>
              <span className="foto-so-hover text-xs text-marca-400">Arraste para reordenar. A 1ª é a capa</span>
              <span className="foto-legenda text-xs text-marca-400">Use as setas para ordenar. A 1ª é a capa</span>
            </>
          )}
        </div>
        <div className="fotos-grade">
          {fotos.map((url, i) => (
            <div key={url} className="foto-item">
              <div
                draggable
                onDragStart={() => setArrastando(i)}
                onDragEnter={() => setAlvo(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  if (arrastando !== null) mover(arrastando, i)
                  setArrastando(null); setAlvo(null)
                }}
                onDragEnd={() => { setArrastando(null); setAlvo(null) }}
                className={`foto-thumb group relative shrink-0 cursor-grab overflow-hidden rounded-lg border bg-white transition active:cursor-grabbing ${
                  alvo === i && arrastando !== i ? 'border-fendi-500 ring-2 ring-fendi-300' : 'border-marca-200'
                } ${arrastando === i ? 'opacity-40' : ''}`}
              >
                <img
                  src={url}
                  alt={`Foto ${i + 1}`}
                  draggable={false}
                  onClick={() => setZoom(url)}
                  className="h-full w-full cursor-zoom-in object-cover"
                />
                {i === 0 && (
                  <span className="pointer-events-none absolute left-1 top-1 rounded bg-marca-900/85 px-1.5 py-0.5 text-[10px] font-medium text-white">
                    Capa
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => remover(i)}
                  title="Remover foto"
                  className="foto-so-hover absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity hover:bg-red-600 group-hover:opacity-100"
                >
                  <X size={12} />
                </button>
                <div className="foto-so-hover absolute inset-x-0 bottom-0 flex justify-center gap-1 bg-gradient-to-t from-black/70 to-transparent p-1 opacity-0 transition-opacity group-hover:opacity-100">
                  {i !== 0 && (
                    <button type="button" onClick={() => mover(i, 0)} title="Definir como capa"
                      className="rounded-md bg-white/90 p-1 text-marca-700 hover:bg-white">
                      <Star size={13} />
                    </button>
                  )}
                  <button type="button" onClick={() => baixar(url)} title="Baixar foto"
                    className="rounded-md bg-white/90 p-1 text-marca-700 hover:bg-white">
                    <Download size={13} />
                  </button>
                </div>
              </div>

              {/* Aparelho de toque: sem hover e sem arrastar, então setas e
                  lixeira ficam sempre à vista, com alvo de 44px. */}
              <div className="foto-acoes min-w-0 flex-1 items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-xs text-marca-500">
                  {i === 0 ? 'Capa' : `Foto ${i + 1}`}
                </span>
                <button
                  type="button"
                  onClick={() => mover(i, i - 1)}
                  disabled={i === 0}
                  aria-label={`Mover a foto ${i + 1} para trás`}
                  className="flex h-11 w-11 items-center justify-center rounded-lg border border-marca-200 bg-white text-marca-600 disabled:opacity-30"
                >
                  <ArrowUp size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => mover(i, i + 1)}
                  disabled={i === fotos.length - 1}
                  aria-label={`Mover a foto ${i + 1} para frente`}
                  className="flex h-11 w-11 items-center justify-center rounded-lg border border-marca-200 bg-white text-marca-600 disabled:opacity-30"
                >
                  <ArrowDown size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => remover(i)}
                  aria-label={`Remover a foto ${i + 1}`}
                  className="flex h-11 w-11 items-center justify-center rounded-lg border border-red-200 bg-white text-red-600"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
          <label
            className={`flex h-24 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-marca-300 bg-white text-marca-400 hover:border-fendi-400 hover:text-fendi-600 ${
              enviando || desabilitado ? 'pointer-events-none opacity-60' : ''
            }`}
          >
            {enviando
              ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-marca-300 border-t-fendi-500" />
              : <ImagePlus size={20} />}
            <span className="text-[11px]">{enviando ? 'Enviando...' : 'Adicionar'}</span>
            <input type="file" accept="image/*" multiple className="hidden"
              onChange={aoSelecionar} disabled={enviando || desabilitado} />
          </label>
        </div>
      </div>

      {zoom && <VisorFoto url={zoom} nome={nomeBase} aoFechar={() => setZoom(null)} />}
    </>
  )
}

/** Baixa a foto com um nome legível. Cai pra abrir em aba se o fetch falhar
 *  (Storage fora do ar ou CORS): pior sair uma aba do que sair nada. */
export async function baixarFoto(url: string, nomeBase?: string) {
  const ext = (url.split('?')[0].split('.').pop() || 'jpg').toLowerCase()
  const nome = `${(nomeBase || 'foto').trim().replace(/[^\w-]+/g, '_') || 'foto'}.${ext}`
  try {
    const blob = await (await fetch(url)).blob()
    const objUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = objUrl
    a.download = nome
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(objUrl)
  } catch {
    window.open(url, '_blank')
  }
}

/** Foto ampliada em tela cheia, com botão de baixar. Usada pela galeria e
 *  pela miniatura da lista do catálogo. */
export function VisorFoto({ url, nome, aoFechar }: { url: string; nome?: string; aoFechar: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4" onClick={aoFechar}>
      <div className="relative max-h-full" onClick={(e) => e.stopPropagation()}>
        <img src={url} alt={nome || 'Foto'} className="max-h-[85vh] w-auto rounded-lg shadow-2xl" />
        <div className="absolute right-2 top-2 flex gap-2">
          <button type="button" onClick={() => baixarFoto(url, nome)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/95 px-3 py-1.5 text-sm font-medium text-marca-700 shadow hover:bg-white">
            <Download size={16} /> Baixar
          </button>
          <button type="button" onClick={aoFechar} title="Fechar"
            className="rounded-lg bg-white/95 p-2 text-marca-700 shadow hover:bg-white">
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
