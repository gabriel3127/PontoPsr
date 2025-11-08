import React, { useState, useEffect } from 'react'
import { useAuth } from './AuthContext'
import { LogOut, Clock, Coffee, Sunrise, Sunset, FileText, AlertCircle } from 'lucide-react'
import Notifications from '../components/Notifications'
import ConfirmationModal from '../components/ConfirmationModal'
import useNotifications from '../hooks/useNotifications'
import { 
  getRegistrosPonto,
  upsertRegistroPonto
} from '../lib/supabaseClient'
import { 
  minutesToTime, 
  calculateWorkedHours,
  getExpectedWorkHours,
  calculateDelay,
  calculateOvertime,
  hasShortLunch,
  generateMonthDays,
  months 
} from '../lib/utils'

function EmployeeDashboard() {
  const { user, logout } = useAuth()
  const { notifications, showNotification } = useNotifications()
  const [currentTime, setCurrentTime] = useState(new Date())
  const [records, setRecords] = useState({})
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(false)
  const [view, setView] = useState('home')
  
  // Estados para o modal de confirmação
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [pendingRecord, setPendingRecord] = useState(null)

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    loadTimeRecords()
  }, [selectedMonth, selectedYear])

  const loadTimeRecords = async () => {
    try {
      const recordsData = await getRegistrosPonto(user.funcionarioId, selectedYear, selectedMonth)
      const recordsMap = {}
      
      recordsData.forEach(record => {
        const dateParts = record.data.split('-')
        const year = parseInt(dateParts[0])
        const month = parseInt(dateParts[1]) - 1
        const day = parseInt(dateParts[2])
        
        const dateKey = `${year}-${month}-${day}`
        
        recordsMap[dateKey] = {
          entrada_manha: record.entrada_manha || '',
          saida_almoco: record.saida_almoco || '',
          retorno_almoco: record.retorno_almoco || '',
          saida_tarde: record.saida_tarde || '',
          tipo: record.tipo_dia || 'normal'
        }
      })
      
      setRecords(recordsMap)
    } catch (error) {
      console.error('Erro ao carregar registros:', error)
    }
  }

  const prepararRegistro = (tipo) => {
    const now = new Date()
    const dateKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    
    const currentRecord = records[dateKey] || {}
    
    let field = ''
    let label = ''
    
    switch(tipo) {
      case 'entrada':
        field = 'entrada_manha'
        label = 'Check-in'
        break
      case 'saida_almoco':
        field = 'saida_almoco'
        label = 'Saída para Almoço'
        break
      case 'retorno_almoco':
        field = 'retorno_almoco'
        label = 'Retorno do Almoço'
        break
      case 'saida':
        field = 'saida_tarde'
        label = 'Check-out'
        break
    }

    // Preparar dados para o modal
    const diasSemana = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']
    const confirmationData = {
      funcionarioNome: user.funcionarioNome,
      dataFormatada: now.toLocaleDateString('pt-BR'),
      diaSemana: diasSemana[now.getDay()],
      hora: timeStr,
      tipo: tipo,
      field: field,
      label: label,
      dateKey: dateKey,
      currentRecord: currentRecord
    }

    setPendingRecord(confirmationData)
    setShowConfirmation(true)
  }

  const confirmarRegistro = async () => {
    if (!pendingRecord) return
    
    setLoading(true)
    try {
      const newRecord = {
        ...pendingRecord.currentRecord,
        [pendingRecord.field]: pendingRecord.hora
      }

      const recordData = {
        funcionario_id: user.funcionarioId,
        data: new Date().toISOString().split('T')[0],
        entrada_manha: newRecord.entrada_manha || null,
        saida_almoco: newRecord.saida_almoco || null,
        retorno_almoco: newRecord.retorno_almoco || null,
        saida_tarde: newRecord.saida_tarde || null,
        tipo_dia: newRecord.tipo || 'normal'
      }

      await upsertRegistroPonto(recordData)
      
      setRecords(prev => ({
        ...prev,
        [pendingRecord.dateKey]: newRecord
      }))

      showNotification(`${pendingRecord.label} registrado: ${pendingRecord.hora}`, 'success')
      setShowConfirmation(false)
      setPendingRecord(null)
    } catch (error) {
      console.error('Erro ao registrar ponto:', error)
      showNotification('Erro ao registrar ponto: ' + error.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const cancelarRegistro = () => {
    setShowConfirmation(false)
    setPendingRecord(null)
  }

  // ============================================================================
  // FUNÇÃO: Verificar se um botão deve estar disponível
  // ============================================================================
  const isButtonAvailable = (tipo, todayRecord, isSaturday) => {
    switch(tipo) {
      case 'entrada':
        return !todayRecord.entrada_manha
      case 'saida_almoco':
        return !isSaturday && !todayRecord.saida_almoco
      case 'retorno_almoco':
        return !isSaturday && !todayRecord.retorno_almoco
      case 'saida':
        return !todayRecord.saida_tarde
      default:
        return false
    }
  }

  // ============================================================================
  // FUNÇÃO: Verificar se há horários faltando (para alerta)
  // ============================================================================
  const getMissingRecords = (todayRecord, isSaturday) => {
    const missing = []
    
    if (!todayRecord.entrada_manha) missing.push('Check-in')
    
    if (!isSaturday) {
      if (!todayRecord.saida_almoco) missing.push('Saída Almoço')
      if (!todayRecord.retorno_almoco) missing.push('Retorno Almoço')
    }
    
    if (!todayRecord.saida_tarde) missing.push('Check-out')
    
    return missing
  }

  const getTodayRecord = () => {
    const now = new Date()
    const dateKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`
    return records[dateKey] || {}
  }

  const todayRecord = getTodayRecord()
  const days = generateMonthDays(selectedYear, selectedMonth)
  const today = new Date()
  const isSaturday = today.getDay() === 6
  const isSunday = today.getDay() === 0
  
  // Verificar horários faltantes
  const missingRecords = getMissingRecords(todayRecord, isSaturday)
  const hasAllRecords = missingRecords.length === 0

  // ============================================================================
  // FORMATAÇÃO DE TEMPO PARA MOBILE
  // ============================================================================
  const formatFullTime = (date) => {
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const seconds = String(date.getSeconds()).padStart(2, '0')
    return `${hours}:${minutes}:${seconds}`
  }

  const formatFullDate = (date) => {
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    return `${day}/${month}/${year}`
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Notifications notifications={notifications} />
      
      {/* Modal de Confirmação */}
      <ConfirmationModal
        isOpen={showConfirmation}
        onClose={cancelarRegistro}
        onConfirm={confirmarRegistro}
        data={pendingRecord}
        loading={loading}
      />

      {/* ===== HEADER MOBILE-OPTIMIZED ===== */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-800 text-white shadow-lg">
        <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
          {/* Desktop Layout */}
          <div className="hidden sm:flex justify-between items-center flex-wrap gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold mb-1">Olá, {user.funcionarioNome}!</h1>
              <p className="text-purple-200 text-sm md:text-base">
                {currentTime.toLocaleDateString('pt-BR', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-center bg-white bg-opacity-20 px-4 py-2 rounded-lg">
                <div className="text-2xl md:text-3xl font-bold">{formatFullTime(currentTime)}</div>
                <div className="text-xs text-purple-200">{formatFullDate(currentTime)}</div>
              </div>
              <button
                onClick={logout}
                className="flex items-center gap-2 px-3 py-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg transition-all text-sm"
              >
                <LogOut size={18} />
                <span className="hidden md:inline">Sair</span>
              </button>
            </div>
          </div>

          {/* Mobile Layout */}
          <div className="sm:hidden space-y-3">
            <div className="flex justify-between items-center">
              <h1 className="text-xl font-bold">Olá, {user.funcionarioNome}!</h1>
              <button
                onClick={logout}
                className="flex items-center gap-1 px-3 py-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg transition-all text-sm"
              >
                <LogOut size={16} />
                Sair
              </button>
            </div>
            
            {/* Relógio Grande Mobile */}
            <div className="bg-white bg-opacity-20 rounded-xl p-4 text-center">
              <div className="text-4xl font-bold mb-1">{formatFullTime(currentTime)}</div>
              <div className="text-sm text-purple-200">{formatFullDate(currentTime)}</div>
              <div className="text-xs text-purple-300 mt-1">
                {currentTime.toLocaleDateString('pt-BR', { weekday: 'long' })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
        {view === 'home' && (
          <>
            {/* ===== CARD DE REGISTROS - MOBILE FIRST ===== */}
            <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-4 sm:mb-6">
              <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-3 sm:mb-4 flex items-center gap-2">
                <FileText size={20} className="text-purple-600" />
                Registros de Hoje
              </h3>
              
              {/* Alertas */}
              {!hasAllRecords && !isSunday && (
                <div className="mb-4 p-3 sm:p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded-lg">
                  <div className="flex items-start gap-2 sm:gap-3">
                    <AlertCircle className="text-yellow-600 flex-shrink-0 mt-0.5" size={18} />
                    <div>
                      <p className="font-semibold text-yellow-800 text-sm sm:text-base mb-1">
                        Horários pendentes
                      </p>
                      <p className="text-xs sm:text-sm text-yellow-700">
                        Faltam: {missingRecords.join(', ')}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {hasAllRecords && !isSunday && (
                <div className="mb-4 p-3 sm:p-4 bg-green-50 border-l-4 border-green-400 rounded-lg">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="text-xl sm:text-2xl">✅</div>
                    <div>
                      <p className="font-semibold text-green-800 text-sm sm:text-base">
                        Todos os horários registrados!
                      </p>
                      <p className="text-xs sm:text-sm text-green-700">
                        Seu ponto de hoje está completo.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Grid de Horários - Mobile Optimized */}
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <span className="text-xs sm:text-sm font-medium text-gray-700">Check-in</span>
                  <div className={`text-lg sm:text-xl font-bold mt-1 ${todayRecord.entrada_manha ? 'text-green-600' : 'text-gray-400'}`}>
                    {todayRecord.entrada_manha || '--:--'}
                  </div>
                </div>
                
                {!isSaturday && (
                  <>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <span className="text-xs sm:text-sm font-medium text-gray-700">Saída Almoço</span>
                      <div className={`text-lg sm:text-xl font-bold mt-1 ${todayRecord.saida_almoco ? 'text-orange-600' : 'text-gray-400'}`}>
                        {todayRecord.saida_almoco || '--:--'}
                      </div>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <span className="text-xs sm:text-sm font-medium text-gray-700">Retorno</span>
                      <div className={`text-lg sm:text-xl font-bold mt-1 ${todayRecord.retorno_almoco ? 'text-blue-600' : 'text-gray-400'}`}>
                        {todayRecord.retorno_almoco || '--:--'}
                      </div>
                    </div>
                  </>
                )}
                
                <div className="p-3 bg-gray-50 rounded-lg">
                  <span className="text-xs sm:text-sm font-medium text-gray-700">Check-out</span>
                  <div className={`text-lg sm:text-xl font-bold mt-1 ${todayRecord.saida_tarde ? 'text-purple-600' : 'text-gray-400'}`}>
                    {todayRecord.saida_tarde || '--:--'}
                  </div>
                </div>
              </div>
            </div>

            {/* ===== BOTÕES DE REGISTRO - MOBILE OPTIMIZED ===== */}
            {!isSunday && (
              <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-4 sm:mb-6">
                <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-2 text-center">
                  Registrar Ponto
                </h3>
                <p className="text-center text-gray-600 text-xs sm:text-sm mb-4 sm:mb-6">
                  📌 Registre em <strong>qualquer ordem</strong>
                </p>
                
                {/* Grid de Botões - Responsivo */}
                <div className={`grid ${isSaturday ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4'} gap-2 sm:gap-3`}>
                  {/* CHECK-IN */}
                  <button
                    onClick={() => prepararRegistro('entrada')}
                    disabled={loading || !isButtonAvailable('entrada', todayRecord, isSaturday)}
                    className={`
                      flex flex-col items-center gap-2 p-4 sm:p-5 rounded-xl shadow-lg transition-all transform 
                      ${isButtonAvailable('entrada', todayRecord, isSaturday)
                        ? 'bg-gradient-to-br from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 active:scale-95'
                        : 'bg-gray-300 cursor-not-allowed'
                      }
                      text-white disabled:opacity-50
                    `}
                  >
                    <Sunrise size={28} className="sm:w-10 sm:h-10" />
                    <span className="font-bold text-sm sm:text-base">CHECK-IN</span>
                    {todayRecord.entrada_manha && (
                      <span className="text-xs bg-white bg-opacity-30 px-2 py-1 rounded">
                        ✓ {todayRecord.entrada_manha}
                      </span>
                    )}
                  </button>

                  {/* ALMOÇO & RETORNO - Só em dias de semana */}
                  {!isSaturday && (
                    <>
                      <button
                        onClick={() => prepararRegistro('saida_almoco')}
                        disabled={loading || !isButtonAvailable('saida_almoco', todayRecord, isSaturday)}
                        className={`
                          flex flex-col items-center gap-2 p-4 sm:p-5 rounded-xl shadow-lg transition-all transform 
                          ${isButtonAvailable('saida_almoco', todayRecord, isSaturday)
                            ? 'bg-gradient-to-br from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 active:scale-95'
                            : 'bg-gray-300 cursor-not-allowed'
                          }
                          text-white disabled:opacity-50
                        `}
                      >
                        <Coffee size={28} className="sm:w-10 sm:h-10" />
                        <span className="font-bold text-sm sm:text-base">ALMOÇO</span>
                        {todayRecord.saida_almoco && (
                          <span className="text-xs bg-white bg-opacity-30 px-2 py-1 rounded">
                            ✓ {todayRecord.saida_almoco}
                          </span>
                        )}
                      </button>

                      <button
                        onClick={() => prepararRegistro('retorno_almoco')}
                        disabled={loading || !isButtonAvailable('retorno_almoco', todayRecord, isSaturday)}
                        className={`
                          flex flex-col items-center gap-2 p-4 sm:p-5 rounded-xl shadow-lg transition-all transform 
                          ${isButtonAvailable('retorno_almoco', todayRecord, isSaturday)
                            ? 'bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 active:scale-95'
                            : 'bg-gray-300 cursor-not-allowed'
                          }
                          text-white disabled:opacity-50
                        `}
                      >
                        <Coffee size={28} className="sm:w-10 sm:h-10" />
                        <span className="font-bold text-sm sm:text-base">RETORNO</span>
                        {todayRecord.retorno_almoco && (
                          <span className="text-xs bg-white bg-opacity-30 px-2 py-1 rounded">
                            ✓ {todayRecord.retorno_almoco}
                          </span>
                        )}
                      </button>
                    </>
                  )}

                  {/* CHECK-OUT */}
                  <button
                    onClick={() => prepararRegistro('saida')}
                    disabled={loading || !isButtonAvailable('saida', todayRecord, isSaturday)}
                    className={`
                      flex flex-col items-center gap-2 p-4 sm:p-5 rounded-xl shadow-lg transition-all transform 
                      ${isButtonAvailable('saida', todayRecord, isSaturday)
                        ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 active:scale-95'
                        : 'bg-gray-300 cursor-not-allowed'
                      }
                      text-white disabled:opacity-50
                    `}
                  >
                    <Sunset size={28} className="sm:w-10 sm:h-10" />
                    <span className="font-bold text-sm sm:text-base">CHECK-OUT</span>
                    {todayRecord.saida_tarde && (
                      <span className="text-xs bg-white bg-opacity-30 px-2 py-1 rounded">
                        ✓ {todayRecord.saida_tarde}
                      </span>
                    )}
                  </button>
                </div>

                {/* Instruções - Mobile Friendly */}
                <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-start gap-2">
                    <div className="text-blue-600 text-lg sm:text-xl">ℹ️</div>
                    <div className="text-xs sm:text-sm text-blue-800">
                      <p className="font-semibold mb-1">Como funciona:</p>
                      <ul className="list-disc list-inside space-y-1 text-blue-700">
                        <li>Registre seus horarios corretamente:</li>
                        <li><strong>Coloridos</strong> = disponíveis</li>
                        <li><strong>Cinzas</strong> = já registrados</li>
                        <li>Após confirmar, o horário não pode mais ser alterado</li>
                        <li>Se esquecer um horário, pode registrar os outros normalmente</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Botão Ver Registros - Mobile Friendly */}
            <div className="text-center">
              <button
                onClick={() => setView('registros')}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 sm:gap-3 px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900 text-white font-bold text-base sm:text-lg rounded-xl shadow-lg transition-all transform active:scale-95"
              >
                <FileText size={20} className="sm:w-6 sm:h-6" />
                VER MEUS REGISTROS
              </button>
            </div>
          </>
        )}

        {view === 'registros' && (
          <>
            {selectedMonth === new Date().getMonth() && selectedYear === new Date().getFullYear() && (
              <div className="mb-4 sm:mb-6">
                <button
                  onClick={() => setView('home')}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium rounded-lg transition-all text-sm sm:text-base"
                >
                  ← Voltar
                </button>
              </div>
            )}

            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="p-4 sm:p-6 bg-purple-600">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
                  <h3 className="text-xl sm:text-2xl font-bold text-white">Meus Registros</h3>
                  <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <select
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(Number(e.target.value))}
                      className="px-3 py-2 border border-purple-400 bg-white rounded-lg focus:ring-2 focus:ring-purple-300 outline-none text-sm sm:text-base"
                    >
                      {months.map((month, idx) => (
                        <option key={idx} value={idx}>{month}</option>
                      ))}
                    </select>
                    
                    <input
                      type="number"
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(Number(e.target.value))}
                      className="px-3 py-2 border border-purple-400 bg-white rounded-lg w-full sm:w-24 focus:ring-2 focus:ring-purple-300 outline-none text-sm sm:text-base"
                    />
                  </div>
                </div>
              </div>

              {/* Tabela Responsiva - Com Atrasos e Horas Extras */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-purple-100 text-purple-800">
                      <th className="border border-purple-200 p-2 sm:p-3">Data</th>
                      <th className="border border-purple-200 p-2 sm:p-3">Dia</th>
                      <th className="border border-purple-200 p-2 sm:p-3">Entrada</th>
                      <th className="border border-purple-200 p-2 sm:p-3">Saída</th>
                      <th className="border border-purple-200 p-2 sm:p-3 hidden sm:table-cell">Entrada</th>
                      <th className="border border-purple-200 p-2 sm:p-3 hidden sm:table-cell">Saída</th>
                      <th className="border border-purple-200 p-2 sm:p-3">H. Diária</th>
                      <th className="border border-purple-200 p-2 sm:p-3 text-red-700">Atrasos</th>
                      <th className="border border-purple-200 p-2 sm:p-3 text-green-700">H. Extras</th>
                    </tr>
                  </thead>
                  <tbody>
                    {days.map(day => {
                      const record = records[day.dateKey] || {}
                      const worked = calculateWorkedHours(record)
                      const expected = getExpectedWorkHours(day.isSaturday, day.isSunday, record.tipo)
                      const delay = calculateDelay(worked, expected)
                      const overtime = calculateOvertime(worked)
                      const totalOvertime = (overtime.faixa1 || 0) + (overtime.faixa2 || 0)
                      const shortLunch = hasShortLunch(record)
                      
                      return (
                        <tr 
                          key={day.dateKey}
                          className={`
                            ${shortLunch ? 'bg-yellow-50' : ''}
                            ${day.isSunday ? 'bg-gray-100' : ''}
                            ${!shortLunch && !day.isSunday ? 'hover:bg-purple-50' : ''}
                          `}
                        >
                          {/* Data */}
                          <td className="border border-gray-200 p-2 text-center font-medium text-xs sm:text-sm">
                            {String(day.day).padStart(2, '0')}/{String(selectedMonth + 1).padStart(2, '0')}
                          </td>
                          
                          {/* Dia da Semana */}
                          <td className="border border-gray-200 p-2 text-center text-xs sm:text-sm">
                            {day.weekDay}
                          </td>
                          
                          {/* Entrada Manhã */}
                          <td className="border border-gray-200 p-2 text-center font-medium text-xs sm:text-sm">
                            {record.entrada_manha || '--:--'}
                          </td>
                          
                          {/* Saída Almoço */}
                          <td className="border border-gray-200 p-2 text-center font-medium text-xs sm:text-sm">
                            {record.saida_almoco || '--:--'}
                          </td>
                          
                          {/* Retorno Almoço (hidden em mobile) */}
                          <td className="border border-gray-200 p-2 text-center font-medium text-xs sm:text-sm hidden sm:table-cell">
                            {record.retorno_almoco || '--:--'}
                          </td>
                          
                          {/* Saída Tarde (hidden em mobile) */}
                          <td className="border border-gray-200 p-2 text-center font-medium text-xs sm:text-sm hidden sm:table-cell">
                            {record.saida_tarde || '--:--'}
                          </td>
                          
                          {/* Horas Trabalhadas */}
                          <td className="border border-gray-200 p-2 text-center bg-gray-50 font-semibold text-xs sm:text-sm">
                            {minutesToTime(worked)}
                          </td>
                          
                          {/* Atrasos */}
                          <td className={`border border-gray-200 p-2 text-center font-semibold text-xs sm:text-sm ${
                            delay > 0 ? 'text-red-600 bg-red-50' : 'text-gray-400'
                          }`}>
                            {delay > 0 ? minutesToTime(delay) : '-'}
                          </td>
                          
                          {/* Horas Extras */}
                          <td className={`border border-gray-200 p-2 text-center font-semibold text-xs sm:text-sm ${
                            totalOvertime > 0 ? 'text-green-600 bg-green-50' : 'text-gray-400'
                          }`}>
                            {totalOvertime > 0 ? minutesToTime(totalOvertime) : '-'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  
                  {/* Totais do Mês (Rodapé) */}
                  {/*
                  <tfoot>
                    <tr className="bg-purple-600 text-white font-bold">
                      <td colSpan="2" className="border border-purple-700 p-2 sm:p-3 text-center text-xs sm:text-sm">
                        TOTAL DO MÊS
                      </td>
                      <td colSpan="4" className="border border-purple-700 p-2 sm:p-3 text-center hidden sm:table-cell">
                      </td>
                      <td className="border border-purple-700 p-2 sm:p-3 text-center text-xs sm:text-sm">
                        {minutesToTime(
                          days.reduce((total, day) => {
                            const record = records[day.dateKey] || {}
                            return total + calculateWorkedHours(record)
                          }, 0)
                        )}
                      </td>
                      <td className="border border-purple-700 p-2 sm:p-3 text-center text-xs sm:text-sm hidden md:table-cell">
                        {(() => {
                          const totalDelay = days.reduce((total, day) => {
                            const record = records[day.dateKey] || {}
                            const worked = calculateWorkedHours(record)
                            const expected = getExpectedWorkHours(day.isSaturday, day.isSunday, record.tipo)
                            return total + calculateDelay(worked, expected)
                          }, 0)
                          return totalDelay > 0 ? (
                            <span className="text-red-200">-{minutesToTime(totalDelay)}</span>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )
                        })()}
                      </td>
                      <td className="border border-purple-700 p-2 sm:p-3 text-center text-xs sm:text-sm hidden md:table-cell">
                        {(() => {
                          const totalOT = days.reduce((total, day) => {
                            const record = records[day.dateKey] || {}
                            const overtime = calculateOvertime(calculateWorkedHours(record))
                            return total + (overtime.faixa1 || 0) + (overtime.faixa2 || 0)
                          }, 0)
                          return totalOT > 0 ? (
                            <span className="text-green-200">+{minutesToTime(totalOT)}</span>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )
                        })()}
                      </td>
                    </tr>
                  </tfoot> */}
                </table>
                
                {/* Legenda Mobile - Mostra info que está escondida */}
                <div className="mt-4 p-3 bg-gray-50 rounded-lg md:hidden">
                  <p className="text-xs text-gray-600 font-medium mb-2">
                    💡 <strong>Dica:</strong> Gire o celular para ver mais detalhes ou acesse no computador para ver atrasos e horas extras.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default EmployeeDashboard