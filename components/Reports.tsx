
import React, { useState, useMemo } from 'react';
import { Transaction, Category, Tag, InvoiceFile } from '../types.ts';
import { buildInvoiceDateMap, getCycleInfo } from '../lib/cycleUtils.ts';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, AreaChart, Area, LineChart, Line
} from 'recharts';
import {
  Filter, Calendar, Layers, Download, Search, X,
  ArrowRightLeft, TrendingUp, TrendingDown, ChevronRight,
  PieChart as PieIcon, BarChart3, List, ArrowUpRight, ArrowDownRight,
  Tag as TagIcon, Pencil, Save, Check
} from 'lucide-react';
import { Button } from './ui/Button.tsx';
import { signedAmount } from '../services/dataService.ts';

interface ReportsProps {
  allTransactions: Transaction[];
  categories: Category[];
  tags: Tag[];
  files?: InvoiceFile[];
  onUpdateTransaction?: (t: Transaction) => Promise<void>;
}

const COLORS = ['#0B5FFF', '#00C853', '#FFB300', '#FF8042', '#8884d8', '#EC4899', '#6366F1', '#14B8A6'];

export const Reports: React.FC<ReportsProps> = ({ allTransactions, categories, tags, files = [], onUpdateTransaction }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCycle, setSelectedCycle] = useState<string>('all');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'visual' | 'table'>('visual');

  // Painel lateral de categoria
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [panelSearch, setPanelSearch] = useState('');
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

  const toggleCheck = (id: string) =>
    setCheckedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const openPanel = (catName: string) => {
    setOpenCategory(catName);
    setPanelSearch('');
    setCheckedIds(new Set());
    setEditingTx(null);
  };

  // Edição inline de transação
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [editCat, setEditCat] = useState('');
  const [editSub, setEditSub] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [savingTx, setSavingTx] = useState(false);

  const startEdit = (t: Transaction) => {
    setEditingTx(t);
    setEditCat(t.category || '');
    setEditSub(t.subcategory || '');
    setEditTags(t.tags || []);
  };

  const handleSaveTx = async () => {
    if (!editingTx || !onUpdateTransaction) return;
    setSavingTx(true);
    try {
      await onUpdateTransaction({ ...editingTx, category: editCat, subcategory: editSub, tags: editTags });
      setEditingTx(null);
    } finally {
      setSavingTx(false);
    }
  };

  const toggleEditTag = (tag: string) =>
    setEditTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);

  const invoiceDateMap = useMemo(() => buildInvoiceDateMap(files), [files]);

  // Lista de ciclos disponíveis para filtro
  const availableCycles = useMemo(() => {
    const set = new Set<string>();
    allTransactions.forEach(t => set.add(getCycleInfo(t, invoiceDateMap).label));
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
      const matchesCycle = selectedCycle === 'all' || getCycleInfo(t, invoiceDateMap).label === selectedCycle;
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

      const { label, order } = getCycleInfo(t, invoiceDateMap);
      if (!map[label]) map[label] = { total: 0, order };
      map[label].total += signedAmount(t);
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
      // Receita não é gasto: fora da quebra por categoria, igual ao Dashboard.
      if (t.type === 'income') return;
      if (!map[t.category]) map[t.category] = { total: 0, sub: {} };
      map[t.category].total += signedAmount(t);
      // Usa o valor da string diretamente (incluindo sugestões da IA não cadastradas oficialmente).
      // Só cai em 'Sem Subcategoria' se o campo estiver vazio ou nulo.
      const subName = t.subcategory?.trim() || 'Sem Subcategoria';
      map[t.category].sub[subName] = (map[t.category].sub[subName] || 0) + signedAmount(t);
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
    const currentTotal = filteredData.reduce((acc, t) => acc + signedAmount(t), 0);
    
    // Calcular comparativo se um ciclo estiver selecionado
    let variation = 0;
    if (selectedCycle !== 'all') {
        const cycleIndex = availableCycles.indexOf(selectedCycle);
        const prevCycle = availableCycles[cycleIndex + 1];
        if (prevCycle) {
            const prevTotal = allTransactions
                .filter(t => {
                  const matchesCycle = getCycleInfo(t, invoiceDateMap).label === prevCycle;
                  const matchesTag = selectedTag === 'all' || (t.tags && t.tags.includes(selectedTag));
                  return matchesCycle && matchesTag;
                })
                .reduce((acc, t) => acc + signedAmount(t), 0);
            variation = prevTotal > 0 ? ((currentTotal - prevTotal) / prevTotal) * 100 : 0;
        }
    }

    return { total: currentTotal, variation };
  }, [filteredData, selectedCycle, availableCycles, allTransactions, selectedTag]);

  const filteredTotal = useMemo(
    () => filteredData.reduce((s, t) => s + signedAmount(t), 0),
    [filteredData]
  );

  const handleExportCSV = () => {
    const rows = filteredData.map(t => [
      t.purchaseDate || t.date || '',
      `"${(t.description || '').replace(/"/g, '""')}"`,
      t.cardIssuer || '',
      t.amount.toFixed(2).replace('.', ','),
      t.category || '',
      t.subcategory || '',
      // Coluna nova no FIM: preserva a posição e o significado das anteriores.
      // `Valor` continua magnitude positiva; o sinal quem diz é `Tipo`.
      t.type === 'refund' ? 'Estorno' : t.type === 'income' ? 'Receita' : 'Despesa'
    ].join(';'));
    const csv = ['Data;Descrição;Banco;Valor;Categoria;Subcategoria;Tipo', ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finreconcile-${selectedCycle === 'all' ? 'todos' : selectedCycle}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
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

        {/* Top Categoria */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100 flex flex-col justify-between">
            <span className="text-[10px] font-black text-neutral-400 uppercase tracking-wider mb-2">Top Categoria</span>
            {categoryStats.length > 0 ? (
              <>
                <div>
                  <h4 className="text-xl font-black text-neutral-900 truncate">{categoryStats[0].name}</h4>
                  <p className="text-sm font-bold text-primary mt-1">
                    {categoryStats[0].total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                </div>
                <div className="mt-4 text-xs text-neutral-400">
                  {((categoryStats[0].total / (totals.total || 1)) * 100).toFixed(0)}% do total do período
                </div>
              </>
            ) : (
              <p className="text-sm text-neutral-300 mt-2">—</p>
            )}
        </div>

        {/* Evolução */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100">
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
      </div> {/* end summary grid */}

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
                        <div key={cat.name} className="group cursor-pointer" onClick={() => openPanel(cat.name)}>
                            <div className="flex justify-between items-end mb-2">
                                <div className="flex items-center gap-1">
                                    <span className="text-xs font-bold text-neutral-800 group-hover:text-primary transition-colors">{cat.name}</span>
                                    <span className="text-[10px] text-neutral-400">({((cat.total / (totals.total || 1)) * 100).toFixed(0)}%)</span>
                                    <ChevronRight size={11} className="text-neutral-300 group-hover:text-primary transition-colors" />
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
                <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={filteredData.length === 0}>
                    <Download size={14} className="mr-2"/> Exportar CSV
                </Button>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-neutral-50 text-[10px] uppercase font-black text-neutral-400 tracking-tighter">
                            <th className="px-6 py-4">Data</th>
                            <th className="px-6 py-4">Descrição</th>
                            <th className="px-6 py-4">Banco</th>
                            <th className="px-6 py-4 text-right">Valor</th>
                            <th className="px-6 py-4">Categoria</th>
                            <th className="px-6 py-4">Subcategoria</th>
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
                                      {t.purchaseDate ? t.purchaseDate.split('-').reverse().join('/') : '—'}
                                  </td>
                                  <td className="px-6 py-3 text-sm font-bold text-neutral-800 truncate max-w-[200px]">
                                      {t.description}
                                  </td>
                                  <td className="px-6 py-3 text-xs font-bold uppercase text-neutral-400">
                                      {t.cardIssuer || '—'}
                                  </td>
                                  <td className={`px-6 py-3 text-right font-black ${t.type === 'refund' ? 'text-blue-600' : 'text-neutral-900'}`}>
                                      {t.type === 'refund' ? '-' : ''}{t.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                  </td>
                                  <td className="px-6 py-3">
                                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-primary uppercase">
                                          {t.category}
                                      </span>
                                  </td>
                                  <td className="px-6 py-3 text-xs text-neutral-400">
                                      {t.subcategory || '—'}
                                  </td>
                              </tr>
                          ))
                        )}
                    </tbody>
                    <tfoot>
                      <tr className="bg-neutral-50 border-t border-neutral-200">
                        <td colSpan={3} className="px-6 py-3 text-xs text-neutral-500">
                          {filteredData.length} lançamento{filteredData.length !== 1 ? 's' : ''}
                        </td>
                        <td className="px-6 py-3 text-right font-black text-neutral-900 text-sm">
                          {filteredTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
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

    {/* Painel lateral — detalhamento de categoria */}
    {openCategory && (() => {
      const catTxs = filteredData.filter(t => t.category === openCategory && t.type !== 'income');
      const panelTxs = catTxs.filter(t =>
        panelSearch === '' || t.description.toLowerCase().includes(panelSearch.toLowerCase())
      );
      const checkedTotal = panelTxs
        .filter(t => checkedIds.has(t.id))
        .reduce((s, t) => s + signedAmount(t), 0);
      const allChecked = panelTxs.length > 0 && panelTxs.every(t => checkedIds.has(t.id));

      return (
        <>
          {/* Overlay */}
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setOpenCategory(null)} />

          {/* Drawer */}
          <div className="fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col">
            {/* Header */}
            <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
              <div>
                <p className="text-xs text-neutral-400 uppercase tracking-wide font-semibold">Categoria</p>
                <h3 className="font-bold text-neutral-900 text-lg">{openCategory}</h3>
                <p className="text-xs text-neutral-400">{catTxs.length} transação{catTxs.length !== 1 ? 'ões' : ''}</p>
              </div>
              <button onClick={() => setOpenCategory(null)} className="p-2 hover:bg-neutral-100 rounded-lg text-neutral-400">
                <X size={20} />
              </button>
            </div>

            {/* Busca */}
            <div className="px-5 py-3 border-b border-neutral-100">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Buscar transação..."
                  value={panelSearch}
                  onChange={e => setPanelSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  autoFocus
                />
              </div>
            </div>

            {/* Selecionar todos */}
            {panelTxs.length > 0 && (
              <div className="px-5 py-2 border-b border-neutral-50 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={() => {
                    if (allChecked) {
                      setCheckedIds(prev => { const s = new Set(prev); panelTxs.forEach(t => s.delete(t.id)); return s; });
                    } else {
                      setCheckedIds(prev => { const s = new Set(prev); panelTxs.forEach(t => s.add(t.id)); return s; });
                    }
                  }}
                  className="w-4 h-4 rounded accent-primary cursor-pointer"
                />
                <span className="text-xs text-neutral-500">Selecionar todas ({panelTxs.length})</span>
              </div>
            )}

            {/* Lista de transações */}
            <div className="flex-1 overflow-y-auto">
              {panelTxs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-neutral-400 gap-2">
                  <Search size={24} />
                  <p className="text-sm">Nenhuma transação encontrada</p>
                </div>
              ) : (
                panelTxs.map(t => (
                <div key={t.id} className={`border-b border-neutral-50 transition-colors ${editingTx?.id === t.id ? 'bg-amber-50' : checkedIds.has(t.id) ? 'bg-blue-50' : 'hover:bg-neutral-50'}`}>
                  {editingTx?.id === t.id ? (
                    /* Formulário de edição inline */
                    <div className="px-5 py-3 space-y-2">
                      <p className="text-xs font-semibold text-neutral-700 truncate">{t.description}</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-neutral-400 font-medium">Categoria</label>
                          <select value={editCat} onChange={e => { setEditCat(e.target.value); setEditSub(''); }}
                            className="w-full border border-neutral-200 rounded-lg px-2 py-1 text-xs outline-none mt-0.5">
                            {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] text-neutral-400 font-medium">Subcategoria</label>
                          <select value={editSub} onChange={e => setEditSub(e.target.value)}
                            className="w-full border border-neutral-200 rounded-lg px-2 py-1 text-xs outline-none mt-0.5">
                            <option value="">Nenhuma</option>
                            {(categories.find(c => c.name === editCat)?.subcategories || []).map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] text-neutral-400 font-medium">Tags</label>
                        <div className="flex gap-2 mt-1">
                          {['Pessoais', 'Empresa'].map(tag => (
                            <button key={tag} onClick={() => toggleEditTag(tag)} type="button"
                              className={`text-[11px] font-bold px-3 py-1 rounded-full border transition-all ${editTags.includes(tag) ? (tag === 'Pessoais' ? 'bg-purple-100 border-purple-300 text-purple-700' : 'bg-blue-100 border-blue-300 text-blue-700') : 'bg-white border-neutral-200 text-neutral-400'}`}>
                              {tag}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button onClick={() => setEditingTx(null)}
                          className="flex-1 text-xs py-1.5 border border-neutral-200 rounded-lg text-neutral-500 hover:bg-neutral-50">
                          Cancelar
                        </button>
                        <button onClick={handleSaveTx} disabled={savingTx}
                          className="flex-1 flex items-center justify-center gap-1 text-xs py-1.5 bg-primary text-white rounded-lg hover:opacity-90 disabled:opacity-50 font-semibold">
                          <Check size={12} /> {savingTx ? 'Salvando…' : 'Salvar'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Linha normal */
                    <div className="flex items-center gap-3 px-5 py-3">
                      <input type="checkbox" checked={checkedIds.has(t.id)} onChange={() => toggleCheck(t.id)}
                        className="w-4 h-4 rounded accent-primary flex-shrink-0" />
                      <div className="flex-1 min-w-0 cursor-default">
                        <p className="text-sm font-medium text-neutral-800 truncate">{t.description}</p>
                        <p className="text-[11px] text-neutral-400">
                          {t.purchaseDate ? t.purchaseDate.split('-').reverse().join('/') : '—'}
                          {t.category ? ` · ${t.category}` : ''}
                          {t.subcategory ? ` · ${t.subcategory}` : ''}
                        </p>
                        {t.tags && t.tags.length > 0 && (
                          <div className="flex gap-1 mt-0.5">
                            {t.tags.map(tag => (
                              <span key={tag} className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${tag === 'Pessoais' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>{tag}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className={`text-sm font-bold ${checkedIds.has(t.id) ? 'text-primary' : t.type === 'refund' ? 'text-blue-600' : 'text-neutral-700'}`}>
                          {t.type === 'refund' ? '-' : ''}{t.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                        {onUpdateTransaction && (
                          <button onClick={() => startEdit(t)} title="Editar"
                            className="p-1 text-neutral-300 hover:text-amber-500 hover:bg-amber-50 rounded transition-colors">
                            <Pencil size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                ))
              )}
            </div>

            {/* Footer — somatório */}
            <div className="px-5 py-4 border-t border-neutral-200 bg-neutral-50 space-y-2">
              <div className="flex justify-between text-xs text-neutral-500">
                <span>Total da categoria</span>
                <span className="font-bold text-neutral-700">
                  {catTxs.reduce((s, t) => s + signedAmount(t), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
              {checkedIds.size > 0 && (
                <div className="flex justify-between items-center bg-primary/10 border border-primary/20 rounded-xl px-3 py-2">
                  <span className="text-xs font-semibold text-primary">{checkedIds.size} selecionada{checkedIds.size > 1 ? 's' : ''}</span>
                  <span className="text-sm font-black text-primary">
                    {checkedTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
              )}
            </div>
          </div>
        </>
      );
    })()}
  </>
  );
};
