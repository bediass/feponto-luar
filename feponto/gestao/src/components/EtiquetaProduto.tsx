import { Logo } from '@/components/Logo'
import { indiceTotal } from '@/lib/joias'
import type { Produto } from '@/types/db'

/**
 * Etiqueta de joia — 9 × 1,2 cm, dobra ao meio.
 * Metade esquerda: informações do produto. A marca fica na dobra (4,5 cm).
 *
 * Em par de alianças a etiqueta é uma só (o par é uma unidade de estoque) e o
 * índice impresso é o do PAR — é ele que fecha com o preço na vitrine.
 */
export function EtiquetaProduto({ produto }: { produto: Produto }) {
  const indice = indiceTotal(produto)
  return (
    <div className="etiqueta">
      {/* Metade das informações */}
      <div className="etiqueta-info">
        <div className="etiqueta-nome">{produto.nome}</div>
        {produto.cor_ouro && <div className="etiqueta-cor">{produto.cor_ouro}</div>}
        <div className="etiqueta-meta">
          {produto.codigo && <span>{produto.codigo}</span>}
          {/* só o número do índice — o rótulo "Índice" saiu */}
          {indice > 0 && <span>{indice}</span>}
        </div>
      </div>

      {/* Só a marca, na dobra — 4,5 cm da esquerda (ver index.css) */}
      <div className="etiqueta-logo">
        <Logo className="etiqueta-logo-simbolo text-zinc-900" titulo="Fê Ponto Joias" />
      </div>
    </div>
  )
}
