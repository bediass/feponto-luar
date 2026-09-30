import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Botao, Campo } from '@/components/ui'
import { Logo } from '@/components/Logo'

export default function Login() {
  const { session, entrar } = useAuth()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  if (session) return <Navigate to="/" replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    setEnviando(true)
    const { error } = await entrar(email, senha)
    setEnviando(false)
    if (error) setErro(error)
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-gradient-to-b from-white to-zinc-100 p-4">
      <div className="w-full max-w-md">
        <div className="mb-9 flex flex-col items-center">
          <Logo className="mb-5 h-40 text-zinc-900" />
          <h1 className="font-serif text-4xl font-semibold tracking-wide text-zinc-900">Fê Ponto Joias</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-stone-200 bg-white p-8 shadow-sm">
          <Campo
            label="E-mail"
            tamanho="lg"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Campo
            label="Senha"
            tamanho="lg"
            type="password"
            autoComplete="current-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
          />
          {erro && <p className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-600">{erro}</p>}
          <Botao type="submit" tamanho="lg" className="mt-1 w-full" disabled={enviando}>
            {enviando ? 'Entrando…' : 'Entrar'}
          </Botao>
        </form>
      </div>
    </div>
  )
}
