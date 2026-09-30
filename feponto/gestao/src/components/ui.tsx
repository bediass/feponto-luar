import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { X } from 'lucide-react'
import { formatValorEditavel } from '@/lib/format'

type Variante = 'primario' | 'secundario' | 'perigo' | 'fantasma'

const estilosBotao: Record<Variante, string> = {
  primario: 'bg-marca-600 text-white hover:bg-marca-700 shadow-sm',
  secundario: 'bg-white text-stone-700 border border-stone-300 hover:bg-stone-50',
  perigo: 'bg-red-600 text-white hover:bg-red-700',
  fantasma: 'bg-transparent text-stone-600 hover:bg-stone-100',
}

export function Botao({
  variante = 'primario',
  tamanho = 'md',
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; tamanho?: 'md' | 'lg' }) {
  const dim = tamanho === 'lg' ? 'px-5 py-3 text-base' : 'px-4 py-2 text-sm'
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${dim} ${estilosBotao[variante]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-stone-200 bg-white ${className}`}>{children}</div>
  )
}

export function Campo({ label, tamanho = 'md', className = '', ...props }: InputHTMLAttributes<HTMLInputElement> & { label?: string; tamanho?: 'md' | 'lg' }) {
  const dim = tamanho === 'lg' ? 'px-4 py-3 text-base' : 'px-3 py-2 text-sm'
  const lab = tamanho === 'lg' ? 'mb-1.5 text-sm' : 'mb-1 text-sm'
  return (
    <label className="block">
      {label && <span className={`block font-medium text-stone-600 ${lab}`}>{label}</span>}
      <input
        className={`w-full rounded-lg border border-stone-300 bg-white outline-none focus:border-marca-500 focus:ring-2 focus:ring-marca-200 ${dim} ${className}`}
        {...props}
      />
    </label>
  )
}

/**
 * Campo de dinheiro: "R$" fixo à esquerda e o valor formatado em pt-BR quando o
 * usuário sai do campo ("345.53" vira "345,53"; "1234" vira "1.234,00").
 *
 * Formata no `blur`, nunca a cada tecla: reescrever enquanto digita joga o
 * cursor pro fim do texto e atrapalha quem está corrigindo o meio do número.
 * O valor continua sendo TEXTO no formulário — quem salva usa `parseValor`,
 * como no resto do ERP. Formatar aqui não é enfeite: é o que mostra, antes de
 * salvar, como o número foi entendido (ver a regra do ponto em `parseValor`).
 *
 * `onChange` recebe o texto direto, não o evento, porque o componente também
 * chama com o valor já formatado ao sair do campo.
 */
export function CampoMoeda({
  label,
  value,
  onChange,
  sufixo,
  className = '',
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  label?: ReactNode
  value: string
  onChange: (texto: string) => void
  /** Ex.: "/g" para cotação por grama. Fica cinza, depois do valor. */
  sufixo?: string
}) {
  return (
    <label className="block">
      {label && <span className="mb-1 block text-sm font-medium text-stone-600">{label}</span>}
      <div className="flex w-full items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus-within:border-marca-500 focus-within:ring-2 focus-within:ring-marca-200">
        <span className="shrink-0 select-none text-stone-400">R$</span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => {
            const formatado = formatValorEditavel(e.target.value)
            if (formatado !== e.target.value) onChange(formatado)
          }}
          inputMode="decimal"
          placeholder="0,00"
          className={`w-full min-w-0 border-0 bg-transparent p-0 text-sm outline-none placeholder:text-stone-300 ${className}`}
          {...props}
        />
        {sufixo && <span className="shrink-0 select-none text-stone-400">{sufixo}</span>}
      </div>
    </label>
  )
}

export function Area({ label, className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
  return (
    <label className="block">
      {label && <span className="mb-1 block text-sm font-medium text-stone-600">{label}</span>}
      <textarea
        className={`w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-marca-500 focus:ring-2 focus:ring-marca-200 ${className}`}
        {...props}
      />
    </label>
  )
}

export function Selecao({ label, className = '', children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  return (
    <label className="block">
      {label && <span className="mb-1 block text-sm font-medium text-stone-600">{label}</span>}
      <select
        className={`w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-marca-500 focus:ring-2 focus:ring-marca-200 ${className}`}
        {...props}
      >
        {children}
      </select>
    </label>
  )
}

export function Interruptor({
  ligado,
  onToggle,
  titulo,
}: {
  ligado: boolean
  onToggle: () => void
  titulo?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      title={titulo}
      onClick={onToggle}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
        ligado ? 'bg-zinc-900' : 'bg-stone-300'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          ligado ? 'translate-x-4' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}

export function Badge({ children, cor = 'stone' }: { children: ReactNode; cor?: string }) {
  const cores: Record<string, string> = {
    stone: 'bg-stone-100 text-stone-700',
    verde: 'bg-emerald-100 text-emerald-700',
    ambar: 'bg-amber-100 text-amber-700',
    azul: 'bg-blue-100 text-blue-700',
    vermelho: 'bg-red-100 text-red-700',
    roxo: 'bg-purple-100 text-purple-700',
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cores[cor] ?? cores.stone}`}>
      {children}
    </span>
  )
}

export function Modal({
  aberto,
  titulo,
  onFechar,
  children,
  largura = 'max-w-lg',
}: {
  aberto: boolean
  titulo: string
  onFechar: () => void
  children: ReactNode
  largura?: string
}) {
  if (!aberto) return null
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40">
      <div className="flex min-h-full items-start justify-center p-4 sm:items-center">
        <div className={`w-full ${largura} rounded-2xl bg-white shadow-xl`}>
          <div className="flex items-center justify-between border-b border-stone-200 px-5 py-3">
            <h3 className="text-lg font-semibold text-stone-800">{titulo}</h3>
            <button onClick={onFechar} className="rounded-lg p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600">
              <X size={20} />
            </button>
          </div>
          <div className="px-5 py-4">{children}</div>
        </div>
      </div>
    </div>
  )
}

export function CabecalhoPagina({ titulo, subtitulo, acao }: { titulo: string; subtitulo?: string; acao?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-serif text-3xl font-semibold tracking-tight text-zinc-900">{titulo}</h1>
        {subtitulo && <p className="mt-1 text-sm text-stone-500">{subtitulo}</p>}
      </div>
      {acao}
    </div>
  )
}

export function Vazio({ titulo, descricao, acao }: { titulo: string; descricao?: string; acao?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-stone-300 bg-white/50 px-6 py-16 text-center">
      <p className="text-base font-medium text-stone-600">{titulo}</p>
      {descricao && <p className="mt-1 max-w-sm text-sm text-stone-400">{descricao}</p>}
      {acao && <div className="mt-4">{acao}</div>}
    </div>
  )
}

export function Carregando({ texto = 'Carregando…' }: { texto?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-stone-400">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-stone-300 border-t-marca-500" />
      {texto}
    </div>
  )
}
