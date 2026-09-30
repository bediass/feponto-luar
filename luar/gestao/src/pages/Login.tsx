import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Botao, Campo } from '@/components/ui'
import { Logo } from '@/components/Logo'

export default function Login() {
  const { session, entrar } = useAuth()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  // fluxo "esqueci minha senha"
  const [modoReset, setModoReset] = useState(false)
  const [resetEnviado, setResetEnviado] = useState(false)
  const [resetErro, setResetErro] = useState<string | null>(null)

  if (session) return <Navigate to="/" replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    setEnviando(true)
    const { error } = await entrar(email, senha)
    setEnviando(false)
    if (error) setErro(error)
  }

  async function enviarReset(e: FormEvent) {
    e.preventDefault()
    setResetErro(null)
    if (!email.trim()) { setResetErro('Informe o seu e-mail.'); return }
    setEnviando(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    })
    setEnviando(false)
    if (error) { setResetErro(error.message); return }
    setResetEnviado(true)
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-gradient-to-b from-white to-marca-100 p-4">
      <div className="w-full max-w-md">
        <div className="mb-9 flex flex-col items-center">
          <Logo variante="ouro" className="mb-4 h-16" />
          <p className="text-xs uppercase tracking-[0.3em] text-marca-500">Sistema de gestão</p>
        </div>

        {modoReset ? (
          <div className="space-y-5 rounded-2xl border border-marca-200 bg-white p-8 shadow-sm">
            {resetEnviado ? (
              <div className="text-center">
                <p className="font-medium text-marca-800">Link enviado!</p>
                <p className="mt-1 text-sm text-marca-500">
                  Se existir uma conta com esse e-mail, você vai receber um link para definir uma nova senha. Confira também o spam.
                </p>
                <button onClick={() => { setModoReset(false); setResetEnviado(false) }} className="mt-4 text-sm font-medium text-marca-700 hover:text-marca-900">
                  Voltar ao login
                </button>
              </div>
            ) : (
              <form onSubmit={enviarReset} className="space-y-5">
                <p className="text-sm text-marca-500">Informe o e-mail da sua conta que enviamos um link para redefinir a senha.</p>
                <Campo label="E-mail" tamanho="lg" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                {resetErro && <p className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-600">{resetErro}</p>}
                <Botao type="submit" tamanho="lg" className="w-full" disabled={enviando}>
                  {enviando ? 'Enviando...' : 'Enviar link'}
                </Botao>
                <button type="button" onClick={() => setModoReset(false)} className="w-full text-center text-sm font-medium text-marca-500 hover:text-marca-800">
                  Voltar ao login
                </button>
              </form>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-marca-200 bg-white p-8 shadow-sm">
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
              {enviando ? 'Entrando...' : 'Entrar'}
            </Botao>
            <button
              type="button"
              onClick={() => { setErro(null); setModoReset(true) }}
              className="w-full text-center text-sm font-medium text-marca-500 hover:text-marca-800"
            >
              Esqueci minha senha
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
