import React, { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useNavigate } from 'react-router-dom'

const AuthContext = createContext({})

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth event:', event, 'Session:', session ? 'exists' : 'null')
      
      // PASSWORD_RECOVERY: sessão existe mas não carregar dados do usuário
      if (event === 'PASSWORD_RECOVERY') {
        console.log('✅ Password recovery - mantendo na página de reset')
        setLoading(false)
        return
      }
      
      // SIGNED_OUT: limpar usuário
      if (event === 'SIGNED_OUT') {
        setUser(null)
        setLoading(false)
        return
      }
      
      // SIGNED_IN ou INITIAL_SESSION com usuário
      if (session?.user) {
        // Só carregar dados se NÃO estiver na página de reset
        if (window.location.pathname !== '/reset-password') {
          await loadUserData(session.user)
        }
      } else {
        setUser(null)
      }
      
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const checkUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      console.log('CheckUser - pathname:', window.location.pathname, 'session:', session ? 'exists' : 'null')
      
      // Se estiver na página de reset, não carregar dados
      if (window.location.pathname === '/reset-password') {
        setLoading(false)
        return
      }
      
      if (session?.user) {
        await loadUserData(session.user)
      }
    } catch (error) {
      console.error('Erro ao verificar usuário:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadUserData = async (authUser) => {
    try {
      // Buscar dados do funcionário vinculado
      const { data: funcionario, error } = await supabase
        .from('funcionarios')
        .select('id, nome, email, tipo_usuario, categoria_id')
        .eq('auth_id', authUser.id)
        .single()

      if (error) {
        console.error('Erro ao carregar funcionário:', error)
        throw error
      }

      const userData = {
        authId: authUser.id,
        id: funcionario.id,
        funcionarioId: funcionario.id,
        funcionarioNome: funcionario.nome,
        nome: funcionario.nome,
        email: funcionario.email,
        tipo: funcionario.tipo_usuario,
        categoriaId: funcionario.categoria_id
      }

      setUser(userData)
    } catch (error) {
      console.error('Erro ao carregar dados do usuário:', error)
      setUser(null)
    }
  }

  const login = async (email, senha) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: senha
      })

      if (error) throw error

      await loadUserData(data.user)
      
      // Redirecionar após login
      navigate('/dashboard')

      return { success: true, user: user }
    } catch (error) {
      console.error('Erro no login:', error)
      
      let errorMessage = 'Erro ao fazer login'
      if (error.message.includes('Invalid login credentials')) {
        errorMessage = 'Email ou senha incorretos'
      } else if (error.message.includes('Email not confirmed')) {
        errorMessage = 'Email não confirmado'
      }
      
      return { success: false, error: errorMessage }
    }
  }

  const logout = async () => {
    try {
      await supabase.auth.signOut()
      setUser(null)
      navigate('/login')
    } catch (error) {
      console.error('Erro no logout:', error)
    }
  }

  const isAdmin = () => {
    return user?.tipo === 'admin'
  }

  const isEmployee = () => {
    return user?.tipo === 'funcionario'
  }

  const value = {
    user,
    login,
    logout,
    isAdmin,
    isEmployee,
    loading
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}