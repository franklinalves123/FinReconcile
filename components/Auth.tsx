
import React, { useState } from 'react';
import { supabase } from '../lib/supabase.ts';
import { Button } from './ui/Button.tsx';
import { Mail, Lock, LogIn, AlertCircle } from 'lucide-react';

export const Auth: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const r = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await r.json().catch(() => ({} as any));

      if (!r.ok) {
        throw new Error(data?.error_description || data?.error || 'Falha no login');
      }
    } catch (err: any) {
      console.error("Erro de Auth:", err);
      setError('E-mail ou senha incorretos. Verifique suas credenciais.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-neutral-200 p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center text-white font-bold text-3xl mx-auto mb-4 shadow-lg">
            F
          </div>
          <h1 className="text-2xl font-bold text-neutral-900">FinReconcile AI</h1>
          <p className="text-neutral-500 mt-2 text-sm">Gestão inteligente de faturas</p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">E-mail</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
              <input
                type="email"
                required
                className="w-full pl-10 pr-4 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Senha</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
              <input
                type="password"
                required
                className="w-full pl-10 pr-4 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 text-[11px] p-3 rounded-lg flex items-center gap-2 border border-red-100">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" isLoading={loading}>
            <LogIn size={18} className="mr-2" /> Entrar no Sistema
          </Button>
        </form>

        <p className="mt-6 text-center text-[10px] text-neutral-400">
          Acesso restrito a usuários autorizados.
        </p>
      </div>
    </div>
  );
};
