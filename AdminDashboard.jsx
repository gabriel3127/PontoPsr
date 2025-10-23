import React, { useState, useEffect } from 'react'
import { Calendar, Clock, LogOut, Database } from 'lucide-react'
import Notifications from '../components/Notifications'
import useNotifications from '../hooks/useNotifications'
import { 
  supabase, 
  getCategorias, 
  getFuncionarios,
  createFuncionario,
  transferFuncionario,
  getRegistrosPonto,
  upsertRegistroPonto,
  getBancoHoras,
  upsertBancoHoras,
  initializeDatabase
} from '../lib/supabaseClient'
import { 
  minutesToTime, 
  timeToMinutes,
  calculateWorkedHours,
  getExpectedWorkHours,
  calculateDelay,
  calculateOvertime,
  hasShortLunch,
  generateMonthDays,
  months 
} from '../lib/utils'
import { useAuth } from './AuthContext'
import BackupSystem from './BackupSystem'

// Adicionar estilos globais para impressão
const printStyles = `
  @media print {
    /* Esconder tudo por padrão */
    body.printing-banco-horas * {
      visibility: hidden;
    }
    
    /* Mostrar apenas as tabelas do banco de horas */
    body.printing-banco-horas .banco-horas-print-area,
    body.printing-banco-horas .banco-horas-print-area * {
      visibility: visible;
    }
    
    /* Posicionar as tabelas no topo da página */
    body.printing-banco-horas .banco-horas-print-area {
      position: absolute;
      left: 0;
      top: 0;
      width: 100%;
    }
    
    /* Configurações da página */
    @page {
      size: A4 landscape;
      margin: 1cm;
    }
    
    /* Ajustes de fonte e cores */
    body.printing-banco-horas {
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }
  }
`

// Injetar estilos no documento
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style')
  styleSheet.textContent = printStyles
  document.head.appendChild(styleSheet)
}

