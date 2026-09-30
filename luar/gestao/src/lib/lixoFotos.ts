import { useMemo, useRef } from 'react'
import { supabase } from '@/lib/supabase'

/* Apaga do Storage a foto que saiu da peça — senão o arquivo fica no bucket
 * pra sempre, contando pro teto de 1 GB do plano free.
 *
 * ⚠️ POR QUE NÃO APAGA NA HORA DO CLIQUE NO "X"
 *   O "x" da galeria só mexe no ESTADO DO FORMULÁRIO. Se o arquivo sumisse ali
 *   e a peça fosse fechada no Cancelar, `produtos.foto_urls` e `imagem_url`
 *   continuariam apontando pro arquivo que não existe mais: foto quebrada na
 *   loja, sem volta. Por isso o Storage só é tocado DEPOIS que o banco
 *   confirmou, e o que se apaga depende de como o formulário terminou:
 *     salvou   → apaga o que o "x" tirou (o banco já não cita mais)
 *     cancelou → apaga o que subiu nessa sessão (o banco nunca chegou a citar)
 *   Nunca o contrário: no cancelar, a foto tirada com o "x" continua sendo a
 *   foto da peça no banco.
 *
 * ⚠️ POR QUE CONFERE O BANCO ANTES DE APAGAR
 *   Foto apagada do Storage não volta — o único backup é o retrato de
 *   02/08/2026 em C:\Backups\feponto-luar-fotos. O caminho de upload é sempre
 *   um `crypto.randomUUID()` com `upsert: false`, então na prática cada arquivo
 *   pertence a uma peça só; mas conferir custa uma consulta e errar custa
 *   imagem quebrada na loja. Se a conferência falhar, NÃO apaga: sobra arquivo
 *   no bucket, que é exatamente o problema pequeno.
 *
 * ⚠️ Remover peça do catálogo é `ativo = false`, não DELETE (Catalogo.excluir).
 *   A linha continua com as URLs, a conferência enxerga e as fotos ficam — o
 *   que é o certo, já que peça desativada pode voltar.
 *
 * As três tabelas conferidas são as únicas com coluna de foto no banco da Luar:
 * `produtos` (imagem_url + foto_urls), `kits` e `producao`. `kits_site` e
 * `kit_itens_site` são views sobre essas.
 */

const BUCKET = 'produtos'
const MARCA = `/object/public/${BUCKET}/`

/** URL pública → caminho dentro do bucket. null se não for foto nossa. */
function caminhoNoBucket(url: string): string | null {
  const corte = url.indexOf(MARCA)
  if (corte < 0) return null
  const caminho = url.slice(corte + MARCA.length).split('?')[0]
  if (!caminho) return null
  try {
    return decodeURIComponent(caminho)
  } catch {
    return caminho
  }
}

/** Literal de array do Postgres, com aspas — URL não tem vírgula hoje, mas o
 *  operador `ov` quebraria em silêncio se um dia tiver. */
function literalArray(valores: string[]): string {
  return `{${valores.map((v) => `"${v.replace(/(["\\])/g, '\\$1')}"`).join(',')}}`
}

type LinhaComFoto = { foto_urls?: string[] | null; imagem_url?: string | null }

/** URLs que alguma linha do banco ainda cita. `null` = não deu pra conferir. */
async function aindaEmUso(urls: string[]): Promise<Set<string> | null> {
  const lista = literalArray(urls)
  const respostas = await Promise.all([
    supabase.from('produtos').select('foto_urls').filter('foto_urls', 'ov', lista),
    supabase.from('produtos').select('imagem_url').in('imagem_url', urls),
    supabase.from('kits').select('foto_urls').filter('foto_urls', 'ov', lista),
    supabase.from('producao').select('foto_urls').filter('foto_urls', 'ov', lista),
  ])

  const usadas = new Set<string>()
  for (const r of respostas) {
    if (r.error) {
      console.warn('[fotos] não deu pra conferir se a foto está em uso, não vou apagar:', r.error.message)
      return null
    }
    for (const linha of (r.data ?? []) as LinhaComFoto[]) {
      if (Array.isArray(linha.foto_urls)) linha.foto_urls.forEach((u) => usadas.add(u))
      if (linha.imagem_url) usadas.add(linha.imagem_url)
    }
  }
  return usadas
}

/** Apaga as URLs que ninguém mais cita. Best-effort: nunca lança, nunca
 *  atrapalha o salvamento — no pior caso o arquivo fica e vira lixo. */
export async function apagarFotosDoStorage(urls: string[]): Promise<void> {
  const alvos = new Map<string, string>()
  for (const url of urls) {
    const caminho = caminhoNoBucket(url)
    if (caminho) alvos.set(url, caminho)
  }
  if (alvos.size === 0) return

  try {
    const usadas = await aindaEmUso([...alvos.keys()])
    if (!usadas) return

    const caminhos = [...alvos].filter(([url]) => !usadas.has(url)).map(([, caminho]) => caminho)
    if (caminhos.length === 0) return

    const { error } = await supabase.storage.from(BUCKET).remove(caminhos)
    if (error) console.warn('[fotos] não consegui apagar do Storage:', error.message)
  } catch (e) {
    console.warn('[fotos] falha ao apagar do Storage:', e)
  }
}

/** Anota o que entrou e o que saiu enquanto o formulário está aberto, pra saber
 *  o que apagar quando ele terminar. Um por tela (Catálogo, Kits). */
export function useLixoFotos() {
  const enviadas = useRef<Set<string>>(new Set())
  const removidas = useRef<Set<string>>(new Set())

  // Sem `this`: os métodos são passados soltos como prop pra GaleriaFotos.
  return useMemo(() => {
    const limpar = () => {
      enviadas.current.clear()
      removidas.current.clear()
    }
    return {
      /** Chamar ao ABRIR o formulário: sessão nova, contagem zerada. */
      limpar,
      registrarEnvio: (urls: string[]) => urls.forEach((u) => enviadas.current.add(u)),
      registrarRemocao: (url: string) => removidas.current.add(url),
      /** Depois que o banco confirmou. `fotosSalvas` é o que ficou gravado —
       *  só apaga o que saiu e não voltou. */
      aposSalvar: async (fotosSalvas: string[]) => {
        const ficaram = new Set(fotosSalvas)
        const alvos = [...removidas.current].filter((u) => !ficaram.has(u))
        limpar()
        await apagarFotosDoStorage(alvos)
      },
      /** Fechou sem salvar: o que subiu nessa sessão nunca chegou ao banco. */
      aoDescartar: async () => {
        const alvos = [...enviadas.current]
        limpar()
        await apagarFotosDoStorage(alvos)
      },
    }
  }, [])
}
