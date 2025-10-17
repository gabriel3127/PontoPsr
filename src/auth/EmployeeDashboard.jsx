import React, { useState, useEffect } from 'react'
import { useAuth } from './AuthContext'
import { LogOut, Clock, Coffee, Sunrise, Sunset, FileText } from 'lucide-react'
import Notifications from '../components/Notifications'
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
        const date = new Date(record.data + 'T00:00:00')
        const day = date.getDate()
        const month = date.getMonth()
        const year = date.getFullYear()
        
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

  const registrarPonto = async (tipo) => {
    setLoading(true)
    try {
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

      const newRecord = {
        ...currentRecord,
        [field]: timeStr
      }

      const recordData = {
        funcionario_id: user.funcionarioId,
        data: now.toISOString().split('T')[0],
        entrada_manha: newRecord.entrada_manha || null,
        saida_almoco: newRecord.saida_almoco || null,
        retorno_almoco: newRecord.retorno_almoco || null,
        saida_tarde: newRecord.saida_tarde || null,
        tipo_dia: newRecord.tipo || 'normal'
      }

      await upsertRegistroPonto(recordData)
      
      setRecords(prev => ({
        ...prev,
        [dateKey]: newRecord
      }))

      showNotification(`${label} registrado: ${timeStr}`, 'success')
    } catch (error) {
      console.error('Erro ao registrar ponto:', error)
      showNotification('Erro ao registrar ponto: ' + error.message, 'error')
    } finally {
      setLoading(false)
    }
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

  return (
    <div className="min-h-screen bg-gray-100">
      <Notifications notifications={notifications} />
      
      <div className="bg-gradient-to-r from-purple-600 to-purple-800 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-white">Olá, {user.funcionarioNome}!</h1>
              <p className="text-purple-200 mt-1">Sistema de Controle de Ponto</p>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-all"
            >
              <LogOut size={20} />
              Sair
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {view === 'home' && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <div className="bg-white rounded-lg shadow-md p-8 text-center">
                <Clock size={48} className="mx-auto text-purple-600 mb-4" />
                <div className="text-6xl font-bold text-gray-800 mb-2">
                  {currentTime.toLocaleTimeString('pt-BR')}
                </div>
                <div className="text-xl text-gray-600">
                  {currentTime.toLocaleDateString('pt-BR', { 
                    weekday: 'long', 
                    day: 'numeric', 
                    month: 'long', 
                    year: 'numeric' 
                  })}
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-md p-8">
                <h3 className="text-xl font-bold text-gray-800 mb-4">Registros de Hoje</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="font-medium text-gray-700">Check-in:</span>
                    <span className="text-xl font-bold text-purple-600">
                      {todayRecord.entrada_manha || '--:--'}
                    </span>
                  </div>
                  {!isSaturday && !isSunday && (
                    <>
                      <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <span className="font-medium text-gray-700">Saída Almoço:</span>
                        <span className="text-xl font-bold text-purple-600">
                          {todayRecord.saida_almoco || '--:--'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <span className="font-medium text-gray-700">Retorno Almoço:</span>
                        <span className="text-xl font-bold text-purple-600">
                          {todayRecord.retorno_almoco || '--:--'}
                        </span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="font-medium text-gray-700">Check-out:</span>
                    <span className="text-xl font-bold text-purple-600">
                      {todayRecord.saida_tarde || '--:--'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {!isSunday && (
              <div className="bg-white rounded-lg shadow-md p-8 mb-8">
                <h3 className="text-2xl font-bold text-gray-800 mb-6 text-center">Registrar Ponto</h3>
                <div className={`grid ${isSaturday ? 'grid-cols-2' : 'grid-cols-2 lg:grid-cols-4'} gap-4`}>
                  <button
                    onClick={() => registrarPonto('entrada')}
                    disabled={loading || todayRecord.entrada_manha}
                    className="flex flex-col items-center gap-3 p-6 bg-gradient-to-br from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl shadow-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  >
                    <Sunrise size={40} />
                    <span className="font-bold text-lg">CHECK-IN</span>
                  </button>

                  {!isSaturday && (
                    <>
                      <button
                        onClick={() => registrarPonto('saida_almoco')}
                        disabled={loading || !todayRecord.entrada_manha || todayRecord.saida_almoco}
                        className="flex flex-col items-center gap-3 p-6 bg-gradient-to-br from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl shadow-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                      >
                        <Coffee size={40} />
                        <span className="font-bold text-lg">ALMOÇO</span>
                      </button>

                      <button
                        onClick={() => registrarPonto('retorno_almoco')}
                        disabled={loading || !todayRecord.saida_almoco || todayRecord.retorno_almoco}
                        className="flex flex-col items-center gap-3 p-6 bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl shadow-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                      >
                        <Coffee size={40} />
                        <span className="font-bold text-lg">RETORNO</span>
                      </button>
                    </>
                  )}

                  <button
                    onClick={() => registrarPonto('saida')}
                    disabled={loading || (isSaturday ? !todayRecord.entrada_manha : !todayRecord.retorno_almoco) || todayRecord.saida_tarde}
                    className="flex flex-col items-center gap-3 p-6 bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl shadow-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  >
                    <Sunset size={40} />
                    <span className="font-bold text-lg">CHECK-OUT</span>
                  </button>
                </div>
              </div>
            )}

            <div className="text-center">
              <button
                onClick={() => setView('registros')}
                className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900 text-white font-bold text-lg rounded-xl shadow-lg transition-all transform hover:scale-105"
              >
                <FileText size={24} />
                VER MEUS REGISTROS
              </button>
            </div>
          </>
        )}

        {view === 'registros' && (
          <>
            <div className="mb-6">
              <button
                onClick={() => setView('home')}
                className="flex items-center gap-2 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium rounded-lg transition-all"
              >
                ← Voltar
              </button>
            </div>

            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="p-6 bg-purple-600">
                <div className="flex justify-between items-center flex-wrap gap-4">
                  <h3 className="text-2xl font-bold text-white">Meus Registros</h3>
                  <div className="flex gap-2">
                    <select
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(Number(e.target.value))}
                      className="px-3 py-2 border border-purple-400 bg-white rounded-lg focus:ring-2 focus:ring-purple-300 outline-none"
                    >
                      {months.map((month, idx) => (
                        <option key={idx} value={idx}>{month}</option>
                      ))}
                    </select>
                    
                    <input
                      type="number"
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(Number(e.target.value))}
                      className="px-3 py-2 border border-purple-400 bg-white rounded-lg w-24 focus:ring-2 focus:ring-purple-300 outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-purple-100 text-purple-800">
                      <th className="border border-purple-200 p-3">Data</th>
                      <th className="border border-purple-200 p-3">Dia</th>
                      <th className="border border-purple-200 p-3">Entrada</th>
                      <th className="border border-purple-200 p-3">Saída</th>
                      <th className="border border-purple-200 p-3">Entrada</th>
                      <th className="border border-purple-200 p-3">Saída</th>
                      <th className="border border-purple-200 p-3">H. Diária</th>
                      <th className="border border-purple-200 p-3">Atrasos</th>
                      <th className="border border-purple-200 p-3">Extras</th>
                    </tr>
                  </thead>
                  <tbody>
                    {days.map(day => {
                      const record = records[day.dateKey] || {}
                      const worked = calculateWorkedHours(record)
                      const expected = getExpectedWorkHours(day.isSaturday, day.isSunday, record.tipo)
                      const delay = calculateDelay(worked, expected)
                      const overtime = calculateOvertime(worked)
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
                          <td className="border border-gray-200 p-2 text-center font-medium">
                            {String(day.day).padStart(2, '0')}/{String(selectedMonth + 1).padStart(2, '0')}
                          </td>
                          <td className="border border-gray-200 p-2 text-center">{day.weekDay}</td>
                          <td className="border border-gray-200 p-2 text-center font-medium">
                            {record.entrada_manha || '--:--'}
                          </td>
                          <td className="border border-gray-200 p-2 text-center font-medium">
                            {record.saida_almoco || '--:--'}
                          </td>
                          <td className="border border-gray-200 p-2 text-center font-medium">
                            {record.retorno_almoco || '--:--'}
                          </td>
                          <td className="border border-gray-200 p-2 text-center font-medium">
                            {record.saida_tarde || '--:--'}
                          </td>
                          <td className="border border-gray-200 p-2 text-center bg-gray-50 font-semibold">
                            {minutesToTime(worked)}
                          </td>
                          <td className="border border-gray-200 p-2 text-center text-red-600 font-semibold">
                            {delay > 0 ? minutesToTime(delay) : '-'}
                          </td>
                          <td className="border border-gray-200 p-2 text-center text-green-600 font-semibold">
                            {(overtime.faixa1 + overtime.faixa2) > 0 ? minutesToTime(overtime.faixa1 + overtime.faixa2) : '-'}
                          </td>
                        </tr>
                      )
                    })}

                    {/* 
                     --------------LINHA DE TOTAIS -------------
                    <tr className="bg-purple-600 text-white font-bold">
                      <td colSpan="6" className="border border-purple-700 p-3 text-center text-lg">
                        TOTAIS DO MÊS
                      </td>
                      <td className="border border-purple-700 p-3 text-center text-lg">
                        {(() => {
                          let totalWorked = 0
                          days.forEach(day => {
                            const record = records[day.dateKey] || {}
                            totalWorked += calculateWorkedHours(record)
                          })
                          return minutesToTime(totalWorked)
                        })()}
                      </td>
                      <td className="border border-purple-700 p-3 text-center text-lg">
                        {(() => {
                          let totalDelays = 0
                          days.forEach(day => {
                            const record = records[day.dateKey] || {}
                            const worked = calculateWorkedHours(record)
                            const expected = getExpectedWorkHours(day.isSaturday, day.isSunday, record?.tipo)
                            const delay = calculateDelay(worked, expected)
                            if (record && record.tipo === 'folga') {
                              totalDelays += expected
                            } else {
                              totalDelays += delay
                            }
                          })
                          return minutesToTime(totalDelays)
                        })()}
                      </td>
                      <td className="border border-purple-700 p-3 text-center text-lg">
                        {(() => {
                          let totalExtras = 0
                          days.forEach(day => {
                            const record = records[day.dateKey] || {}
                            if (record.tipo !== 'feriado') {
                              const overtime = calculateOvertime(calculateWorkedHours(record))
                              totalExtras += (overtime.faixa1 + overtime.faixa2)
                            }
                          })
                          return minutesToTime(totalExtras)
                        })()}
                      </td>
                    </tr>
                    */}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default EmployeeDashboard