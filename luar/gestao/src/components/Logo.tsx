/**
 * Wordmark da Luar (PNG em public/). "u" = lua crescente.
 * `variante="branco"` no fundo escuro (sidebar), `"ouro"` no fundo claro.
 * O tamanho é controlado pela altura via className (ex.: `h-8`).
 */
export function Logo({
  className = '',
  variante = 'ouro',
}: {
  className?: string
  variante?: 'ouro' | 'branco'
}) {
  const src = variante === 'branco' ? '/logo-luar-branco.png' : '/logo-luar.png'
  return <img src={src} alt="Luar Acessórios" className={`w-auto object-contain ${className}`} />
}
