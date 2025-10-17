import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Faltam as variáveis de ambiente do Supabase')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export const getCategorias = async () => {
  const { data, error } = await supabase
    .from('categorias')
    .select('*')
    .order('ordem', { ascending: true })  // ← ADICIONE
  
  if (error) throw error
  return data || []
}

export const createCategoria = async (nome) => {
  const { data, error } = await supabase.from('categorias').insert([{ nome }]).select().single()
  if (error) throw error
  return data
}

export const getFuncionarios = async () => {
  const { data, error } = await supabase.from('funcionarios').select('*, categorias(id, nome)').order('nome')
  if (error) throw error
  return data
}

export const createFuncionario = async (nome, categoriaId) => {
  const { data, error } = await supabase.from('funcionarios').insert([{ nome: nome.toUpperCase().trim(), categoria_id: categoriaId, ativo: true }]).select().single()
  if (error) throw error
  return data
}

export const transferFuncionario = async (funcionarioId, newCategoriaId) => {
  const { data, error } = await supabase.from('funcionarios').update({ categoria_id: newCategoriaId }).eq('id', funcionarioId).select().single()
  if (error) throw error
  return data
}

export const getRegistrosPonto = async (funcionarioId, ano, mes) => {
  const startDate = new Date(ano, mes, 1).toISOString().split('T')[0]
  const endDate = new Date(ano, mes + 1, 0).toISOString().split('T')[0]
  const { data, error } = await supabase.from('registros_ponto').select('*').eq('funcionario_id', funcionarioId).gte('data', startDate).lte('data', endDate)
  if (error) throw error
  return data
}

export const upsertRegistroPonto = async (record) => {
  const { data, error } = await supabase.from('registros_ponto').upsert(record, { onConflict: 'funcionario_id,data' }).select().single()
  if (error) throw error
  return data
}

export const getBancoHoras = async (funcionarioId, ano) => {
  const { data, error } = await supabase.from('banco_horas').select('*').eq('funcionario_id', funcionarioId).eq('ano', ano).order('mes')
  if (error) throw error
  return data
}

export const upsertBancoHoras = async (funcionarioId, ano, mes, saldoMinutos) => {
  const { data, error } = await supabase.from('banco_horas').upsert({ funcionario_id: funcionarioId, ano, mes, saldo_minutos: saldoMinutos }, { onConflict: 'funcionario_id,ano,mes' }).select().single()
  if (error) throw error
  return data
}

export const initializeDatabase = async () => {
  const defaultCategorias = ['Loja', 'Galpão', 'Desligados']
  for (const categoriaNome of defaultCategorias) {
    try {
      await createCategoria(categoriaNome)
    } catch (error) {
      if (error.code !== '23505' && error.status !== 409) {
        console.error('Erro ao criar categoria:', error)
      }
    }
  }
}
