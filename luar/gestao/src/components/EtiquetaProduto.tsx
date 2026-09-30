import { Logo } from '@/components/Logo'
import { formatBRL } from '@/lib/format'
import type { Produto } from '@/types/db'

/**
 * Etiqueta de peça — 9 × 1,2 cm, dobra ao meio.
 *
 * Metade esquerda, três linhas empilhadas: nome, código (SKU) e preço de venda.
 * A marca fica na dobra (4,5 cm) — ver index.css.
 *
 * Diferença em relação à etiqueta da Fê Ponto: aqui a terceira linha é o PREÇO
 * DE VENDA (lá é o índice), e não há linha de material.
 */
export function EtiquetaProduto({ produto }: { produto: Produto }) {
  return (
    <div className="etiqueta">
      {/* Metade das informações */}
      <div className="etiqueta-info">
        <div className="etiqueta-nome">{produto.nome}</div>
        {produto.codigo && <div className="etiqueta-codigo">{produto.codigo}</div>}
        <div className="etiqueta-preco">{formatBRL(produto.preco_centavos)}</div>
      </div>

      {/* Só a marca, na dobra — 4,5 cm da esquerda (ver index.css) */}
      <div className="etiqueta-logo">
        <Logo className="etiqueta-logo-simbolo" />
      </div>
    </div>
  )
}
