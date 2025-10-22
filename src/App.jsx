import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthContext'
import Login from './auth/Login'
import AdminDashboard from './auth/AdminDashboard'
import EmployeeDashboard from './auth/EmployeeDashboard'
import ResetPassword from './auth/ResetPassword'

function ProtectedRoute({ children }) {
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

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return children
}

function DashboardRouter() {
  const { user } = useAuth()

  if (user?.tipo === 'admin') {
    return <AdminDashboard />
  }

  if (user?.tipo === 'funcionario') {
    return <EmployeeDashboard />
  }

  return <Navigate to="/login" replace />
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Rota pública de login */}
          <Route path="/login" element={<Login />} />
          
          {/* Rota pública de reset de senha */}
          <Route path="/reset-password" element={<ResetPassword />} />
          
          {/* Rota protegida do dashboard */}
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <DashboardRouter />
              </ProtectedRoute>
            } 
          />
          
          {/* Rota raiz redireciona para dashboard */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          
          {/* Rota 404 */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App