
import { createClient } from '@supabase/supabase-js';

/**
 * CONFIGURAÇÃO DE CONEXÃO SUPABASE
 * Dados inseridos conforme fornecido pelo usuário.
 */
const SUPABASE_URL = 'https://neyioqyyfefgioqgcyvq.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5leWlvcXl5ZmVmZ2lvcWdjeXZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYyMzI5NDEsImV4cCI6MjA4MTgwODk0MX0.yh_sPFk3oDmVNaSQ5gBeiOyMOUtOrMU9-zT2Ax9VHIM';

// Lógica resiliente para inicialização
const initSupabase = () => {
  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || SUPABASE_URL.includes('SUA_URL')) {
      console.warn("Supabase não configurado ou chaves pendentes.");
      return null;
    }
    return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } catch (err) {
    console.error("Falha ao inicializar Supabase client:", err);
    return null;
  }
};

const client = initSupabase();

// Mock para evitar crash se o cliente falhar
export const supabase = client || ({
  auth: {
    getSession: () => Promise.resolve({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signInWithPassword: () => Promise.reject(new Error("Configuração ausente.")),
    signOut: () => Promise.resolve({ error: null })
  },
  from: () => ({
    select: () => ({ order: () => Promise.resolve({ data: [], error: null }), eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }),
    insert: () => Promise.resolve({ error: null }),
    upsert: () => Promise.resolve({ error: null })
  })
} as any);

export const checkSupabaseConfig = () => !!client;
