
import React, { useState, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import { CheckCircle, TrendingUp, Calendar, CreditCard, ExternalLink, ArrowRightLeft, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { InvoiceFile, Transaction } from '../types.ts';
import { Button } from './ui/Button.tsx';

interface DashboardProps {
  files: InvoiceFile[];
  allTransactions: Transaction[];
  onNavigate: (view: any) => void;
}

const COLORS = ['#0B5FFF', '#00C853', '#FFB300', '#FF8042', '#8884d8', '#EC4899', '#6366F1'];

export const Dashboard: React.FC<DashboardProps> = ({ files, allTransactions, onNavigate }) => {
  const [viewMode, setViewMode] = useState<'cycle' | 'calendar'>('cycle');

  // Mapeia IDs de fatura para suas datas de importação (upload)
  const invoiceDateMap = useMemo(() => {
    const map: Record<string, string> = {};
    files.forEach(f => {
      if (f.id) {
        const date = new Date(f.uploadDate);
        map[f.id] = date.toISOString().split('T')[0];
      }
    });
    return map;
  }, [files]);

  // Função central: Determina o Ciclo baseado EXCLUSIVAMENTE na Data de Importação
  const getCycleInfo = (t: Transaction) => {
    let refDateStr = '';
    
    // Regra: Se tem fatura, manda a data de importação. Se for manual, manda a data da compra.
    if (t.invoiceId && invoiceDateMap[t.invoiceId]) {
      refDateStr = invoiceDateMap[t.invoiceId];
    } else {
      refDateStr = t.purchaseDate || t.date;
    }

    if (!refDateStr) return { label: 'Sem Ciclo', order: 0 };

    const refDate = new Date(refDateStr);
    const month = refDate.getUTCMonth();
    const year = refDate.getUTCFullYear();

    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return {
      label: `${monthNames[month]}/${year.toString().slice(-2)}`,
      order: year * 100 + month
    };
  };

  // Agrupamento por Ciclo de Importação/Pagamento
  const cycleData = useMemo(() => {
    const map: Record<string, { total: number, order: number }> = {};
    
    allTransactions.forEach(t => {
      const { label, order } = getCycleInfo(t);
      if (!map[label]) map[label] = { total: 0, order };
      map[label].total += Number(t.amount || 0);
    });

    return Object.keys(map)
      .map(key => ({ name: key, valor: map[key].total, order: map[key].order }))
      .sort((a, b) => a.order - b.order)
      .slice(-6);
  }, [allTransactions, invoiceDateMap]);

  const stats = useMemo(() => {
    const currentCycleLabel = cycleData[cycleData.length - 1]?.name || '';
    const filtered = allTransactions.filter(t => getCycleInfo(t).label === currentCycleLabel);
    
    const totalSpend = filtered.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
    const catMap: Record<string, number> = {};
    filtered.forEach(t => {
        catMap[t.category] = (catMap[t.category] || 0) + (Number(t.amount) || 0);
    });
    
    const categoryBreakdown = Object.keys(catMap).map(key => ({
        name: key,
        value: catMap[key]
    })).sort((a,b) => b.value - a.value);

    return {
        totalSpend,
        currentCycleLabel,
        categoryBreakdown
    };
  }, [allTransactions, cycleData]);

  const trend = useMemo(() => {
    if (cycleData.length < 2) return null;
    const current = cycleData[cycleData.length - 1].valor;
    const previous = cycleData[cycleData.length - 2].valor;
    const diff = ((current - previous) / previous) * 100;
    return {
      percent: Math.abs(diff).toFixed(1),
      isUp: diff > 0
    };
  }, [cycleData]);

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-4 rounded-xl border border-neutral-100 shadow-sm">
         <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg text-primary">
              <ArrowRightLeft size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-neutral-800">Ciclos de Pagamento</h2>
              <p className="text-neutral-500 text-xs">Gastos consolidados pela data de importação das faturas.</p>
            </div>
         </div>
         <div className="px-4 py-1.5 text-[10px] font-bold rounded-md bg-primary/10 text-primary uppercase border border-primary/20">
           Regra: Data de Importação
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-neutral-100 flex flex-col ring-1 ring-blue-50">
          <span className="text-neutral-500 text-[10px] font-bold uppercase mb-2 flex items-center gap-2"><TrendingUp size={14} /> Ciclo Atual ({stats.currentCycleLabel})</span>
          <span className="text-3xl font-black text-neutral-900">{stats.totalSpend.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
          {trend && (
            <div className={`flex items-center gap-1 mt-2 text-[10px] font-bold uppercase ${trend.isUp ? 'text-red-500' : 'text-secondary'}`}>
              {trend.isUp ? <ArrowUpRight size={14}/> : <ArrowDownRight size={14}/>}
              {trend.percent}% vs ciclo anterior
            </div>
          )}
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-sm border border-neutral-100 flex flex-col">
          <span className="text-neutral-500 text-[10px] font-bold uppercase mb-2 flex items-center gap-2"><CheckCircle size={14} /> Faturas Ativas</span>
          <span className="text-3xl font-black text-neutral-900">{files.length}</span>
          <div className="w-full bg-neutral-100 rounded-full h-1.5 mt-3">
            <div className="bg-secondary h-1.5 rounded-full transition-all duration-500" style={{ width: '100%' }}></div>
          </div>
        </div>

        <div onClick={() => onNavigate('/invoices')} className="bg-white p-6 rounded-xl shadow-sm border border-neutral-100 flex flex-col cursor-pointer hover:border-primary transition-all group">
          <div className="flex justify-between items-start">
            <span className="text-neutral-500 text-[10px] font-bold uppercase mb-2 flex items-center gap-2">
              <CreditCard size={14} /> Gestão
            </span>
            <ExternalLink size={14} className="text-neutral-300 group-hover:text-primary transition-colors" />
          </div>
          <p className="text-[10px] text-primary font-bold mt-2 hover:underline uppercase">Faturas Importadas &rarr;</p>
        </div>

        <div className="bg-white p-2 rounded-xl shadow-sm border border-neutral-100">
           <button onClick={() => onNavigate('/upload')} className="bg-primary text-white w-full h-full rounded-lg flex flex-col items-center justify-center gap-1 hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100">
              <span className="text-xl font-bold">+</span>
              <span className="font-bold text-[10px] uppercase">Nova Importação</span>
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-neutral-100">
            <h3 className="text-sm font-bold text-neutral-900 mb-6 flex items-center gap-2">
              <TrendingUp size={16} className="text-primary"/> Evolução Mensal (Ciclos de Importação)
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cycleData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#Eef0F5" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9AA4B2', fontSize: 10}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#9AA4B2', fontSize: 10}} />
                  <Tooltip 
                    cursor={{fill: '#F6F7FB'}}
                    formatter={(value) => Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                  />
                  <Bar dataKey="valor" radius={[6, 6, 0, 0]}>
                    {cycleData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === cycleData.length - 1 ? '#0B5FFF' : '#DDE2EA'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-neutral-100 h-fit">
          <h3 className="text-sm font-bold text-neutral-900 mb-6">Categorias (Ciclo Atual)</h3>
          <div className="h-64 relative">
             <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={stats.categoryBreakdown.slice(0, 6)} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {stats.categoryBreakdown.slice(0, 6).map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                </Pie>
                <Tooltip formatter={(value) => Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-6 space-y-3">
            {stats.categoryBreakdown.slice(0, 5).map((cat, i) => (
               <div key={i} className="flex justify-between items-center text-[11px] pb-2 border-b border-neutral-50 last:border-0">
                   <div className="flex items-center gap-2">
                     <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i] }}></div>
                     <span className="text-neutral-600 font-medium truncate max-w-[120px]">{cat.name}</span>
                   </div>
                   <span className="font-black text-neutral-900">{cat.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
               </div>
            ))}
          </div>
          <Button variant="outline" size="sm" className="w-full mt-6 text-[10px] font-bold uppercase" onClick={() => onNavigate('/reports')}>
            Relatório Detalhado
          </Button>
        </div>
      </div>
    </div>
  );
};
