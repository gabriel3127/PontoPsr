import React, { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Download, Database, AlertCircle } from 'lucide-react'

function BackupSystem() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const performBackup = async () => {
    setLoading(true)
    setMessage('')
    
    try {
      // 1. Buscar todos os dados para backup
      const { data: registros, error: regError } = await supabase
        .from('registros_ponto')
        .select(`
          *,
          funcionarios (
            nome,
            email,
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

      // 2. Gerar CSVs
      const timestamp = new Date().toISOString().split('T')[0]
      
      // CSV Registros de Ponto
      const csvRegistros = generateCSVRegistros(registros)
      downloadCSV(csvRegistros, `backup_registros_${timestamp}.csv`)
      
      // CSV Banco de Horas (com delay)
      setTimeout(() => {
        const csvBancoHoras = generateCSVBancoHoras(bancoHoras)
        downloadCSV(csvBancoHoras, `backup_banco_horas_${timestamp}.csv`)
      }, 500)
      
      // CSV Funcionários (com delay)
      setTimeout(() => {
        const csvFuncionarios = generateCSVFuncionarios(funcionarios)
        downloadCSV(csvFuncionarios, `backup_funcionarios_${timestamp}.csv`)
      }, 1000)

      setMessage(`✅ Backup realizado com sucesso! ${registros.length} registros exportados.`)

    } catch (error) {
      console.error('Erro ao fazer backup:', error)
      setMessage('❌ Erro ao fazer backup: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const generateCSVRegistros = (data) => {
    if (!data || data.length === 0) return 'Nenhum registro encontrado'

    let csv = 'Data,Funcionário,Categoria,Entrada,Saída Almoço,Retorno Almoço,Saída,Horas Trabalhadas,Tipo,Observações\n'

    data.forEach(row => {
      const funcionarioNome = row.funcionarios?.nome || 'N/A'
      const categoria = row.funcionarios?.categorias?.nome || 'N/A'
      
      csv += [
        row.data || '',
        funcionarioNome,
        categoria,
        row.entrada_manha || '',
        row.saida_almoco || '',
        row.retorno_almoco || '',
        row.saida_tarde || '',
        row.horas_trabalhadas || '',
        row.tipo_dia || 'normal',
        row.observacoes || ''
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',') + '\n'
    })

    return csv
  }

  const generateCSVBancoHoras = (data) => {
    if (!data || data.length === 0) return 'Nenhum registro encontrado'

    let csv = 'Funcionário,Ano,Mês,Saldo (minutos),Saldo (horas)\n'

    data.forEach(row => {
      const funcionarioNome = row.funcionarios?.nome || 'N/A'
      const saldoHoras = minutesToTime(row.saldo_minutos || 0)
      
      csv += [
        funcionarioNome,
        row.ano || '',
        row.mes || '',
        row.saldo_minutos || 0,
        saldoHoras
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',') + '\n'
    })

    return csv
  }

  const generateCSVFuncionarios = (data) => {
    if (!data || data.length === 0) return 'Nenhum funcionário encontrado'

    let csv = 'Nome,Email,Categoria,Tipo,Ativo\n'

    data.forEach(row => {
      const categoria = row.categorias?.nome || 'N/A'
      
      csv += [
        row.nome || '',
        row.email || '',
        categoria,
        row.tipo_usuario || 'funcionario',
        row.ativo ? 'Sim' : 'Não'
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',') + '\n'
    })

    return csv
  }

  const minutesToTime = (minutes) => {
    const isNegative = minutes < 0
    const absMinutes = Math.abs(minutes)
    const hours = Math.floor(absMinutes / 60)
    const mins = absMinutes % 60
    return `${isNegative ? '-' : ''}${hours}h${mins.toString().padStart(2, '0')}`
  }

  const downloadCSV = (csvContent, filename) => {
    const BOM = '\uFEFF' // UTF-8 BOM para Excel reconhecer acentos
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    
    link.setAttribute('href', url)
    link.setAttribute('download', filename)
    link.style.visibility = 'hidden'
    
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Database size={32} className="text-purple-600" />
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Sistema de Backup</h2>
            <p className="text-sm text-gray-500">Exportar dados em formato CSV</p>
          </div>
        </div>
      </div>

      {/* Card de ação */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-lg p-8 text-center">
        <Database size={64} className="mx-auto text-purple-600 mb-4" />
        <h3 className="text-xl font-bold text-gray-800 mb-2">
          Fazer Backup dos Dados
        </h3>
        <p className="text-gray-600 mb-6">
          Exporta todos os registros de ponto, banco de horas e funcionários em arquivos CSV
        </p>
        
        <button
          onClick={performBackup}
          disabled={loading}
          className="flex items-center gap-2 px-8 py-4 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed mx-auto"
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

        {message && (
          <div className={`mt-4 p-4 rounded-lg ${
            message.includes('✅') 
              ? 'bg-green-100 text-green-700 border border-green-300' 
              : 'bg-red-100 text-red-700 border border-red-300'
          }`}>
            {message}
          </div>
        )}
      </div>

      {/* Informações */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-gray-800 mb-2">📊 Registros de Ponto</h4>
          <p className="text-sm text-gray-600">
            Todos os lançamentos de entrada/saída dos funcionários
          </p>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h4 className="font-semibold text-gray-800 mb-2">⏰ Banco de Horas</h4>
          <p className="text-sm text-gray-600">
            Saldo de horas acumuladas de cada funcionário
          </p>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <h4 className="font-semibold text-gray-800 mb-2">👥 Funcionários</h4>
          <p className="text-sm text-gray-600">
            Cadastro completo de todos os funcionários
          </p>
        </div>
      </div>

      {/* Avisos importantes */}
      <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <div className="flex items-start gap-3">
          <AlertCircle size={20} className="text-yellow-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-gray-700">
            <p className="font-semibold mb-2">⚠️ Recomendações Importantes:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Faça backup regularmente (semanal ou quinzenal)</li>
              <li>Guarde os arquivos em local seguro (Google Drive, Dropbox, etc)</li>
              <li>Sempre faça backup antes de fazer mudanças importantes</li>
              <li>Os arquivos CSV podem ser abertos no Excel ou Google Sheets</li>
              <li>Mantenha pelo menos os últimos 3 meses de backups</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Instruções */}
      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start gap-3">
          <div className="text-blue-600 font-bold text-xl flex-shrink-0">💡</div>
          <div className="text-sm text-gray-700">
            <p className="font-semibold mb-2">Como usar o backup:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Clique no botão "Fazer Backup Agora"</li>
              <li>Aguarde o download de 3 arquivos CSV</li>
              <li>Salve os arquivos em uma pasta organizada (ex: "Backups_2025")</li>
              <li>Envie os arquivos para sua nuvem preferida</li>
              <li>Repita o processo regularmente</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}

export default BackupSystem