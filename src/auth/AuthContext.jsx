import React, { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

const AuthContext = createContext({})

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Verificar se há usuário salvo no localStorage
    const savedUser = localStorage.getItem('user')
    if (savedUser) {
      setUser(JSON.parse(savedUser))
    }
    setLoading(false)
  }, [])

  const login = async (email, senha) => {
    try {
      // Buscar usuário no banco
      const { data, error } = await supabase
        .from('usuarios')
        .select('*, funcionarios(id, nome, categoria_id)')
        .eq('email', email)
        .eq('senha_hash', senha)
        .eq('ativo', true)
        .single()

      if (error || !data) {
        throw new Error('Email ou senha incorretos')
      }

      const userData = {
        id: data.id,
        email: data.email,
        tipo: data.tipo,
        funcionarioId: data.funcionario_id,
        funcionarioNome: data.funcionarios?.nome || 'Admin',
        categoriaId: data.funcionarios?.categoria_id || null
      }

      setUser(userData)
      localStorage.setItem('user', JSON.stringify(userData))
      
      return { success: true, user: userData }
    } catch (error) {
      console.error('Erro no login:', error)
      return { success: false, error: error.message }
    }
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('user')
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