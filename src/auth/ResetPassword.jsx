import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useNavigate } from 'react-router-dom'
import { Lock, Check, AlertCircle } from 'lucide-react'

function ResetPassword() {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [validToken, setValidToken] = useState(false)
  const [checkingToken, setCheckingToken] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const verifyToken = async () => {
      try {
        // Capturar o token da URL
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        const accessToken = hashParams.get('access_token')
        const type = hashParams.get('type')

        console.log('Token:', accessToken)
        console.log('Type:', type)

        if (!accessToken || type !== 'recovery') {
          setError('Link inválido ou expirado. Solicite um novo link de recuperação.')
          setValidToken(false)
          setCheckingToken(false)
          return
        }

        // Verificar se o token é válido
        const { data, error } = await supabase.auth.getUser(accessToken)

        if (error || !data.user) {
          setError('Link inválido ou expirado. Solicite um novo link de recuperação.')
          setValidToken(false)
        } else {
          setValidToken(true)
          // Token válido, não fazer nada ainda - só permitir trocar senha
        }
      } catch (error) {
        console.error('Erro ao verificar token:', error)
        setError('Erro ao verificar link. Tente novamente.')
        setValidToken(false)
      } finally {
        setCheckingToken(false)
      }
    }

    verifyToken()
  }, [])

  const handleResetPassword = async (e) => {
    e.preventDefault()
    setError('')

    // Validações
    if (newPassword.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem')
      return
    }

    setLoading(true)

    try {
      // Atualizar senha
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (updateError) throw updateError

      setSuccess(true)

      // Fazer logout para garantir que precisa fazer login com a nova senha
      await supabase.auth.signOut()

      // Redirecionar para login após 3 segundos
      setTimeout(() => {
        navigate('/login')
      }, 3000)

    } catch (error) {
      console.error('Erro ao atualizar senha:', error)
      setError(error.message || 'Erro ao atualizar senha')
    } finally {
      setLoading(false)
    }
  }

  // Verificando token
  if (checkingToken) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-purple-700 to-purple-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Verificando link...</p>
        </div>
      </div>
    )
  }

  // Token inválido
  if (!validToken) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-600 via-red-700 to-red-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="bg-red-100 w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center">
            <AlertCircle size={40} className="text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Link Inválido</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => navigate('/login')}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg transition-colors"
          >
            Voltar para o Login
          </button>
        </div>
      </div>
    )
  }

  // Sucesso
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-600 via-green-700 to-green-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="bg-green-100 w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center">
            <Check size={40} className="text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Senha Atualizada!</h1>
          <p className="text-gray-600 mb-4">Sua senha foi alterada com sucesso.</p>
          <p className="text-sm text-gray-500">Redirecionando para o login...</p>
        </div>
      </div>
    )
  }

  // Formulário de reset
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-purple-700 to-purple-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-600 to-purple-800 p-8 text-center">
            <div className="bg-white w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center">
              <Lock size={40} className="text-purple-600" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Redefinir Senha</h1>
            <p className="text-purple-200">Digite sua nova senha</p>
          </div>

          {/* Form */}
          <div className="p-8">
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700">
                <AlertCircle size={20} />
                <span className="text-sm font-medium">{error}</span>
              </div>
            )}

            <form onSubmit={handleResetPassword} className="space-y-6">
              {/* Nova Senha */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Nova Senha
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <Lock size={20} />
                  </div>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full pl-11 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all"
                    disabled={loading}
                    required
                  />
                </div>
              </div>

              {/* Confirmar Senha */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Confirmar Senha
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <Lock size={20} />
                  </div>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Digite a senha novamente"
                    className="w-full pl-11 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all"
                    disabled={loading}
                    required
                  />
                </div>
              </div>

              {/* Botão */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900 text-white font-bold py-4 rounded-lg shadow-lg transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Atualizando...
                  </span>
                ) : (
                  'ATUALIZAR SENHA'
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6 text-white text-sm">
          <button
            onClick={() => navigate('/login')}
            className="hover:underline"
          >
            ← Voltar para o login
          </button>
        </div>
      </div>
    </div>
  )
}

export default ResetPassword