function AdminDashboard() {
    const { logout } = useAuth()
    const { notifications, showNotification } = useNotifications()
    const [view, setView] = useState('timesheet')
    const [companyName, setCompanyName] = useState('SISTEMA DE PONTO')
    const [loading, setLoading] = useState(true)
    const [categorias, setCategorias] = useState([])
    const [funcionarios, setFuncionarios] = useState([])
    const [records, setRecords] = useState({})
    const [bancoHorasData, setBancoHorasData] = useState({})
    const [selectedCategoria, setSelectedCategoria] = useState('')
    const [selectedFuncionario, setSelectedFuncionario] = useState('')
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
    const [bancoCategoria, setBancoCategoria] = useState('')
    const [bancoFuncionario, setBancoFuncionario] = useState('')
    const [bancoYear, setBancoYear] = useState(new Date().getFullYear())
    const [bancoFilter, setBancoFilter] = useState('individual')
    const [bancoMesInicio, setBancoMesInicio] = useState(null)
    const [bancoMesFim, setBancoMesFim] = useState(null)
    const [showCalendario, setShowCalendario] = useState(false)
    const [calendarioTipo, setCalendarioTipo] = useState('inicio') // 'inicio' ou 'fim'
    const [bancoTodosCategoria, setBancoTodosCategoria] = useState('todas') // todas, ou ID da categoria
    const [showTransferModal, setShowTransferModal] = useState(false)
    const [showNewEmployeeModal, setShowNewEmployeeModal] = useState(false)

  useEffect(() => {
    loadInitialData()
  }, [])

  const loadInitialData = async () => {
    try {
      setLoading(true)
      const categoriasData = await getCategorias()
      setCategorias(categoriasData)
      const funcionariosData = await getFuncionarios()
      setFuncionarios(funcionariosData)
      if (categoriasData.length > 0) {
        const firstCategoria = categoriasData[0].id
        setSelectedCategoria(firstCategoria)
        setBancoCategoria(firstCategoria)
        const categoriaFuncionarios = funcionariosData.filter(emp => emp.categoria_id === firstCategoria)
        if (categoriaFuncionarios.length > 0) {
          setSelectedFuncionario(categoriaFuncionarios[0].id)
          setBancoFuncionario(categoriaFuncionarios[0].id)
        }
      }
      showNotification('Dados carregados com sucesso!', 'success')
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
      showNotification('Erro ao carregar dados: ' + error.message, 'error')
    } finally {
      setLoading(false)
    }
  }

// Adicione uma flag para evitar recarregar desnecessariamente
const [isNavigating, setIsNavigating] = useState(false)

  useEffect(() => {
    if (selectedFuncionario && view === 'timesheet' && !isNavigating) {
      // Limpar registros antes de carregar novos dados
      setRecords({})
      loadTimeRecords()
    }
    setIsNavigating(false)
  }, [selectedFuncionario, selectedMonth, selectedYear, view])

// Modifique a função loadTimeRecords para preservar dados não salvos
const loadTimeRecords = async () => {
  try {
    const recordsData = await getRegistrosPonto(selectedFuncionario, selectedYear, selectedMonth)
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
    
    // IMPORTANTE: Preservar dados em memória de outros meses
    setRecords(prevRecords => {
      // Manter registros de outros meses
      const newRecords = {}
      
      // Preservar registros que não são do mês atual sendo carregado
      Object.keys(prevRecords).forEach(key => {
        const [keyYear, keyMonth] = key.split('-').map(Number)
        if (keyYear !== selectedYear || keyMonth !== selectedMonth) {
          newRecords[key] = prevRecords[key]
        }
      })
      
      // Adicionar os registros carregados do banco
      Object.keys(recordsMap).forEach(key => {
        newRecords[key] = recordsMap[key]
      })
      
      return newRecords
    })
  } catch (error) {
    console.error('Erro ao carregar registros:', error)
    showNotification('Erro ao carregar registros: ' + error.message, 'error')
  }
}

  const loadBancoHoras = async () => {
    try {
      const bancoData = await getBancoHoras(bancoFuncionario, bancoYear)
      const bancoMap = {}
      bancoData.forEach(item => {
        if (!bancoMap[item.ano]) bancoMap[item.ano] = {}
        bancoMap[item.ano][item.mes] = minutesToTime(item.saldo_minutos || 0)
      })
      setBancoHorasData(bancoMap)
    } catch (error) {
      console.error('Erro ao carregar banco de horas:', error)
    }
  }

  const loadAllBancoHoras = async () => {
    try {
      // Buscar todos os registros do banco de horas do ano
      const { data, error } = await supabase
        .from('banco_horas')
        .select('*')
        .eq('ano', bancoYear)
      
      if (error) throw error
      
      const bancoMap = {}
      data.forEach(item => {
        if (!bancoMap[item.funcionario_id]) bancoMap[item.funcionario_id] = {}
        bancoMap[item.funcionario_id][item.mes] = item.saldo_minutos || 0
      })
      setBancoHorasData(bancoMap)
    } catch (error) {
      console.error('Erro ao carregar todos os bancos de horas:', error)
    }
  }

const updateRecord = async (dateKey, field, value) => {
  // Atualizar o estado local primeiro
  const newRecord = {
    ...records[dateKey],
    [field]: value
  }
  
  setRecords(prev => ({
    ...prev,
    [dateKey]: newRecord
  }))
  
  // Salvar no banco IMEDIATAMENTE (não usar debounce)
  try {
    const [year, month, day] = dateKey.split('-').map(Number)
    const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    
    const recordData = {
      funcionario_id: selectedFuncionario,
      data: date,
      entrada_manha: newRecord.entrada_manha || null,
      saida_almoco: newRecord.saida_almoco || null,
      retorno_almoco: newRecord.retorno_almoco || null,
      saida_tarde: newRecord.saida_tarde || null,
      tipo_dia: newRecord.tipo || 'normal'
    }

    // Salvar imediatamente no Supabase
    await upsertRegistroPonto(recordData)
    
    // Mostrar feedback visual discreto (opcional)
    // showNotification('Salvo automaticamente', 'success')
    
  } catch (error) {
    console.error('Erro ao salvar registro:', error)
    showNotification('Erro ao salvar: ' + error.message, 'error')
    
    // Reverter mudança em caso de erro
    setRecords(prev => ({
      ...prev,
      [dateKey]: records[dateKey]
    }))
  }
}

  const handleTransferFuncionario = async (targetCategoriaId) => {
    try {
      await transferFuncionario(selectedFuncionario, targetCategoriaId)
      await loadInitialData()
      setSelectedCategoria(targetCategoriaId)
      showNotification('Funcionário transferido com sucesso!', 'success')
    } catch (error) {
      showNotification('Erro ao transferir: ' + error.message, 'error')
    }
  }

  const handleCreateFuncionario = async (nome, categoriaId) => {
    try {
      const newFuncionario = await createFuncionario(nome, categoriaId)
      await loadInitialData()
      setSelectedCategoria(categoriaId)
      setSelectedFuncionario(newFuncionario.id)
      showNotification(`${nome} cadastrado com sucesso!`, 'success')
      return true
    } catch (error) {
      showNotification('Erro ao cadastrar: ' + error.message, 'error')
      return false
    }
  }

  const calculateTotals = () => {
    const days = generateMonthDays(selectedYear, selectedMonth)
    let totalWorked = 0
    let totalDelays = 0
    let totalExpected = 0
    let totalFaixa1 = 0
    let totalFaixa2 = 0
    let totalHorasFeriado = 0
    
    days.forEach(day => {
      const record = records[day.dateKey]
      const worked = calculateWorkedHours(record)
      const expected = getExpectedWorkHours(day.isSaturday, day.isSunday, record?.tipo)
      const delay = calculateDelay(worked, expected)
      const overtime = calculateOvertime(worked, day.isSaturday)
      
      if (record && record.tipo === 'feriado') {
        totalHorasFeriado += worked
      } else if (record && record.tipo === 'folga') {
        // Folga: conta como atraso (penaliza)
        totalDelays += expected
        totalExpected += expected
      } else if (record && record.tipo === 'falta') {
        // Falta: conta como atraso (penaliza)
        totalDelays += expected
        totalExpected += expected
      } else {
        totalWorked += worked
        totalDelays += delay
        totalExpected += expected
        totalFaixa1 += overtime.faixa1
        totalFaixa2 += overtime.faixa2
      }
    })
    
    const totalFaixa1Calculado = Math.round(totalFaixa1 * 1.5)
    const totalFaixa2Calculado = Math.round(totalFaixa2 * 2)
    
    return { 
      totalWorked,
      totalDelays, 
      totalFaixa1, 
      totalFaixa2, 
      totalFaixa1Calculado, 
      totalFaixa2Calculado, 
      totalHorasFeriado,
    }
  }

  const salvarSaldo = async () => {
    try {
      const totals = calculateTotals()
      let saldo
    if (totals.totalFaixa1 > totals.totalDelays) {
      // Horas extras > Atrasos: aplica multiplicador
      const diferenca = totals.totalFaixa1 - totals.totalDelays
      saldo = Math.round(diferenca * 1.5) + totals.totalFaixa2Calculado
    } else {
      // Horas extras <= Atrasos: sem multiplicador (arredondado)
      saldo = Math.round(totals.totalFaixa1 - totals.totalDelays)
    }    
      await upsertBancoHoras(selectedFuncionario, selectedYear, selectedMonth, saldo)
      
      const funcionarioNome = funcionarios.find(e => e.id === selectedFuncionario)?.nome || 'Funcionário'
      showNotification(`Saldo de ${funcionarioNome} salvo: ${minutesToTime(saldo)} em ${months[selectedMonth]}/${selectedYear}`, 'success')
      
      await loadBancoHoras()
    } catch (error) {
      console.error('Erro ao salvar saldo:', error)
      showNotification('Erro ao salvar no banco de horas: ' + error.message, 'error')
    }
  }

  const getFuncionariosByCategoria = (categoriaId) => {
    return funcionarios.filter(emp => emp.categoria_id === categoriaId)
  }

  const getFuncionarioNome = (funcionarioId) => {
    return funcionarios.find(e => e.id === funcionarioId)?.nome || ''
  }

  const getCategoriaNome = (categoriaId) => {
    return categorias.find(c => c.id === categoriaId)?.nome || ''
  }

  const calculateFilteredTotal = () => {
    if (bancoFilter !== 'periodo' || !bancoMesInicio || !bancoMesFim) return 0
    
    let total = 0
    
    // Se mesmo ano
    if (bancoMesInicio.ano === bancoMesFim.ano) {
      for (let m = bancoMesInicio.mes; m <= bancoMesFim.mes; m++) {
        const saldoStr = bancoHorasData[bancoMesInicio.ano]?.[m]
        if (saldoStr && saldoStr !== '-') {
          total += timeToMinutes(saldoStr)
        }
      }
    } else {
      // Ano inicial: do mês inicial até dezembro
      for (let m = bancoMesInicio.mes; m <= 11; m++) {
        const saldoStr = bancoHorasData[bancoMesInicio.ano]?.[m]
        if (saldoStr && saldoStr !== '-') {
          total += timeToMinutes(saldoStr)
        }
      }
      
      // Anos intermediários (se houver)
      for (let a = bancoMesInicio.ano + 1; a < bancoMesFim.ano; a++) {
        for (let m = 0; m <= 11; m++) {
          const saldoStr = bancoHorasData[a]?.[m]
          if (saldoStr && saldoStr !== '-') {
            total += timeToMinutes(saldoStr)
          }
        }
      }
      
      // Ano final: de janeiro até o mês final
      for (let m = 0; m <= bancoMesFim.mes; m++) {
        const saldoStr = bancoHorasData[bancoMesFim.ano]?.[m]
        if (saldoStr && saldoStr !== '-') {
          total += timeToMinutes(saldoStr)
        }
      }
    }
    
    return total
  }

  // Componente de Calendário de Meses
    function CalendarioMeses({ onSelect, onClose, anoInicial = new Date().getFullYear() }) {
      const [ano, setAno] = useState(anoInicial)
      
      return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
          <div className="bg-white rounded-lg p-6 max-w-md w-full m-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <button
                onClick={() => setAno(ano - 1)}
                className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded"
              >
                ←
              </button>
              <h3 className="text-xl font-bold">{ano}</h3>
              <button
                onClick={() => setAno(ano + 1)}
                className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded"
              >
                →
              </button>
            </div>
            
            <button 
              onClick={() => setView('backup')}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all ${
                view === 'backup' 
                  ? 'bg-purple-600 text-white shadow-lg' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              <Database size={20} />
              Backup
            </button>

            <div className="grid grid-cols-3 gap-3">
              {months.map((month, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    onSelect({ mes: idx, ano })
                    onClose()
                  }}
                  className="px-4 py-3 bg-purple-100 hover:bg-purple-200 rounded-lg font-medium transition-all"
                >
                  {month}
                </button>
              ))}
            </div>
            
            <button
              onClick={onClose}
              className="mt-6 w-full px-4 py-2 bg-gray-300 hover:bg-gray-400 rounded-lg"
            >
              Cancelar
            </button>
          </div>
        </div>
      )
    }

    const imprimirBancoHoras = () => {
    // Adicionar classe de impressão ao body
    document.body.classList.add('printing-banco-horas')
    
    // Pequeno delay para aplicar os estilos antes de imprimir
    setTimeout(() => {
        window.print()
        // Remover a classe após impressão
        document.body.classList.remove('printing-banco-horas')
    }, 100)
    }

    const imprimirControlePonto = () => {
    const funcionarioNome = getFuncionarioNome(selectedFuncionario)
    const mesNome = months[selectedMonth]
    
    // Criar HTML para impressão
    const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
        <title>Controle de Ponto - ${funcionarioNome} - ${mesNome}/${selectedYear}</title>
        <style>
            @media print {
            @page { 
                margin: 0.5cm; 
                size: A4 portrait;
            }
            body { margin: 0; padding: 10px; }
            }
            body { 
            font-family: Arial, sans-serif; 
            font-size: 9px;
            }
            .header { 
            text-align: center; 
            margin-bottom: 15px; 
            border-bottom: 2px solid #214194; 
            padding-bottom: 8px; 
            }
            .header h1 { 
            margin: 0; 
            color: #214194; 
            font-size: 18px; 
            }
            .header h2 { 
            margin: 3px 0; 
            color: #666; 
            font-size: 14px; 
            }
            .header p { 
            margin: 2px 0; 
            font-size: 11px; 
            }
            table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-bottom: 20px; 
            }
            th, td { 
            border: 1px solid #000; 
            padding: 4px 2px; 
            text-align: center; 
            font-size: 8px; 
            }
            th { 
            background-color: #214194; 
            color: white; 
            font-weight: bold; 
            font-size: 8px;
            }
            .totals { 
            background-color: #214194; 
            color: white; 
            font-weight: bold; 
            }
            .signature { 
            margin-top: 40px; 
            text-align: center;
            }
            .signature p {
            font-size: 11px;
            font-weight: bold;
            margin-bottom: 60px;
            }
            .signature-line { 
            border-top: 2px solid #000; 
            width: 400px; 
            margin: 0 auto; 
            padding-top: 8px; 
            text-align: center; 
            font-size: 10px;
            }
            .footer { 
            margin-top: 20px; 
            font-size: 8px; 
            color: #666; 
            text-align: center; 
            }
            .yellow { background-color: #fef3c7; }
            .gray { background-color: #f3f4f6; }
        </style>
        </head>
        <body>
        <div class="header">
            <h1>${companyName}</h1>
            <h2>Controle de Ponto - ${funcionarioNome}</h2>
            <p><strong>Período:</strong> ${mesNome}/${selectedYear}</p>
        </div>
        
        <table>
            <thead>
            <tr>
                <th>Data</th>
                <th>Dia</th>
                <th>Entrada</th>
                <th>Saída</th>
                <th>Entrada</th>
                <th>Saída</th>
                <th>H. Diária</th>
                <th>Atrasos</th>
                <th>H. Extras</th>
                <th>Tipo</th>
            </tr>
            </thead>
            <tbody>
            ${days.map(day => {
                const record = records[day.dateKey] || {}
                const worked = calculateWorkedHours(record)
                const expected = getExpectedWorkHours(day.isSaturday, day.isSunday, record.tipo)
                const delay = calculateDelay(worked, expected)
                const overtime = calculateOvertime(worked, day.isSaturday)
                const shortLunch = hasShortLunch(record)
                
                return `
                <tr class="${shortLunch ? 'yellow' : ''} ${day.isSunday ? 'gray' : ''}">
                    <td>${String(day.day).padStart(2, '0')}/${String(selectedMonth + 1).padStart(2, '0')}</td>
                    <td>${day.weekDay.substring(0, 3)}</td>
                    <td>${record.entrada_manha || '--:--'}</td>
                    <td>${record.saida_almoco || '--:--'}</td>
                    <td>${record.retorno_almoco || '--:--'}</td>
                    <td>${record.saida_tarde || '--:--'}</td>
                    <td>${minutesToTime(worked)}</td>
                    <td>${delay > 0 ? minutesToTime(delay) : '-'}</td>
                    <td>${(overtime.faixa1 + overtime.faixa2) > 0 ? minutesToTime(overtime.faixa1 + overtime.faixa2) : '-'}</td>
                    <td>${record.tipo === 'feriado' ? 'Fer.' : record.tipo === 'folga' ? 'Folga' : 'Normal'}</td>
                </tr>
                `
            }).join('')}
            <tr class="totals">
                <td colspan="6"><strong>TOTAIS</strong></td>
                <td>${minutesToTime(totals.totalWorked)}</td>
                <td>${minutesToTime(totals.totalDelays)}</td>
                <td>${minutesToTime(totals.totalFaixa1Calculado + totals.totalFaixa2Calculado)}</td>
                <td><strong>${saldo >= 0 ? '+' : ''}${minutesToTime(saldo)}</strong></td>
            </tr>
            </tbody>
        </table>
        
        <div class="signature">
            <p>Declaro que os horários acima conferem com meus registros de ponto.</p>
            <div class="signature-line">
            ${funcionarioNome}<br>
            Assinatura do Funcionário
            </div>
        </div>
        
        <div class="footer">
            <p>Documento gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</p>
            <p>${companyName} - Sistema de Controle de Ponto</p>
        </div>
        </body>
        </html>
    `
    
    // Abrir em nova janela e imprimir
    const printWindow = window.open('', '_blank')
    printWindow.document.write(printContent)
    printWindow.document.close()
    printWindow.onload = () => {
        printWindow.print()
    }
    }

  const days = generateMonthDays(selectedYear, selectedMonth)
  const totals = calculateTotals()
  let saldo
  if (totals.totalFaixa1 > totals.totalDelays) {
    // Horas extras > Atrasos: aplica multiplicador
    const diferenca = totals.totalFaixa1 - totals.totalDelays
    saldo = Math.round(diferenca * 1.5) + totals.totalFaixa2Calculado
  } else {
    // Horas extras <= Atrasos: sem multiplicador (arredondado)
    saldo = Math.round(totals.totalFaixa1 - totals.totalDelays)
  }

  return (
    <div className="w-full min-h-screen bg-gray-100 p-4">
      <Notifications notifications={notifications} />
      <div className="max-w-7xl mx-auto">
        <div className="bg-gradient-to-r from-purple-600 to-purple-800 rounded-lg shadow-lg p-6 mb-4">
            <div className="flex justify-between items-center">
                <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="text-2xl font-bold bg-transparent text-white border-b-2 border-transparent hover:border-white/50 focus:border-white outline-none px-2 py-1 transition-all flex-1"
                placeholder="Nome da Empresa"
            />
            <button
              onClick={async () => {
                try {
                  console.log('🔴 Fazendo logout...')
                  await logout()
                } catch (error) {
                  console.error('Erro no logout:', error)
                  // Forçar logout
                  await supabase.auth.signOut()
                  window.location.href = '/login'
                }
              }}
              className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
            >
              <LogOut size={20} />
              Sair
            </button>
        </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-4 mb-4">
          <div className="flex justify-between items-center flex-wrap gap-4">
            <div className="flex gap-2">
              <button
                onClick={() => setView('timesheet')}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${view === 'timesheet' ? 'bg-purple-600 text-white shadow-md' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
              >
                <Clock size={20} />
                Controle de Ponto
              </button>
              <button
                onClick={() => setView('banco')}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${view === 'banco' ? 'bg-purple-600 text-white shadow-md' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
              >
                <Calendar size={20} />
                Banco de Horas
              </button>
            </div>
          </div>
        </div>
        

            {view === 'timesheet' && (
              <div className="flex gap-2 items-center flex-wrap">
                <select
                  value={selectedCategoria}
                  onChange={(e) => {
                    setSelectedCategoria(e.target.value)
                    const categoriaFuncionarios = getFuncionariosByCategoria(e.target.value)
                    if (categoriaFuncionarios.length > 0) setSelectedFuncionario(categoriaFuncionarios[0].id)
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                >
                  {categorias.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.nome}</option>
                  ))}
                </select>

                <select
                  value={selectedFuncionario}
                  onChange={(e) => setSelectedFuncionario(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                >
                  {getFuncionariosByCategoria(selectedCategoria).map(func => (
                    <option key={func.id} value={func.id}>{func.nome}</option>
                  ))}
                </select>
                
                <button
                  onClick={() => setShowTransferModal(true)}
                  className="px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-all text-sm"
                >
                  ↔️ Transferir
                </button>
                
                <button
                  onClick={() => setShowNewEmployeeModal(true)}
                  className="px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-all text-sm font-semibold"
                >
                  ➕ Novo
                </button>
                
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                >
                  {months.map((month, idx) => (
                    <option key={idx} value={idx}>{month}</option>
                  ))}
                </select>
                
                <input
                  type="number"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-lg w-24 focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>
            )}

            {view === 'banco' && (
              <div className="flex gap-2 items-center flex-wrap">
                <div className="flex gap-1 bg-gray-200 rounded-lg p-1">
                  <button
                    onClick={() => setBancoFilter('individual')}
                    className={`px-3 py-1 rounded text-sm font-medium transition-all ${bancoFilter === 'individual' ? 'bg-purple-600 text-white' : 'text-gray-700 hover:bg-gray-300'}`}
                  >
                    Individual
                  </button>
                  <button
                    onClick={() => setBancoFilter('periodo')}
                    className={`px-3 py-1 rounded text-sm font-medium transition-all ${bancoFilter === 'periodo' ? 'bg-purple-600 text-white' : 'text-gray-700 hover:bg-gray-300'}`}
                  >
                    Período
                  </button>
                  <button
                    onClick={() => setBancoFilter('todos')}
                    className={`px-3 py-1 rounded text-sm font-medium transition-all ${bancoFilter === 'todos' ? 'bg-purple-600 text-white' : 'text-gray-700 hover:bg-gray-300'}`}
                  >
                    Todos
                  </button>
                </div>

                {bancoFilter === 'todos' ? (
                  <>
                    <select
                      value={bancoTodosCategoria}
                      onChange={(e) => setBancoTodosCategoria(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                    >
                      <option value="todas">Todas as Empresas</option>
                      {categorias.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.nome}</option>
                      ))}
                    </select>
                  </>
                ) : (
                  <>
                    <select
                      value={bancoCategoria}
                      onChange={(e) => {
                        setBancoCategoria(e.target.value)
                        const categoriaFuncionarios = getFuncionariosByCategoria(e.target.value)
                        if (categoriaFuncionarios.length > 0) setBancoFuncionario(categoriaFuncionarios[0].id)
                      }}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                    >
                      {categorias.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.nome}</option>
                      ))}
                    </select>

                    <select
                      value={bancoFuncionario}
                      onChange={(e) => setBancoFuncionario(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                    >
                      {getFuncionariosByCategoria(bancoCategoria).map(func => (
                        <option key={func.id} value={func.id}>{func.nome}</option>
                      ))}
                    </select>

                    {bancoFilter === 'periodo' && (
                      <>
                        <button
                          onClick={() => {
                            setCalendarioTipo('inicio')
                            setShowCalendario(true)
                          }}
                          className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-purple-500 outline-none"
                        >
                          {bancoMesInicio 
                            ? `${months[bancoMesInicio.mes]}/${bancoMesInicio.ano}`
                            : 'Mês Inicial'
                          }
                        </button>

                        <span className="text-gray-500">até</span>

                        <button
                          onClick={() => {
                            setCalendarioTipo('fim')
                            setShowCalendario(true)
                          }}
                          className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-purple-500 outline-none"
                        >
                          {bancoMesFim 
                            ? `${months[bancoMesFim.mes]}/${bancoMesFim.ano}`
                            : 'Mês Final'
                          }
                        </button>

                        <button
                          onClick={() => setView('backup')}
                          className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold ${
                            view === 'backup' ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-700'
                          }`}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
                            <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
                            <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
                          </svg>
                          Backup
                        </button>
                      </>
                    )}
                  </>
                )}
                
                <input
                  type="number"
                  value={bancoYear}
                  onChange={(e) => setBancoYear(Number(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-lg w-24 focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>
            )}

        {view === 'timesheet' && (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-purple-600 text-white">
                    <th className="border border-purple-700 p-2">Data</th>
                    <th className="border border-purple-700 p-2">Dia Semana</th>
                    <th className="border border-purple-700 p-2">Entrada</th>
                    <th className="border border-purple-700 p-2">Saída</th>
                    <th className="border border-purple-700 p-2">Entrada</th>
                    <th className="border border-purple-700 p-2">Saída</th>
                    <th className="border border-purple-700 p-2">H. Diária</th>
                    <th className="border border-purple-700 p-2">Atrasos</th>
                    <th className="border border-purple-700 p-2">Horas Extras</th>
                    <th className="border border-purple-700 p-2">1ª Faixa (150%)</th>
                    <th className="border border-purple-700 p-2">2ª Faixa (200%)</th>
                    <th className="border border-purple-700 p-2">Tipo</th>
                  </tr>
                </thead>
                <tbody>
                  {days.map(day => {
                    const record = records[day.dateKey] || {}
                    const worked = calculateWorkedHours(record)
                    const expected = getExpectedWorkHours(day.isSaturday, day.isSunday, record.tipo)
                    const delay = calculateDelay(worked, expected)
                    const overtime = calculateOvertime(worked, day.isSaturday)
                    const shortLunch = hasShortLunch(record)
                    const isDisabled = record.tipo === 'folga' || record.tipo === 'falta' || day.isSunday
                    const isFeriado = record.tipo === 'feriado'
                    
                      return (
                        <tr 
                          key={day.dateKey} 
                          className={`
                            ${shortLunch ? 'bg-yellow-100' : ''}
                            ${day.isSunday ? 'bg-gray-200' : ''}
                            ${isFeriado ? 'bg-green-100' : ''}
                            ${record.tipo === 'folga' ? 'bg-orange-200' : ''}
                            ${record.tipo === 'falta' ? 'bg-red-200' : ''}
                            ${!shortLunch && !day.isSunday && !record.tipo ? 'hover:bg-gray-50' : ''}
                          `}
                        >
                        <td className="border border-gray-300 p-1 text-center">
                          {String(day.day).padStart(2, '0')}/{String(selectedMonth + 1).padStart(2, '0')}/{selectedYear}
                        </td>
                        <td className="border border-gray-300 p-1 text-center">{day.weekDay}</td>
                        <td className="border border-gray-300 p-1">
                          <input
                            type="time"
                            value={record.entrada_manha || ''}
                            onChange={(e) => updateRecord(day.dateKey, 'entrada_manha', e.target.value)}
                            disabled={isDisabled}
                            className="w-full text-center px-1 py-1 rounded border border-gray-200 focus:ring-2 focus:ring-purple-400 outline-none disabled:bg-gray-100"
                          />
                        </td>
                        <td className="border border-gray-300 p-1">
                          <input
                            type="time"
                            value={record.saida_almoco || ''}
                            onChange={(e) => updateRecord(day.dateKey, 'saida_almoco', e.target.value)}
                            disabled={isDisabled}
                            className="w-full text-center px-1 py-1 rounded border border-gray-200 focus:ring-2 focus:ring-purple-400 outline-none disabled:bg-gray-100"
                          />
                        </td>
                        <td className="border border-gray-300 p-1">
                          <input
                            type="time"
                            value={record.retorno_almoco || ''}
                            onChange={(e) => updateRecord(day.dateKey, 'retorno_almoco', e.target.value)}
                            disabled={isDisabled}
                            className="w-full text-center px-1 py-1 rounded border border-gray-200 focus:ring-2 focus:ring-purple-400 outline-none disabled:bg-gray-100"
                          />
                        </td>
                        <td className="border border-gray-300 p-1">
                          <input
                            type="time"
                            value={record.saida_tarde || ''}
                            onChange={(e) => updateRecord(day.dateKey, 'saida_tarde', e.target.value)}
                            disabled={isDisabled}
                            className="w-full text-center px-1 py-1 rounded border border-gray-200 focus:ring-2 focus:ring-purple-400 outline-none disabled:bg-gray-100"
                          />
                        </td>
                        <td className="border border-gray-300 p-2 text-center bg-gray-50 font-medium">
                          {isFeriado && worked > 0 ? (
                            <span className="text-green-700 font-bold">{minutesToTime(worked)}</span>
                          ) : (
                            minutesToTime(worked)
                          )}
                        </td>
                        <td className="border border-gray-300 p-2 text-center text-red-600 font-semibold">
                          {(record.tipo === 'folga' || record.tipo === 'falta') 
                            ? minutesToTime(expected) 
                            : (delay > 0 ? minutesToTime(delay) : '-')
                          }
                        </td>
                        <td className="border border-gray-300 p-2 text-center bg-blue-50 font-medium">
                          {isFeriado ? '-' : ((overtime.faixa1 + overtime.faixa2) > 0 ? minutesToTime(overtime.faixa1 + overtime.faixa2) : '-')}
                        </td>
                        <td className="border border-gray-300 p-2 text-center text-blue-600 font-semibold">
                          {isFeriado ? '-' : (overtime.faixa1 > 0 ? minutesToTime(overtime.faixa1) : '-')}
                        </td>
                        <td className="border border-gray-300 p-2 text-center text-green-600 font-semibold">
                          {isFeriado ? '-' : (overtime.faixa2 > 0 ? minutesToTime(overtime.faixa2) : '-')}
                        </td>
                        <td className="border border-gray-300 p-1">
                          <select
                            value={record.tipo || 'normal'}
                            onChange={(e) => updateRecord(day.dateKey, 'tipo', e.target.value)}
                            disabled={day.isSunday}
                            className="w-full px-1 py-1 text-xs rounded border border-gray-200 focus:ring-2 focus:ring-purple-400 outline-none disabled:bg-gray-100"
                          >
                            <option value="normal">Normal</option>
                            <option value="feriado">Feriado</option>
                            <option value="folga">Folga</option>
                            <option value="falta">Falta</option>
                          </select>
                        </td>
                      </tr>
                    )
                  })}
                  
                  {/* TOTAIS NO FIM DA TABELA */}
                  
                  <tr className="bg-purple-600 text-white font-bold">
                    <td colSpan="6" className="border border-purple-700 p-2 text-center">TOTAIS</td>
                    <td className="border border-purple-700 p-2 text-center">
                      {minutesToTime(totals.totalWorked)}
                    </td>

                    <td className="border border-purple-700 p-2 text-center">
                      {minutesToTime(totals.totalDelays)}
                    </td>

                    <td className="border border-purple-700 p-2 text-center">
                      {minutesToTime(totals.totalFaixa1 + totals.totalFaixa2)}
                      </td>

                    <td className="border border-purple-700 p-2 text-center">
                      <div className="flex flex-col">
                        {/* 1. MOSTRAR O TOTAL (Resultado da operação) */}
                        <span className="font-semibold">
                          {minutesToTime((totals.totalFaixa1 - totals.totalDelays) * 1.5)}
                        </span>
                        
                        {/* 2. MOSTRAR A OPERAÇÃO ABAIXO */}
                        <span className="text-xs text-purple-200">
                          {minutesToTime(totals.totalFaixa1 - totals.totalDelays)} × 1.5
                        </span>
                      </div>
                    </td>

                    <td className="border border-purple-700 p-2 text-center">
                      <div className="flex flex-col">
                        <span>{minutesToTime(totals.totalFaixa2Calculado)}</span>
                        <span className="text-xs text-purple-200">({minutesToTime(totals.totalFaixa2)} × 2)</span>
                      </div>
                    </td>

                    <td className="border border-purple-700 p-2 text-center">
                      <span className={saldo >= 0 ? 'text-green-300' : 'text-red-300'}>
                        SALDO: {minutesToTime(saldo)}
                      </span>
                    </td>
                  </tr>
                  
                  {totals.totalHorasFeriado > 0 && (
                    <tr className="bg-green-600 text-white font-bold">
                      <td colSpan="6" className="border border-green-700 p-2 text-center">HORAS EM FERIADOS</td>
                      <td className="border border-green-700 p-2 text-center">{minutesToTime(totals.totalHorasFeriado)}</td>
                      <td colSpan="5" className="border border-green-700 p-2 text-center text-xs">
                        Não afeta o saldo - apenas para controle
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            <div className="p-4 bg-gray-50 border-t border-gray-200">
                <div className="flex justify-between items-center flex-wrap gap-4">
                    <div className="flex flex-wrap gap-4 text-xs items-center">
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-yellow-100 border border-yellow-400 rounded"></div>
                        <span>Almoço &lt; 1h</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-green-100 border border-green-400 rounded"></div>
                        <span>Feriado</span>
                    </div>
                    </div>
                    
                    <div className="flex gap-3">
                    <button
                        onClick={imprimirControlePonto}
                        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-md transition-all"
                    >
                        🖨️ Imprimir
                    </button>
                    
                    <button
                        onClick={salvarSaldo}
                        className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-md transition-all"
                    >
                        💾 Salvar no Banco de Horas
                    </button>
                    </div>
                </div>
            </div>
          </div>
        )}

        {view === 'banco' && bancoFilter !== 'todos' && (
          <div className="bg-white rounded-lg shadow-md p-6 banco-horas-print-area">
            <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
              <h2 className="text-2xl font-bold text-gray-800">
                Banco de Horas - {getFuncionarioNome(bancoFuncionario)} - {bancoYear}
              </h2>
              <button
                onClick={imprimirBancoHoras}
                className="px-6 py-3 bg-[#214194] hover:bg-[#1a3470] text-white font-bold rounded-lg shadow-md transition-all"
              >
                🖨️ Imprimir Relatório
              </button>
            </div>
            
            {bancoFilter === 'periodo' && bancoMesInicio && bancoMesFim && (
              <div className="mb-6 p-4 bg-purple-100 rounded-lg">
                <div className="text-center">
                  <p className="text-sm text-gray-700 mb-2">
                    Total de {months[bancoMesInicio.mes]}/{bancoMesInicio.ano} a {months[bancoMesFim.mes]}/{bancoMesFim.ano}
                  </p>
                  <p className={`text-3xl font-bold ${calculateFilteredTotal() >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {minutesToTime(calculateFilteredTotal())}
                  </p>
                </div>
              </div>
            )}
            
            <div className="overflow-x-auto">
              <table className="w-full text-base">
                <thead>
                  <tr className="bg-purple-600 text-white">
                    <th className="border border-purple-700 p-4 text-left">MÊS</th>
                    <th className="border border-purple-700 p-4 text-center">SALDO</th>
                  </tr>
                </thead>
                <tbody>
                  {months.map((month, idx) => {
                    const saldoValue = bancoHorasData[bancoYear]?.[idx] || '-'
                    const isNegativo = saldoValue.startsWith('-')
                    
                    return (
                      <tr key={idx} className="hover:bg-gray-50 border-b">
                        <td className="border border-gray-300 p-4 font-semibold">{month}</td>
                        <td 
                          className={`border border-gray-300 p-4 text-center cursor-pointer text-lg font-bold ${
                            isNegativo ? 'text-red-600' : (saldoValue !== '-' ? 'text-blue-600' : 'text-gray-400')
                          }`}
                          onClick={() => {
                            setSelectedFuncionario(funcionario.id)
                            setSelectedCategoria(categoria.id)
                            setSelectedMonth(idx)
                            setSelectedYear(bancoYear)
                            setBancoFilter('individual')
                            setView('timesheet')
                          }}
                        >
                          {saldoValue}
                        </td>
                      </tr>
                    )
                  })}
                  
                  <tr className="bg-purple-600 text-white font-bold">
                    <td className="border border-purple-700 p-4 text-center">TOTAL DO ANO</td>
                    <td className="border border-purple-700 p-4 text-center text-xl">
                      {(() => {
                        let totalAnual = 0
                        months.forEach((_, idx) => {
                          const saldoStr = bancoHorasData[bancoYear]?.[idx]
                          if (saldoStr && saldoStr !== '-') {
                            totalAnual += timeToMinutes(saldoStr)
                          }
                        })
                        return (
                          <span className={totalAnual >= 0 ? 'text-green-300' : 'text-red-300'}>
                            {minutesToTime(totalAnual)}
                          </span>
                        )
                      })()}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-sm text-gray-600 mt-6 p-4 bg-blue-50 rounded-lg">
              💡 Clique em qualquer mês para ver/editar os registros de ponto
            </p>
          </div>
        )}

        {view === 'banco' && bancoFilter === 'todos' && (
          <div className="bg-white rounded-lg shadow-md p-6 banco-horas-print-area">
            <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
              <h2 className="text-2xl font-bold text-gray-800">
                Banco de Horas - Todos os Funcionários - {bancoYear}
              </h2>
              <button
                onClick={imprimirBancoHoras}
                className="px-6 py-3 bg-[#214194] hover:bg-[#1a3470] text-white font-bold rounded-lg shadow-md transition-all"
              >
                🖨️ Imprimir Relatório
              </button>
            </div>
            
            {(bancoTodosCategoria === 'todas' ? categorias : categorias.filter(c => c.id === bancoTodosCategoria)).map(categoria => {
              const funcionariosCategoria = getFuncionariosByCategoria(categoria.id)
              if (funcionariosCategoria.length === 0) return null
              
              return (
                <div key={categoria.id} className="mb-8">
                  {bancoTodosCategoria === 'todas' && (
                    <h3 className="text-xl font-bold mb-4 text-purple-700 bg-purple-100 p-3 rounded-lg">
                      {categoria.nome}
                    </h3>
                  )}
                  
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-purple-600 text-white">
                          <th className="border border-purple-700 p-2 text-left sticky left-0 bg-purple-600">FUNCIONÁRIO</th>
                          {months.map((month, idx) => (
                            <th key={idx} className="border border-purple-700 p-2 text-center whitespace-nowrap">
                              {month.substring(0, 3)}
                            </th>
                          ))}
                          <th className="border border-purple-700 p-2 text-center font-bold bg-purple-700">TOTAL ANO</th>
                        </tr>
                      </thead>
                      <tbody>
                        {funcionariosCategoria.map(funcionario => {
                          let totalAnual = 0
                          
                          return (
                            <tr key={funcionario.id} className="hover:bg-gray-50">
                              <td className="border border-gray-300 p-2 font-semibold sticky left-0 bg-white">
                                {funcionario.nome}
                              </td>
                              {months.map((_, idx) => {
                                const saldoMinutos = bancoHorasData[funcionario.id]?.[idx] || 0
                                totalAnual += saldoMinutos
                                const saldoStr = saldoMinutos === 0 ? '-' : minutesToTime(saldoMinutos)
                                const isNegativo = saldoMinutos < 0
                                
                                return (
                                  <td 
                                    key={idx}
                                    className={`border border-gray-300 p-2 text-center cursor-pointer ${
                                      isNegativo ? 'text-red-600 font-semibold' : 
                                      (saldoMinutos > 0 ? 'text-blue-600 font-semibold' : 'text-gray-400')
                                    }`}
                                    onClick={() => {
                                      setSelectedFuncionario(funcionario.id)
                                      setSelectedCategoria(categoria.id)
                                      setSelectedMonth(idx)
                                      setSelectedYear(bancoYear)
                                      setBancoFilter('individual')
                                      setView('timesheet')
                                    }}
                                  >
                                    {saldoStr}
                                  </td>
                                )
                              })}
                              <td className={`border border-gray-300 p-2 text-center font-bold ${
                                totalAnual < 0 ? 'text-red-600 bg-red-50' : 
                                (totalAnual > 0 ? 'text-green-600 bg-green-50' : 'text-gray-400')
                              }`}>
                                {minutesToTime(totalAnual)}
                              </td>
                            </tr>
                          )
                        })}
                        
                        {bancoTodosCategoria === 'todas' && (
                          <tr className="bg-purple-100 font-bold">
                            <td className="border border-purple-300 p-2 sticky left-0 bg-purple-100">
                              TOTAL {categoria.nome.toUpperCase()}
                            </td>
                            {months.map((_, idx) => {
                              let totalMes = 0
                              funcionariosCategoria.forEach(func => {
                                totalMes += bancoHorasData[func.id]?.[idx] || 0
                              })
                              return (
                                <td 
                                  key={idx}
                                  className={`border border-purple-300 p-2 text-center ${
                                    totalMes < 0 ? 'text-red-600' : (totalMes > 0 ? 'text-blue-600' : 'text-gray-500')
                                  }`}
                                >
                                  {totalMes === 0 ? '-' : minutesToTime(totalMes)}
                                </td>
                              )
                            })}
                            <td className="border border-purple-300 p-2 text-center bg-purple-200">
                              {(() => {
                                let totalCategoria = 0
                                funcionariosCategoria.forEach(func => {
                                  months.forEach((_, idx) => {
                                    totalCategoria += bancoHorasData[func.id]?.[idx] || 0
                                  })
                                })
                                return (
                                  <span className={totalCategoria < 0 ? 'text-red-700' : 'text-green-700'}>
                                    {minutesToTime(totalCategoria)}
                                  </span>
                                )
                              })()}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })}
            
            <p className="text-sm text-gray-600 mt-6 p-4 bg-blue-50 rounded-lg">
              💡 Clique em qualquer célula para ver/editar os registros de ponto daquele funcionário no mês
            </p>
          </div>
        )}
      </div>

      {view === 'backup' && (
        <BackupSystem />
      )}

            {/* Modal Calendário */}
      {showCalendario && (
        <CalendarioMeses
          onSelect={(data) => {
            if (calendarioTipo === 'inicio') {
              setBancoMesInicio(data)
            } else {
              setBancoMesFim(data)
            }
          }}
          onClose={() => setShowCalendario(false)}
          anoInicial={calendarioTipo === 'inicio' 
            ? (bancoMesInicio?.ano || new Date().getFullYear())
            : (bancoMesFim?.ano || new Date().getFullYear())
          }
        />
      )}

      {/* Modal Transferir */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full m-4">
            <h3 className="text-xl font-bold mb-4">Transferir Funcionário</h3>
            <p className="mb-2"><strong>Funcionário:</strong> {getFuncionarioNome(selectedFuncionario)}</p>
            <p className="mb-4"><strong>Categoria Atual:</strong> {getCategoriaNome(selectedCategoria)}</p>
            
            <select
              id="targetCategoria"
              className="w-full px-3 py-2 border rounded-lg mb-4"
              defaultValue={selectedCategoria}
            >
              {categorias.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.nome}</option>
              ))}
            </select>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowTransferModal(false)}
                className="flex-1 px-4 py-2 bg-gray-300 rounded-lg hover:bg-gray-400"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  const targetId = document.getElementById('targetCategoria').value
                  handleTransferFuncionario(targetId)
                  setShowTransferModal(false)
                }}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Novo Funcionário */}
      {showNewEmployeeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full m-4">
            <h3 className="text-xl font-bold mb-4">Cadastrar Novo Funcionário</h3>
            
            <input
              id="newFuncionarioNome"
              type="text"
              placeholder="Nome completo"
              className="w-full px-3 py-2 border rounded-lg mb-4"
            />
            
            <select
              id="newFuncionarioCategoria"
              className="w-full px-3 py-2 border rounded-lg mb-4"
              defaultValue={selectedCategoria}
            >
              {categorias.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.nome}</option>
              ))}
            </select>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowNewEmployeeModal(false)}
                className="flex-1 px-4 py-2 bg-gray-300 rounded-lg hover:bg-gray-400"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  const nome = document.getElementById('newFuncionarioNome').value
                  const categoriaId = document.getElementById('newFuncionarioCategoria').value
                  if (await handleCreateFuncionario(nome, categoriaId)) {
                    setShowNewEmployeeModal(false)
                  }
                }}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Cadastrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminDashboard