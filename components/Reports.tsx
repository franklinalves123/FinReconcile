
import React, { useState, useMemo } from 'react';
import { Transaction, Category, Tag, InvoiceFile } from '../types.ts';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, AreaChart, Area, LineChart, Line
} from 'recharts';
import { 
  Filter, Calendar, Layers, Download, Search, X, 
  ArrowRightLeft, TrendingUp, TrendingDown, ChevronRight,
  PieChart as PieIcon, BarChart3, List, ArrowUpRight, ArrowDownRight,
  Tag as TagIcon
} from 'lucide-react';
import { Button } from './ui/Button.tsx';

interface ReportsProps {
  allTransactions: Transaction[];
  categories: Category[];
  tags: Tag[];
  files?: InvoiceFile[];
}

const COLORS = ['#0B5FFF', '#00C853', '#FFB300', '#FF8042', '#8884d8', '#EC4899', '#6366F1', '#14B8A6'];

export const Reports: React.FC<ReportsProps> = ({ allTransactions, categories, tags, files = [] }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCycle, setSelectedCycle] = useState<string>('all');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'visual' | 'table'>('visual');

  // Mapeia IDs de fatura para suas datas de importação (upload)
  const invoiceDateMap = useMemo(() => {
    const map: Record<string, string> = {};
    files.forEach(f => {
      const date = new Date(f.uploadDate);
      map[f.id] = date.toISOString().split('T')[0];
    });
    return map;
  }, [files]);

  // Função centralizada de Ciclo (Importação)
  const getCycleInfo = (t: Transaction) => {
    let refDateStr = '';
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

  // Lista de ciclos disponíveis para filtro
  const availableCycles = useMemo(() => {
    const set = new Set<string>();
    allTransactions.forEach(t => set.add(getCycleInfo(t).label));
    return Array.from(set).sort((a, b) => {
        const [mA, yA] = a.split('/');
        const [mB, yB] = b.split('/');
        return (parseInt(yB) * 100 + "JanFevMarAbrMaiJunJulAgoSetOutNovDez".indexOf(mB)/3) - 
               (parseInt(yA) * 100 + "JanFevMarAbrMaiJunJulAgoSetOutNovDez".indexOf(mA)/3);
    });
  }, [allTransactions]);

  // Dados filtrados por pesquisa, ciclo e TAG
  const filteredData = useMemo(() => {
    return allTransactions.filter(t => {
      const matchesSearch = searchTerm === '' || t.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCycle = selectedCycle === 'all' || getCycleInfo(t).label === selectedCycle;
      const matchesTag = selectedTag === 'all' || (t.tags && t.tags.includes(selectedTag));
      return matchesSearch && matchesCycle && matchesTag;
    });
  }, [allTransactions, searchTerm, selectedCycle, selectedTag]);

  // Estatísticas por Ciclo para o gráfico de evolução
  const cycleStats = useMemo(() => {
    const map: Record<string, { total: number, order: number }> = {};
    allTransactions.forEach(t => {
      // Aplicar filtro de tag no gráfico de evolução também se uma tag estiver selecionada
      if (selectedTag !== 'all' && (!t.tags || !t.tags.includes(selectedTag))) return;

      const { label, order } = getCycleInfo(t);
      if (!map[label]) map[label] = { total: 0, order };
      map[label].total += Number(t.amount || 0);
    });
    return Object.keys(map)
      .map(name => ({ name, total: map[name].total, order: map[name].order }))
      .sort((a, b) => a.order - b.order)
      .slice(-12); // Últimos 12 meses
  }, [allTransactions, selectedTag]);

  // Estatísticas por Categoria e Subcategoria (baseado no filtro atual)
  const categoryStats = useMemo(() => {
    const map: Record<string, { total: number, sub: Record<string, number> }> = {};
    filteredData.forEach(t => {
      if (!map[t.category]) map[t.category] = { total: 0, sub: {} };
      map[t.category].total += Number(t.amount || 0);
      const subName = t.subcategory || 'Sem Subcategoria';
      map[t.category].sub[subName] = (map[t.category].sub[subName] || 0) + Number(t.amount || 0);
    });

    return Object.keys(map)
      .map(name => ({
        name,
        total: map[name].total,
        subcategories: Object.keys(map[name].sub).map(s => ({ name: s, value: map[name].sub[s] })).sort((a,b) => b.value - a.value)
      }))
      .sort((a, b) => b.total - a.total);
  }, [filteredData]);

  const totals = useMemo(() => {
    const currentTotal = filteredData.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
    
    // Calcular comparativo se um ciclo estiver selecionado
    let variation = 0;
    if (selectedCycle !== 'all') {
        const cycleIndex = availableCycles.indexOf(selectedCycle);
        const prevCycle = availableCycles[cycleIndex + 1];
        if (prevCycle) {
            const prevTotal = allTransactions
                .filter(t => {
                  const matchesCycle = getCycleInfo(t).label === prevCycle;
                  const matchesTag = selectedTag === 'all' || (t.tags && t.tags.includes(selectedTag));
                  return matchesCycle && matchesTag;
                })
                .reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
            variation = prevTotal > 0 ? ((currentTotal - prevTotal) / prevTotal) * 100 : 0;
        }
    }

    return { total: currentTotal, variation };
  }, [filteredData, selectedCycle, availableCycles, allTransactions, selectedTag]);

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      {/* Header com Filtros */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100 space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 rounded-lg text-primary">
                    <PieIcon size={20}/>
                </div>
                <div>
                    <h3 className="font-bold text-neutral-800">Inteligência de Gastos</h3>
                    <p className="text-xs text-neutral-500">Analise seu comportamento financeiro detalhadamente.</p>
                </div>
            </div>
            <div className="flex flex-wrap gap-2 w-full md:w-auto">
                <div className="relative min-w-[140px]">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={14}/>
                    <select 
                        value={selectedCycle}
                        onChange={(e) => setSelectedCycle(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-medium outline-none focus:ring-1 focus:ring-primary appearance-none"
                    >
                        <option value="all">Período: Todos</option>
                        {availableCycles.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>

                <div className="relative min-w-[140px]">
                    <TagIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={14}/>
                    <select 
                        value={selectedTag}
                        onChange={(e) => setSelectedTag(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-medium outline-none focus:ring-1 focus:ring-primary appearance-none"
                    >
                        <option value="all">Tag: Todas</option>
                        {tags.map(tag => <option key={tag.id} value={tag.name}>{tag.name}</option>)}
                    </select>
                </div>

                <div className="relative flex-1 md:w-48 lg:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={14}/>
                    <input 
                        type="text" 
                        placeholder="Buscar transação..."
                        className="w-full pl-9 pr-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-sm outline-none focus:ring-1 focus:ring-primary"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex border border-neutral-200 rounded-xl overflow-hidden">
                    <button onClick={() => setViewMode('visual')} className={`p-2 ${viewMode === 'visual' ? 'bg-primary text-white' : 'bg-white text-neutral-400'}`}><BarChart3 size={18}/></button>
                    <button onClick={() => setViewMode('table')} className={`p-2 ${viewMode === 'table' ? 'bg-primary text-white' : 'bg-white text-neutral-400'}`}><List size={18}/></button>
                </div>
            </div>
        </div>
      </div>

      {/* Grid de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100 flex flex-col justify-between">
            <span className="text-[10px] font-black text-neutral-400 uppercase tracking-wider mb-2">Total no Período</span>
            <div className="flex items-baseline gap-2">
                <h4 className="text-3xl font-black text-neutral-900">
                    {totals.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </h4>
            </div>
            {selectedCycle !== 'all' && (
                <div className={`flex items-center gap-1 mt-4 text-xs font-bold ${totals.variation > 0 ? 'text-red-500' : 'text-secondary'}`}>
                    {totals.variation > 0 ? <ArrowUpRight size={14}/> : <ArrowDownRight size={14}/>}
                    {Math.abs(totals.variation).toFixed(1)}% vs ciclo anterior
                </div>
            )}
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100 md:col-span-2">
            <span className="text-[10px] font-black text-neutral-400 uppercase tracking-wider mb-4 block">Evolução de Gastos (Últimos 12 Meses)</span>
            <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={cycleStats}>
                        <defs>
                            <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#0B5FFF" stopOpacity={0.1}/>
                                <stop offset="95%" stopColor="#0B5FFF" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <Tooltip 
                            formatter={(value: any) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                        />
                        <Area type="monotone" dataKey="total" stroke="#0B5FFF" strokeWidth={3} fillOpacity={1} fill="url(#colorTotal)" />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
      </div>

      {viewMode === 'visual' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Detalhe por Categoria */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100">
                <div className="flex justify-between items-center mb-6">
                    <h4 className="text-sm font-bold text-neutral-800 flex items-center gap-2">
                        <Layers size={16} className="text-primary"/> Distribuição por Categorias
                    </h4>
                </div>
                <div className="space-y-6">
                    {categoryStats.length === 0 ? (
                      <div className="h-40 flex flex-col items-center justify-center text-neutral-400 gap-2">
                         <X size={24}/>
                         <p className="text-xs">Nenhum dado encontrado para os filtros.</p>
                      </div>
                    ) : (
                      categoryStats.map((cat, i) => (
                        <div key={cat.name} className="group">
                            <div className="flex justify-between items-end mb-2">
                                <div>
                                    <span className="text-xs font-bold text-neutral-800">{cat.name}</span>
                                    <span className="text-[10px] text-neutral-400 ml-2">({((cat.total / (totals.total || 1)) * 100).toFixed(0)}%)</span>
                                </div>
                                <span className="text-sm font-black text-neutral-900">{cat.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                            </div>
                            <div className="w-full bg-neutral-100 h-2 rounded-full overflow-hidden">
                                <div 
                                    className="h-full rounded-full transition-all duration-1000 group-hover:brightness-110" 
                                    style={{ 
                                        width: `${(cat.total / Math.max(...categoryStats.map(c => c.total))) * 100}%`,
                                        backgroundColor: COLORS[i % COLORS.length]
                                    }}
                                ></div>
                            </div>
                            {/* Subcategorias Drill-down */}
                            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                {cat.subcategories.slice(0, 4).map(sub => (
                                    <div key={sub.name} className="flex justify-between items-center text-[10px]">
                                        <span className="truncate max-w-[100px]">{sub.name}</span>
                                        <span className="font-bold">{sub.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                      ))
                    )}
                </div>
            </div>

            {/* Comparativo de Categoria (Gráfico de Barras) */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100">
                <h4 className="text-sm font-bold text-neutral-800 mb-6 flex items-center gap-2">
                    <BarChart3 size={16} className="text-primary"/> Ranking de Gastos
                </h4>
                <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={categoryStats} layout="vertical" margin={{ left: 40 }}>
                            <XAxis type="number" hide />
                            <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700 }} />
                            <Tooltip 
                                cursor={{ fill: 'transparent' }}
                                formatter={(value: any) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            />
                            <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                                {categoryStats.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
      ) : (
        /* Modo Tabela Detalhada */
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-50 bg-neutral-50/50 flex justify-between items-center">
                <h4 className="text-sm font-bold text-neutral-800">Listagem Analítica</h4>
                <Button variant="outline" size="sm" onClick={() => window.print()}>
                    <Download size={14} className="mr-2"/> Exportar PDF
                </Button>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-neutral-50 text-[10px] uppercase font-black text-neutral-400 tracking-tighter">
                            <th className="px-6 py-4">Data</th>
                            <th className="px-6 py-4">Descrição</th>
                            <th className="px-6 py-4">Categoria</th>
                            <th className="px-6 py-4">Subcategoria</th>
                            <th className="px-6 py-4">Tags</th>
                            <th className="px-6 py-4 text-right">Valor</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-50">
                        {filteredData.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-6 py-20 text-center text-neutral-400 italic text-sm">Nenhum lançamento encontrado para os filtros aplicados.</td>
                          </tr>
                        ) : (
                          filteredData.slice(0, 100).map((t) => (
                              <tr key={t.id} className="hover:bg-neutral-50/50 transition-colors">
                                  <td className="px-6 py-3 text-xs text-neutral-500 font-medium">
                                      {new Date(t.purchaseDate).toLocaleDateString('pt-BR')}
                                  </td>
                                  <td className="px-6 py-3 text-sm font-bold text-neutral-800 truncate max-w-[200px]">
                                      {t.description}
                                  </td>
                                  <td className="px-6 py-3">
                                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-primary uppercase">
                                          {t.category}
                                      </span>
                                  </td>
                                  <td className="px-6 py-3 text-xs text-neutral-400">
                                      {t.subcategory || '-'}
                                  </td>
                                  <td className="px-6 py-3">
                                      <div className="flex flex-wrap gap-1">
                                        {t.tags?.map(tag => (
                                          <span key={tag} className="text-[8px] bg-neutral-100 px-1.5 py-0.5 rounded font-bold text-neutral-500 uppercase">
                                            {tag}
                                          </span>
                                        ))}
                                      </div>
                                  </td>
                                  <td className="px-6 py-3 text-right font-black text-neutral-900">
                                      {t.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                  </td>
                              </tr>
                          ))
                        )}
                    </tbody>
                </table>
                {filteredData.length > 100 && (
                    <div className="p-4 text-center text-xs text-neutral-400 italic">
                        Mostrando os 100 primeiros lançamentos encontrados...
                    </div>
                )}
            </div>
        </div>
      )}
    </div>
  );
};
