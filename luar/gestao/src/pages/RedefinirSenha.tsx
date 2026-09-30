import { useState, useEffect, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Botao, Campo } from '@/components/ui'
import { Logo } from '@/components/Logo'

function traduz(msg: string): string {
  if (/different from the old|should be different/i.test(msg)) return 'A nova senha precisa ser diferente da anterior.'
  if (/weak|pwned|compromised|easy to guess|known/i.test(msg)) return 'Essa senha é fácil de adivinhar ou apareceu em vazamentos. Escolha outra.'
  if (/at least|should be longer|minimum/i.test(msg)) return 'Senha muito curta. Use pelo menos 8 caracteres.'
  if (/session|not authenticated|Auth session missing/i.test(msg)) return 'O link expirou. Peça um novo em "Esqueci minha senha".'
  return msg
}

export default function RedefinirSenha() {
  const { session, loading } = useAuth()
  const navigate = useNavigate()
  const [senha, setSenha] = useState('')
  const [confirma, setConfirma] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [erroLink, setErroLink] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    // Supabase joga erros do link (expirado/inválido) no hash da URL.
    const hash = window.location.hash
    if (hash.includes('error')) {
      const p = new URLSearchParams(hash.replace(/^#/, ''))
      setErroLink(p.get('error_description') || 'O link expirou ou é inválido. Peça um novo.')
    }
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    if (senha.length < 8) { setErro('Use pelo menos 8 caracteres.'); return }
    if (senha !== confirma) { setErro('As senhas não conferem.'); return }
    setEnviando(true)
    const { error } = await supabase.auth.updateUser({ password: senha })
    setEnviando(false)
    if (error) { setErro(traduz(error.message)); return }
    setOk(true)
    setTimeout(() => navigate('/', { replace: true }), 1600)
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-gradient-to-b from-white to-marca-100 p-4">
      <div className="w-full max-w-md">
        <div className="mb-9 flex flex-col items-center">
          <Logo variante="ouro" className="mb-4 h-16" />
          <p className="text-xs uppercase tracking-[0.3em] text-marca-500">Definir senha</p>
        </div>

        <div className="rounded-2xl border border-marca-200 bg-white p-8 shadow-sm">
          {ok ? (
            <div className="text-center">
              <p className="font-medium text-marca-800">Senha definida!</p>
              <p className="mt-1 text-sm text-marca-500">Já pode usar o sistema. Redirecionando...</p>
            </div>
          ) : erroLink ? (
            <div className="text-center">
              <p className="font-medium text-marca-800">Link inválido ou expirado</p>
              <p className="mt-1 text-sm text-marca-500">{erroLink}</p>
              <Link to="/login" className="mt-4 inline-block text-sm font-medium text-marca-700 hover:text-marca-900">Voltar ao login</Link>
            </div>
          ) : loading ? (
            <p className="text-center text-sm text-marca-500">Verificando o link...</p>
          ) : session ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              <p className="text-sm text-marca-500">Escolha uma senha forte — de preferência única, que você não usa em outro lugar.</p>
              <Campo label="Nova senha" tamanho="lg" type="password" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
              <Campo label="Confirmar nova senha" tamanho="lg" type="password" autoComplete="new-password" value={confirma} onChange={(e) => setConfirma(e.target.value)} required />
              {erro && <p className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-600">{erro}</p>}
              <Botao type="submit" tamanho="lg" className="w-full" disabled={enviando}>
                {enviando ? 'Salvando...' : 'Salvar nova senha'}
              </Botao>
            </form>
          ) : (
            <div className="text-center">
              <p className="font-medium text-marca-800">Abra pelo link do e-mail</p>
              <p className="mt-1 text-sm text-marca-500">
                Esta página abre a partir do link que enviamos no seu e-mail. Se não recebeu, peça um novo em "Esqueci minha senha".
              </p>
              <Link to="/login" className="mt-4 inline-block text-sm font-medium text-marca-700 hover:text-marca-900">Ir para o login</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
