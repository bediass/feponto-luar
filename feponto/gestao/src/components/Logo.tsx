import { logoSvg } from './logoSvg'

/**
 * Logo oficial Feponto (monoline, vetor).
 * A cor segue o `color` do elemento (currentColor), então use classes
 * de texto do Tailwind: `text-white` no menu escuro, `text-zinc-900` no claro.
 * O tamanho é controlado pela altura do wrapper.
 */
export function Logo({ className = '', titulo = 'Fê Ponto Joias' }: { className?: string; titulo?: string }) {
  return (
    <span
      role="img"
      aria-label={titulo}
      className={`inline-flex items-center justify-center [&>svg]:h-full [&>svg]:w-auto ${className}`}
      dangerouslySetInnerHTML={{ __html: logoSvg }}
    />
  )
}
