import React from 'react'
import { AuthProvider, useAuth } from './auth/AuthContext'
import Login from './auth/Login'
import AdminDashboard from './auth/AdminDashboard'
import EmployeeDashboard from './auth/EmployeeDashboard'

function AppContent() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="w-full min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Carregando...</p>
        </div>
      </div>
    )
  }

  // Se não estiver logado, mostra tela de login
  if (!user) {
    return <Login />
  }

  // Se for admin, mostra dashboard completo
  if (user.tipo === 'admin') {
    return <AdminDashboard />
  }

  // Se for funcionário, mostra dashboard limitado
  if (user.tipo === 'funcionario') {
    return <EmployeeDashboard />
  }

  // Fallback
  return <Login />
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App