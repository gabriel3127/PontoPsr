import React from 'react'
import { Clock, Calendar, User, X, Check, AlertTriangle } from 'lucide-react'

function ConfirmationModal({ isOpen, onClose, onConfirm, data, loading, confirmationData }) {
  // ============================================================================
  // PROTEÇÃO: Aceita tanto 'data' quanto 'confirmationData' para compatibilidade
  // ============================================================================
  if (!isOpen) return null
  
  // Usa confirmationData se existir, senão usa data
  const modalData = confirmationData || data
  
  // Se não tem nenhum dos dois, não renderiza
  if (!modalData) return null

  const getTipoColor = (tipo) => {
    const colors = {
      'entrada': 'bg-green-100 text-green-800 border-green-300',
      'saida_almoco': 'bg-yellow-100 text-yellow-800 border-yellow-300',
      'retorno_almoco': 'bg-blue-100 text-blue-800 border-blue-300',
      'saida': 'bg-red-100 text-red-800 border-red-300'
    }
    return colors[tipo] || 'bg-gray-100 text-gray-800 border-gray-300'
  }

  const getTipoLabel = (tipo) => {
    const labels = {
      'entrada': 'CHECK-IN',
      'saida_almoco': 'SAÍDA PARA ALMOÇO',
      'retorno_almoco': 'RETORNO DO ALMOÇO',
      'saida': 'CHECK-OUT'
    }
    return labels[tipo] || tipo
  }

  const getTipoIcon = (tipo) => {
    const icons = {
      'entrada': '🌅',
      'saida_almoco': '☕',
      'retorno_almoco': '🍽️',
      'saida': '🌆'
    }
    return icons[tipo] || '⏰'
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white rounded-lg shadow-2xl max-w-md w-full animate-scaleIn">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white p-6 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-white bg-opacity-20 p-2 rounded-full">
                <Clock className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold">Confirmar Registro</h2>
            </div>
            <button
              onClick={onClose}
              disabled={loading}
              className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-full transition-colors disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Alerta */}
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-yellow-800 font-medium">
                Verifique os dados antes de confirmar
              </p>
              <p className="text-xs text-yellow-700 mt-1">
                Este registro será salvo permanentemente
              </p>
            </div>
          </div>

          {/* Dados do Registro */}
          <div className="space-y-3">
            {/* Funcionário */}
            <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
              <User className="w-5 h-5 text-purple-600 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500 font-medium">Funcionário</p>
                <p className="text-sm font-bold text-gray-800 truncate">
                  {modalData.funcionarioNome || 'Funcionário'}
                </p>
              </div>
            </div>

            {/* Data */}
            <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
              <Calendar className="w-5 h-5 text-purple-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs text-gray-500 font-medium">Data</p>
                <p className="text-sm font-bold text-gray-800">
                  {modalData.diaSemana && `${modalData.diaSemana}, `}
                  {modalData.dataFormatada || new Date().toLocaleDateString('pt-BR')}
                </p>
              </div>
            </div>

            {/* Horário - Destaque especial */}
            <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg border-2 border-purple-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Clock className="w-6 h-6 text-purple-600" />
                  <div>
                    <p className="text-xs text-purple-600 font-medium">Horário</p>
                    <p className="text-3xl font-bold text-purple-900">
                      {modalData.hora || '--:--'}
                    </p>
                  </div>
                </div>
                <div className="text-4xl">
                  {getTipoIcon(modalData.tipo)}
                </div>
              </div>
            </div>

            {/* Tipo de Registro */}
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 font-medium mb-2">Tipo de Registro</p>
              <div className={`inline-block px-4 py-2 rounded-full font-bold border-2 ${getTipoColor(modalData.tipo)}`}>
                {getTipoLabel(modalData.tipo)}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 rounded-b-lg flex space-x-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-lg font-bold hover:bg-gray-100 transition-colors flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X className="w-5 h-5" />
            <span>Cancelar</span>
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 px-4 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg font-bold hover:from-green-700 hover:to-green-800 transition-colors flex items-center justify-center space-x-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Salvando...</span>
              </>
            ) : (
              <>
                <Check className="w-5 h-5" />
                <span>Confirmar</span>
              </>
            )}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
        .animate-scaleIn {
          animation: scaleIn 0.2s ease-out;
        }
      `}</style>
    </div>
  )
}

export default ConfirmationModal