import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Download, Clock, CheckCircle, AlertCircle, Database, Calendar } from 'lucide-react'

function BackupSystem() {
  const [loading, setLoading] = useState(false)
  const [lastBackup, setLastBackup] = useState(null)
  const [backupHistory, setBackupHistory] = useState([])
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(true)

  useEffect(() => {
    loadBackupHistory()
    
    // Verificar se precisa fazer backup automático
    checkAutoBackup()
    
    // Verificar a cada hora
    const interval = setInterval(checkAutoBackup, 60 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const loadBackupHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('backup_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10)

      if (!error && data) {
        setBackupHistory(data)
        if (data.length > 0) {
          setLastBackup(new Date(data[0].created_at))
        }
      }
    } catch (error) {
      console.error('Erro ao carregar histórico:', error)
    }
  }

  const checkAutoBackup = () => {
    if (!autoBackupEnabled) return

    const now = new Date()
    const hour = now.getHours()
    
    // Fazer backup automático às 18h (fim do expediente)
    if (hour === 18 && (!lastBackup || isNewDay(lastBackup))) {
      performBackup(true)
    }
  }

  const isNewDay = (date) => {
    const now = new Date()
    return date.toDateString() !== now.toDateString()
  }

  const performBackup = async (isAutomatic = false) => {
    setLoading(true)
    
    try {
      // 1. Buscar todos os dados para backup
      const { data: registros, error: regError } = await supabase
        .from('registros_ponto')
        .select(`
          *,
          funcionarios (
            nome,
            email,
            tipo_usuario,
            categorias (nome)
          )
        `)
        .order('data', { ascending: false })

      if (regError) throw regError

      const { data: bancoHoras, error: bhError } = await supabase
        .from('banco_horas')
        .select(`
          *,
          funcionarios (nome)
        `)
        .order('ano', { ascending: false })
        .order('mes', { ascending: false })

      if (bhError) throw bhError

      const { data: funcionarios, error: funcError } = await supabase
        .from('funcionarios')
        .select(`
          *,
          categorias (nome)
        `)
        .order('nome')

      if (funcError) throw funcError

      // 2. Gerar CSV dos registros de ponto
      const csvRegistros = generateCSV(registros, [
        'data',
        'funcionario_nome',
        'categoria',
        'entrada',
        'saida_almoco',
        'retorno_almoco',
        'saida',
        'horas_trabalhadas',
        'observacoes'
      ])

      // 3. Gerar CSV do banco de horas
      const csvBancoHoras = generateCSV(bancoHoras, [
        'funcionario_nome',
        'ano',
        'mes',
        'saldo_minutos'
      ])

      // 4. Gerar CSV dos funcionários
      const csvFuncionarios = generateCSV(funcionarios, [
        'nome',
        'email',
        'categoria',
        'tipo_usuario',
        'ativo'
      ])

      // 5. Criar arquivo ZIP (simulado - na prática, fazer download múltiplo)
      const timestamp = new Date().toISOString().split('T')[0]
      
      // Download dos arquivos
      downloadCSV(csvRegistros, `backup_registros_${timestamp}.csv`)
      setTimeout(() => downloadCSV(csvBancoHoras, `backup_banco_horas_${timestamp}.csv`), 500)
      setTimeout(() => downloadCSV(csvFuncionarios, `backup_funcionarios_${timestamp}.csv`), 1000)

      // 6. Registrar backup no log
      await supabase
        .from('backup_log')
        .insert([{
          tipo: isAutomatic ? 'automatico' : 'manual',
          registros_count: registros.length,
          status: 'concluido'
        }])

      setLastBackup(new Date())
      await loadBackupHistory()

      alert('✅ Backup realizado com sucesso!')

    } catch (error) {
      console.error('Erro ao fazer backup:', error)
      alert('❌ Erro ao fazer backup: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const generateCSV = (data, columns) => {
    if (!data || data.length === 0) return ''

    // Header
    let csv = columns.join(',') + '\n'

    // Rows
    data.forEach(row => {
      const values = columns.map(col => {
        let value = ''
        
        if (col === 'funcionario_nome') {
          value = row.funcionarios?.nome || ''
        } else if (col === 'categoria') {
          value = row.funcionarios?.categorias?.nome || row.categorias?.nome || ''
        } else {
          value = row[col] || ''
        }
        
        // Escapar vírgulas e aspas
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          value = `"${value.replace(/"/g, '""')}"`
        }
        
        return value
      })
      
      csv += values.join(',') + '\n'
    })

    return csv
  }

  const downloadCSV = (csvContent, filename) => {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    
    link.setAttribute('href', url)
    link.setAttribute('download', filename)
    link.style.visibility = 'hidden'
    
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Database size={28} className="text-purple-600" />
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Sistema de Backup</h2>
            <p className="text-sm text-gray-500">Backup automático e manual dos dados</p>
          </div>
        </div>
        
        <button
          onClick={() => performBackup(false)}
          disabled={loading}
          className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
              Gerando Backup...
            </>
          ) : (
            <>
              <Download size={20} />
              Fazer Backup Agora
            </>
          )}
        </button>
      </div>

      {/* Status do último backup */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <Clock size={24} className="text-blue-600" />
            <h3 className="font-semibold text-gray-800">Último Backup</h3>
          </div>
          <p className="text-lg font-bold text-blue-600">
            {lastBackup ? formatDate(lastBackup) : 'Nunca'}
          </p>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <Calendar size={24} className="text-green-600" />
            <h3 className="font-semibold text-gray-800">Backup Automático</h3>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={autoBackupEnabled}
              onChange={(e) => setAutoBackupEnabled(e.target.checked)}
              className="w-5 h-5 text-green-600 rounded"
            />
            <span className="text-sm text-gray-600">
              Ativado (diariamente às 18h)
            </span>
          </div>
        </div>
      </div>

      {/* Histórico de backups */}
      <div className="border-t pt-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Histórico de Backups</h3>
        
        {backupHistory.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <AlertCircle size={48} className="mx-auto mb-2 opacity-50" />
            <p>Nenhum backup realizado ainda</p>
          </div>
        ) : (
          <div className="space-y-2">
            {backupHistory.map((backup) => (
              <div
                key={backup.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <CheckCircle size={20} className="text-green-600" />
                  <div>
                    <p className="font-medium text-gray-800">
                      Backup {backup.tipo === 'automatico' ? 'Automático' : 'Manual'}
                    </p>
                    <p className="text-sm text-gray-500">
                      {backup.registros_count} registros • {formatDate(backup.created_at)}
                    </p>
                  </div>
                </div>
                
                <span className="text-xs px-3 py-1 bg-green-100 text-green-700 rounded-full font-medium">
                  {backup.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Informações importantes */}
      <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <div className="flex items-start gap-3">
          <AlertCircle size={20} className="text-yellow-600 mt-0.5" />
          <div className="text-sm text-gray-700">
            <p className="font-semibold mb-1">⚠️ Importante:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Backups são salvos no seu computador em formato CSV</li>
              <li>Guarde os arquivos em local seguro (Google Drive, Dropbox, etc)</li>
              <li>Backup automático acontece às 18h todos os dias</li>
              <li>Recomendado fazer backup manual antes de mudanças importantes</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export default BackupSystem
