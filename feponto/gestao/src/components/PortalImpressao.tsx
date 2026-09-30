import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'

/**
 * Manda o conteúdo pra #raiz-impressao, que fica fora do #root no index.html.
 *
 * Por que portal e não imprimir o próprio modal: o Layout tem
 * `overflow-hidden` no wrapper da coluna e `overflow-y-auto` no <main>, e
 * html/body/#root são `height: 100%`. Na impressão a página passa a ter a
 * altura da etiqueta (12mm), então qualquer conteúdo dentro dessa cadeia é
 * cortado pelos overflow. Somando a isso, esconder o app com
 * `visibility: hidden` não devolve o espaço que ele ocupa — a etiqueta era
 * empurrada pra fora da única folha e saía tudo branco.
 *
 * Fora do #root não há overflow nem altura herdada pra atrapalhar: na
 * impressão o #root sai com `display: none` (que sim libera o espaço) e só
 * este nó é renderizado.
 */
export function PortalImpressao({ children }: { children: ReactNode }) {
  const alvo = typeof document === 'undefined' ? null : document.getElementById('raiz-impressao')
  if (!alvo) return null
  return createPortal(children, alvo)
}
