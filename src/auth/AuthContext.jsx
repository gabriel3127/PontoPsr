import React, { createContext, useContext, useState, useEffect, useRef } from 'react'
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
  const isLoadingUser = useRef(false) // ← Evitar múltiplas chamadas simultâneas

  useEffect(() => {
    let mounted = true

    const initialize = async () => {
      console.log('🚀 Inicializando AuthContext...')
      
      // Verificar sessão inicial
      await checkUser()

      // Escutar mudanças de autenticação
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (!mounted) return

        console.log('🔔 Auth event:', event)
        
        // PASSWORD_RECOVERY - não fazer nada
        if (event === 'PASSWORD_RECOVERY') {
          setLoading(false)
          return
        }
        
        // SIGNED_OUT - limpar usuário
        if (event === 'SIGNED_OUT') {
          setUser(null)
          setLoading(false)
          return
        }
        
        // SIGNED_IN - carregar dados
        if (event === 'SIGNED_IN' && session?.user) {
          if (window.location.pathname !== '/reset-password' && !isLoadingUser.current) {
            await loadUserData(session.user)
          }
          return
        }
        
        // TOKEN_REFRESHED - ignorar
        if (event === 'TOKEN_REFRESHED') {
          return
        }
        
        // INITIAL_SESSION - ignorar (checkUser já tratou)
        if (event === 'INITIAL_SESSION') {
          setLoading(false)
          return
        }
      })

      return () => {
        mounted = false
        subscription.unsubscribe()
      }
    }

    initialize()
  }, []) // ← SEM dependências - roda só 1 vez!

  const checkUser = async () => {
    if (isLoadingUser.current) {
      console.log('⏳ Já está carregando usuário, pulando...')
      return
    }

    try {
      console.log('🔍 Verificando sessão...')
      const { data: { session }, error } = await supabase.auth.getSession()
      
      if (error) {
        console.error('❌ Erro ao verificar sessão:', error)
        setLoading(false)
        return
      }
      
      // Se estiver na página de reset, não carregar dados
      if (window.location.pathname === '/reset-password') {
        console.log('🔐 Página de reset - não carregar dados')
        setLoading(false)
        return
      }
      
      if (session?.user) {
        console.log('✅ Sessão ativa encontrada')
        await loadUserData(session.user)
      } else {
        console.log('❌ Nenhuma sessão ativa')
        setUser(null)
      }
    } catch (error) {
      console.error('❌ Erro ao verificar usuário:', error)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  const loadUserData = async (authUser) => {
    if (isLoadingUser.current) {
      console.log('⏳ Já está carregando dados, pulando...')
      return
    }

    isLoadingUser.current = true

    try {
      console.log('📥 Carregando dados do funcionário...', authUser.id)
      
      // Buscar dados do funcionário
      const { data: funcionario, error } = await supabase
        .from('funcionarios')
        .select('id, nome, email, tipo_usuario, categoria_id')
        .eq('auth_id', authUser.id)
        .single()

      console.log('📦 Resposta:', { funcionario, error })

      if (error) {
        console.error('❌ Erro ao carregar funcionário:', error)
        throw error
      }

      if (!funcionario) {
        console.error('❌ Funcionário não encontrado')
        throw new Error('Funcionário não encontrado')
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

      console.log('✅ Dados carregados:', userData.nome, '-', userData.tipo)
      setUser(userData)
      
    } catch (error) {
      console.error('❌ Erro ao carregar dados do usuário:', error)
      setUser(null)
    } finally {
      isLoadingUser.current = false
    }
  }

  const login = async (email, senha) => {
    try {
      console.log('🔐 Tentando login...', email)
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: senha
      })

      if (error) throw error

      console.log('✅ Autenticação bem-sucedida')
      
      // Aguardar carregar dados do usuário
      await loadUserData(data.user)
      
      // Aguardar um pouco para garantir que user foi atualizado
      await new Promise(resolve => setTimeout(resolve, 500))
      
      console.log('📍 Redirecionando...')
      
      // Redirecionar baseado no tipo
      const userData = await supabase
        .from('funcionarios')
        .select('tipo_usuario')
        .eq('auth_id', data.user.id)
        .single()
      
      if (userData.data?.tipo_usuario === 'admin') {
        navigate('/admin')
      } else {
        navigate('/dashboard')
      }

      return { success: true }
    } catch (error) {
      console.error('❌ Erro no login:', error)
      
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
      console.log('👋 Fazendo logout...')
      
      await supabase.auth.signOut()
      setUser(null)
      
      console.log('✅ Logout concluído')
      navigate('/login')
    } catch (error) {
      console.error('❌ Erro no logout:', error)
      setUser(null)
      navigate('/login')
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