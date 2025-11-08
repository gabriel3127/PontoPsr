import React, { useState, useEffect, useRef } from 'react'
import { AlertTriangle, Wifi, WifiOff, RefreshCw, Activity } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../auth/AuthContext'

function SystemHealthMonitor() {
  const { user } = useAuth()
  const [status, setStatus] = useState({
    internet: true,
    session: true,
    api: true,
    lastCheck: new Date()
  })
  const [showAlert, setShowAlert] = useState(false)
  const [alertMessage, setAlertMessage] = useState('')
  const [isChecking, setIsChecking] = useState(false)
  const [checkCount, setCheckCount] = useState(0)
  const checkingTimeoutRef = useRef(null)

  // ============================================================================
  // EXPORTAR STATUS PARA OUTROS COMPONENTES
  // ============================================================================
  useEffect(() => {
    // Disponibilizar status globalmente
    window.systemHealthStatus = {
      isHealthy: !showAlert && status.internet && status.session && status.api,
      isChecking: isChecking,
      status: status
    }
  }, [showAlert, isChecking, status])

  // ============================================================================
  // TIMEOUT
  // ============================================================================
  const clearCheckingTimeout = () => {
    if (checkingTimeoutRef.current) {
      clearTimeout(checkingTimeoutRef.current)
      checkingTimeoutRef.current = null
    }
  }

  const startCheckingTimeout = () => {
    clearCheckingTimeout()
    
    checkingTimeoutRef.current = setTimeout(() => {
      console.error('[MONITOR] ⏰ TIMEOUT! +5 segundos')
      console.error('[MONITOR] 🚨 FORÇANDO ALERTA')
      
      setIsChecking(false)
      setStatus({
        internet: false,
        session: false,
        api: false,
        lastCheck: new Date()
      })
      setAlertMessage(
        '⚠️ TIMEOUT DETECTADO:\n\n' +
        '❌ Sistema demorou mais de 5 segundos\n' +
        '❌ Possível problema de conexão\n\n' +
        '💡 Clique em "Recarregar" para resolver'
      )
      setShowAlert(true)
    }, 5000)
  }

  // ============================================================================
  // VERIFICAÇÕES
  // ============================================================================
  const checkInternetConnection = async () => {
    console.log('[MONITOR] 🌐 Internet...')
    
    if (!navigator.onLine) {
      console.error('[MONITOR] ❌ Offline')
      return false
    }

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 3000)

      await fetch('https://www.google.com/favicon.ico', {
        method: 'HEAD',
        mode: 'no-cors',
        signal: controller.signal
      })

      clearTimeout(timeoutId)
      console.log('[MONITOR] ✅ Internet OK')
      return true
    } catch (error) {
      console.error('[MONITOR] ❌ Sem internet')
      return false
    }
  }

  const checkSupabaseSession = async () => {
    console.log('[MONITOR] 🔐 Sessão...')
    
    try {
      const promise = supabase.auth.getSession()
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 3000)
      )

      const { data: { session }, error } = await Promise.race([promise, timeoutPromise])
      
      if (error || !session) {
        console.error('[MONITOR] ❌ Sessão inválida')
        return false
      }

      const expiresAt = session.expires_at
      const now = Math.floor(Date.now() / 1000)

      if (now >= expiresAt) {
        console.error('[MONITOR] ❌ Token expirado')
        return false
      }

      console.log('[MONITOR] ✅ Sessão OK')
      return true
    } catch (error) {
      console.error('[MONITOR] ❌ Erro sessão')
      return false
    }
  }

  const checkAPIResponse = async () => {
    console.log('[MONITOR] 🔌 API...')
    
    try {
      const apiPromise = supabase.from('funcionarios').select('id').limit(1)
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 3000)
      )

      const { error } = await Promise.race([apiPromise, timeoutPromise])

      if (error) {
        console.error('[MONITOR] ❌ API erro')
        return false
      }

      console.log('[MONITOR] ✅ API OK')
      return true
    } catch (error) {
      console.error('[MONITOR] ❌ API timeout')
      return false
    }
  }

  const performHealthCheck = async (reason = 'manual') => {
    console.log(`\n====== CHECK #${checkCount + 1} (${reason}) ======`)
    
    setIsChecking(true)
    setCheckCount(prev => prev + 1)
    startCheckingTimeout()

    try {
      const internetOK = await checkInternetConnection()
      let sessionOK = false
      let apiOK = false

      if (internetOK) {
        sessionOK = await checkSupabaseSession()
        if (sessionOK) {
          apiOK = await checkAPIResponse()
        }
      }

      clearCheckingTimeout()

      const newStatus = {
        internet: internetOK,
        session: sessionOK,
        api: apiOK,
        lastCheck: new Date()
      }

      setStatus(newStatus)

      const hasProblems = !internetOK || !sessionOK || !apiOK
      
      console.log(`Internet: ${internetOK ? '✅' : '❌'}`)
      console.log(`Sessão:   ${sessionOK ? '✅' : '❌'}`)
      console.log(`API:      ${apiOK ? '✅' : '❌'}`)
      console.log(`Status:   ${hasProblems ? '🚨' : '✅'}`)
      console.log('====================================\n')
      
      if (hasProblems) {
        let message = '⚠️ PROBLEMAS DETECTADOS:\n\n'
        
        if (!internetOK) message += '❌ Sem conexão com a internet\n'
        if (!sessionOK) message += '❌ Sua sessão expirou\n'
        if (!apiOK) message += '❌ Servidor não responde\n'
        
        message += '\n💡 Aguarde a conexão voltar ou clique em "Recarregar"'
        
        setAlertMessage(message)
        setShowAlert(true)
        console.error('[MONITOR] 🚨 ALERTA!')
      } else {
        setShowAlert(false)
      }

      setIsChecking(false)
      return !hasProblems
    } catch (error) {
      clearCheckingTimeout()
      console.error('[MONITOR] ❌ ERRO:', error)
      
      setIsChecking(false)
      setStatus({
        internet: false,
        session: false,
        api: false,
        lastCheck: new Date()
      })
      setAlertMessage(
        '⚠️ ERRO NA VERIFICAÇÃO:\n\n' +
        '❌ Ocorreu um erro ao verificar o sistema\n\n' +
        '💡 Clique em "Recarregar"'
      )
      setShowAlert(true)
      return false
    }
  }

  // ============================================================================
  // LISTENERS
  // ============================================================================
  useEffect(() => {
    console.log('[MONITOR] 🚀 Inicializando...')
    performHealthCheck('inicialização')

    const handleFocus = () => {
      console.log('[MONITOR] 👀 FOCO!')
      performHealthCheck('focus')
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        console.log('[MONITOR] 👁️ VISÍVEL!')
        performHealthCheck('visible')
      }
    }

    const handleOnline = () => {
      console.log('[MONITOR] 🌐 INTERNET VOLTOU!')
      performHealthCheck('online')
    }

    const handleOffline = () => {
      console.log('[MONITOR] 📡 INTERNET CAIU!')
      clearCheckingTimeout()
      setIsChecking(false)
      setStatus(prev => ({ ...prev, internet: false }))
      setAlertMessage('❌ Sem internet\n\n💡 Aguarde reconectar ou recarregue')
      setShowAlert(true)
    }

    window.addEventListener('focus', handleFocus, { capture: true })
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    document.addEventListener('visibilitychange', handleVisibility)

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible' && user) {
        console.log('[MONITOR] ⏰ Check periódico')
        performHealthCheck('periódico')
      }
    }, 30000)

    return () => {
      clearCheckingTimeout()
      window.removeEventListener('focus', handleFocus, { capture: true })
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      document.removeEventListener('visibilitychange', handleVisibility)
      clearInterval(interval)
    }
  }, [user])

  const handleReload = () => {
    console.log('[MONITOR] 🔄 Recarregando...')
    clearCheckingTimeout()
    window.location.reload()
  }

  const handleRetry = () => {
    console.log('[MONITOR] 🔁 Retry...')
    setShowAlert(false)
    performHealthCheck('retry')
  }

  // ============================================================================
  // RENDER: Indicador (quando NÃO tem alerta)
  // ============================================================================
  if (!showAlert) {
    return (
      <div className="fixed bottom-4 right-4" style={{ zIndex: 9998 }}>
        <div className={`px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-sm font-medium transition-all ${
          isChecking ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'
        } text-white`}>
          {isChecking ? (
            <>
              <Activity size={16} className="animate-spin" />
              <span>Verificando...</span>
            </>
          ) : (
            <>
              <Wifi size={16} />
              <span>OK</span>
            </>
          )}
          <span className="text-xs opacity-75">#{checkCount}</span>
        </div>
      </div>
    )
  }

  // ============================================================================
  // RENDER: Alerta (POR CIMA DE TUDO!)
  // ============================================================================
  return (
    <>
      {/* Overlay com z-index ALTÍSSIMO */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center p-4"
        style={{ zIndex: 99999 }}
      >
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-scaleIn">
          <div className="flex justify-center mb-4">
            <div className="bg-red-100 rounded-full p-4 animate-pulse">
              <AlertTriangle size={56} className="text-red-600" />
            </div>
          </div>

          <h2 className="text-3xl font-bold text-center text-red-600 mb-2">
            ⚠️ SEM CONEXÃO!
          </h2>
          
          <h3 className="text-xl font-semibold text-center text-gray-800 mb-4">
            Sistema Não Responde
          </h3>

          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded">
            <pre className="text-sm text-gray-800 whitespace-pre-wrap font-sans leading-relaxed">
              {alertMessage}
            </pre>
          </div>

          <div className="space-y-2 mb-6 bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center justify-between p-2">
              <span className="text-sm font-semibold">Internet:</span>
              <span className={`flex items-center gap-1 font-bold ${status.internet ? 'text-green-600' : 'text-red-600'}`}>
                {status.internet ? <Wifi size={18} /> : <WifiOff size={18} />}
                {status.internet ? 'OK' : 'OFF'}
              </span>
            </div>

            <div className="flex items-center justify-between p-2">
              <span className="text-sm font-semibold">Sessão:</span>
              <span className={`font-bold ${status.session ? 'text-green-600' : 'text-red-600'}`}>
                {status.session ? '✓ OK' : '✗ INVÁLIDA'}
              </span>
            </div>

            <div className="flex items-center justify-between p-2">
              <span className="text-sm font-semibold">Servidor:</span>
              <span className={`font-bold ${status.api ? 'text-green-600' : 'text-red-600'}`}>
                {status.api ? '✓ OK' : '✗ OFF'}
              </span>
            </div>

            <div className="flex items-center justify-between p-2 border-t pt-2">
              <span className="text-sm font-semibold">Verificações:</span>
              <span className="text-sm text-gray-600 font-mono">#{checkCount}</span>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={handleReload}
              className="w-full flex items-center justify-center gap-2 px-4 py-4 bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 text-white font-bold rounded-lg shadow-lg transition-all text-lg"
            >
              <RefreshCw size={24} />
              RECARREGAR PÁGINA
            </button>

            <button
              onClick={handleRetry}
              className="w-full px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-lg transition-all"
            >
              Verificar Novamente
            </button>
          </div>

          <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-xs text-blue-800 text-center">
              ℹ️ <strong>Aguarde a conexão voltar</strong> ou recarregue a página
            </p>
          </div>

          <p className="text-xs text-center text-gray-500 mt-3">
            🤖 Check #{checkCount} • {status.lastCheck.toLocaleTimeString('pt-BR')}
          </p>
        </div>
      </div>

      <style jsx>{`
        @keyframes scaleIn {
          from { transform: scale(0.9); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .animate-scaleIn {
          animation: scaleIn 0.3s ease-out;
        }
      `}</style>
    </>
  )
}

export default SystemHealthMonitor