export const timeToMinutes = (timeStr) => {
  if (!timeStr || timeStr === '-') return 0
  
  // Verificar se é negativo
  const isNegative = timeStr.startsWith('-')
  
  // Remover o sinal negativo para processar
  const cleanTime = timeStr.replace('-', '')
  
  const [hours, minutes] = cleanTime.split(':').map(Number)
  const totalMinutes = (hours * 60) + (minutes || 0)
  
  // Retornar com o sinal correto
  return isNegative ? -totalMinutes : totalMinutes
}

export const minutesToTime = (minutes) => {
  if (minutes === 0) return '-'
  const isNegative = minutes < 0
  const absMinutes = Math.abs(minutes)
  const hours = Math.floor(absMinutes / 60)
  const mins = absMinutes % 60
  return `${isNegative ? '-' : ''}${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}

export const calculateWorkedHours = (record) => {
  if (!record || record.tipo === 'folga') return 0
  
  const entrada = timeToMinutes(record.entrada_manha)  // ← CORRIGIDO
  const saidaAlmoco = timeToMinutes(record.saida_almoco)
  const retornoAlmoco = timeToMinutes(record.retorno_almoco)
  const saida = timeToMinutes(record.saida_tarde)  // ← CORRIGIDO
  
  // Se só trabalhou até o almoço
  if (entrada && saidaAlmoco && !retornoAlmoco && !saida) {
    return saidaAlmoco - entrada
  }
  
  // Se trabalhou sem pausa de almoço
  if (entrada && saida && !saidaAlmoco && !retornoAlmoco) {
    return saida - entrada
  }
  
  // Se não tiver todos os horários, retorna 0
  if (!entrada || !saidaAlmoco || !retornoAlmoco || !saida) return 0
  
  // Cálculo normal: (manhã) + (tarde)
  return (saidaAlmoco - entrada) + (saida - retornoAlmoco)
}

export const getExpectedWorkHours = (isSaturday, isSunday, tipo) => {
  if (isSunday) return 0
  if (tipo === 'folga') return 0
  if (tipo === 'feriado') return 0
  if (isSaturday) return 240  // 4 horas = 240 minutos
  return 480  // 8 horas = 480 minutos (dias normais)
}

export const calculateDelay = (worked, expected) => {
  if (worked >= expected) return 0
  return expected - worked
}

export const calculateOvertime = (worked, isSaturday = false) => {
  let faixa1 = 0
  let faixa2 = 0
  
  if (isSaturday) {
    // SÁBADO: Lógica especial
    // 0 a 4h (240min) = conta como atraso
    // 4h a 8h (240-480min) = conta normalmente
    // 8h+ (480min+) = hora extra normal
    
    if (worked <= 240) {
      // Até 8 horas: sem hora extra
      return { faixa1: 0, faixa2: 0 }
    } else {
      // Acima de 8h: começa a contar hora extra
      const overtime = worked - 240
      faixa1 = Math.min(overtime, 120) // Primeiras 2h extras (150%)
      faixa2 = Math.max(0, overtime - 120) // Acima de 2h extras (200%)
    }
  } else {
    // DIAS NORMAIS: Acima de 8 horas (480 minutos)
    if (worked <= 480) return { faixa1: 0, faixa2: 0 }
    
    const overtime = worked - 480
    faixa1 = Math.min(overtime, 120) // Primeiras 2h extras (150%)
    faixa2 = Math.max(0, overtime - 120) // Acima de 2h extras (200%)
  }
  
  return { faixa1, faixa2 }
}

export const hasShortLunch = (record) => {
  if (!record || !record.saida_almoco || !record.retorno_almoco) return false
  const intervalo = timeToMinutes(record.retorno_almoco) - timeToMinutes(record.saida_almoco)
  return intervalo > 0 && intervalo < 60
}

export const generateMonthDays = (year, month) => {
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const days = []
  const weekDays = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day)
    const dayOfWeek = date.getDay()
    days.push({
      day,
      weekDay: weekDays[dayOfWeek],
      dateKey: `${year}-${month}-${day}`,
      date: new Date(year, month, day).toISOString().split('T')[0],
      isSunday: dayOfWeek === 0,
      isSaturday: dayOfWeek === 6
    })
  }
  return days
}

export const months = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO']
