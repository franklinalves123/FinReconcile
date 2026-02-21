
import { createClient } from '@supabase/supabase-js';

/**
 * CONFIGURAÇÃO DE CONEXÃO SUPABASE
 * Lê credenciais de variáveis de ambiente Vite (.env.local — não versionado).
 * A anon key é pública por design; o RLS do Supabase garante isolamento de dados.
 * Copie .env.local.example para .env.local e preencha os valores.
 */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// Lógica resiliente para inicialização
const initSupabase = () => {
  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
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
