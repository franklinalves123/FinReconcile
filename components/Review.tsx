
import React, { useState } from 'react';
import { Transaction, SortConfig, Category, CardIssuer, Tag } from '../types.ts';
import { Check, Edit2, ArrowRight, X, Save, CreditCard, Tag as TagIcon, Layers, Trash2, Plus, CheckCircle2 } from 'lucide-react';
import { Button } from './ui/Button.tsx';

interface ReviewProps {
  transactions: Transaction[];
  categories: Category[];
  tags: Tag[];
  onConfirm: () => void;
  onUpdateTransaction: (id: string, updates: Partial<Transaction>) => void;
  onDeleteTransaction: (id: string) => void;
  onUpdateCategories: (categories: Category[]) => Promise<void>;
  isProcessing?: boolean;
}

const ISSUERS: CardIssuer[] = ['Inter', 'Santander', 'Bradesco', 'BRB', 'Porto Bank', 'Itaú', 'Outros'];

export const Review: React.FC<ReviewProps> = ({ 
  transactions, 
  categories,
  tags,
  onConfirm, 
  onUpdateTransaction,
  onDeleteTransaction,
  onUpdateCategories,
  isProcessing = false
}) => {
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'purchaseDate', direction: 'desc' });
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  
  const [editDate, setEditDate] = useState('');
  const [editPurchaseDate, setEditPurchaseDate] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editSubcategory, setEditSubcategory] = useState('');
  const [editIssuer, setEditIssuer] = useState<CardIssuer>('Inter');
  const [editTags, setEditTags] = useState<string[]>([]);

  const handleSort = (key: keyof Transaction | 'amount') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedTransactions = [...transactions].sort((a, b) => {
    if (sortConfig.key === 'amount') {
        return sortConfig.direction === 'asc' ? a.amount - b.amount : b.amount - a.amount;
    }
    const valA = a[sortConfig.key as keyof Transaction] || '';
    const valB = b[sortConfig.key as keyof Transaction] || '';
    return sortConfig.direction === 'asc' 
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
  });

  const handleCreateCategory = async () => {
    const name = window.prompt("Nome da nova categoria:");
    if (name && name.trim()) {
      const exists = categories.find(c => c.name.toLowerCase() === name.toLowerCase());
      if (exists) return alert("Esta categoria já existe.");
      
      const newCat: Category = {
        id: Math.random().toString(36).substr(2, 9),
        name: name.trim(),
        subcategories: [],
        color: '#0B5FFF'
      };
      await onUpdateCategories([...categories, newCat]);
    }
  };

  const handleCreateSubcategory = async (categoryName: string) => {
    const name = window.prompt(`Nova subcategoria para ${categoryName}:`);
    if (name && name.trim()) {
      const updatedCategories = categories.map(c => {
        if (c.name === categoryName) {
          if (c.subcategories.includes(name.trim())) {
            alert("Esta subcategoria já existe.");
            return c;
          }
          return { ...c, subcategories: [...c.subcategories, name.trim()] };
        }
        return c;
      });
      await onUpdateCategories(updatedCategories);
    }
  };

  const openEditModal = (t: Transaction) => {
    setEditingTransaction(t);
    setEditDate(t.date);
    setEditPurchaseDate(t.purchaseDate);
    setEditDesc(t.description);
    setEditAmount(t.amount.toString());
    setEditCategory(t.category);
    setEditSubcategory(t.subcategory || '');
    setEditIssuer(t.cardIssuer || 'Inter');
    setEditTags(t.tags || []);
  };

  const handleSaveEdit = () => {
    if (editingTransaction && editDesc && editAmount) {
      onUpdateTransaction(editingTransaction.id, {
        date: editDate,
        purchaseDate: editPurchaseDate,
        description: editDesc,
        amount: parseFloat(editAmount),
        category: editCategory,
        subcategory: editSubcategory,
        cardIssuer: editIssuer,
        tags: editTags
      });
      setEditingTransaction(null);
    }
  };

  const toggleTag = (tagName: string) => {
    setEditTags(prev => 
      prev.includes(tagName) 
        ? prev.filter(t => t !== tagName) 
        : [...prev, tagName]
    );
  };

  const formatDateBr = (isoDate: string) => {
    if (!isoDate) return '';
    const [year, month, day] = isoDate.split('-');
    return `${day}/${month}/${year}`;
  };

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col animate-fade-in relative">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900">Revisar Extração</h2>
          <p className="text-neutral-500 text-sm">Classifique categorias, subcategorias e tags antes da conciliação.</p>
        </div>
        <div className="flex gap-3">
          <Button 
            onClick={onConfirm} 
            isLoading={isProcessing}
            className="bg-primary hover:bg-blue-700 shadow-lg shadow-blue-100 min-w-[220px]"
          >
            Finalizar e Salvar Tudo <CheckCircle2 size={16} className="ml-2"/>
          </Button>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden flex flex-col">
        <div className="bg-neutral-50 border-b border-neutral-200 px-6 py-3 grid grid-cols-12 gap-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider select-none">
            <div className="col-span-1 cursor-pointer" onClick={() => handleSort('purchaseDate')}>Data</div>
            <div className="col-span-3">Descrição</div>
            <div className="col-span-1">Banco</div>
            <div className="col-span-1 text-right cursor-pointer" onClick={() => handleSort('amount')}>Valor</div>
            <div className="col-span-2">Categoria</div>
            <div className="col-span-2">Subcategoria</div>
            <div className="col-span-2 text-center">Ações</div>
        </div>
        
        <div className="overflow-y-auto flex-1">
            {sortedTransactions.map((t) => {
                const currentCategory = categories.find(c => c.name === t.category);
                return (
                    <div key={t.id} className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-neutral-100 hover:bg-blue-50/30 items-center transition-colors">
                        <div className="col-span-1 text-xs text-neutral-900 font-bold">{formatDateBr(t.purchaseDate)}</div>
                        <div className="col-span-3 text-sm text-neutral-700 truncate">{t.description}</div>
                        <div className="col-span-1">
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-neutral-100 text-neutral-600 truncate max-w-full">
                               {t.cardIssuer}
                            </span>
                        </div>
                        <div className="col-span-1 text-sm text-neutral-900 font-bold text-right">
                            {t.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </div>
                        <div className="col-span-2 flex items-center gap-1">
                            <select 
                               className="text-[10px] bg-neutral-50 border border-neutral-200 rounded-lg px-2 py-1 focus:ring-1 focus:ring-primary flex-1 outline-none"
                               value={t.category}
                               onChange={(e) => {
                                 const newCatName = e.target.value;
                                 const newCat = categories.find(c => c.name === newCatName);
                                 onUpdateTransaction(t.id, { 
                                   category: newCatName, 
                                   subcategory: newCat?.subcategories[0] || '' 
                                 });
                               }}
                            >
                                {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                            </select>
                            <button onClick={handleCreateCategory} className="p-1 text-neutral-400 hover:text-primary transition-colors" title="Nova Categoria">
                              <Plus size={12}/>
                            </button>
                        </div>
                        <div className="col-span-2 flex items-center gap-1">
                            <select 
                               className="text-[10px] bg-white border border-neutral-200 rounded-lg px-2 py-1 focus:ring-1 focus:ring-primary flex-1 outline-none disabled:bg-neutral-100 disabled:text-neutral-400"
                               value={t.subcategory || ''}
                               disabled={!currentCategory}
                               onChange={(e) => onUpdateTransaction(t.id, { subcategory: e.target.value })}
                            >
                                {currentCategory?.subcategories.length ? (
                                    currentCategory.subcategories.map(sub => <option key={sub} value={sub}>{sub}</option>)
                                ) : (
                                    <option value="">Nenhuma</option>
                                )}
                            </select>
                            <button 
                              onClick={() => handleCreateSubcategory(t.category)} 
                              className="p-1 text-neutral-400 hover:text-primary transition-colors disabled:opacity-30" 
                              disabled={!t.category}
                              title="Nova Subcategoria"
                            >
                              <Plus size={12}/>
                            </button>
                        </div>
                        <div className="col-span-2 flex justify-center items-center gap-2">
                            <div className="flex flex-wrap gap-1 justify-center">
                              {t.tags?.slice(0, 1).map(tagName => {
                                const tagObj = tags.find(tag => tag.name === tagName);
                                return (
                                  <span key={tagName} className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase ${tagObj?.color || 'bg-gray-100'}`}>
                                    {tagName.split(' ')[0]}
                                  </span>
                                );
                              })}
                            </div>
                            <button onClick={() => openEditModal(t)} className="text-neutral-400 hover:text-primary p-1" title="Editar"><Edit2 size={12}/></button>
                            <button onClick={() => onDeleteTransaction(t.id)} className="text-neutral-300 hover:text-red-500 p-1" title="Excluir"><Trash2 size={12}/></button>
                        </div>
                    </div>
                );
            })}
        </div>
      </div>

      {editingTransaction && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center animate-fade-in p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold">Editar Lançamento</h3>
                    <button onClick={() => setEditingTransaction(null)}><X size={20}/></button>
                </div>
                
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Data da Compra</label>
                            <input type="date" className="w-full border rounded-lg p-2 text-sm outline-none" value={editPurchaseDate} onChange={e => setEditPurchaseDate(e.target.value)} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Banco / Emissor</label>
                            <select className="w-full border rounded-lg p-2 text-sm outline-none" value={editIssuer} onChange={e => setEditIssuer(e.target.value as CardIssuer)}>
                                {ISSUERS.map(issuer => <option key={issuer} value={issuer}>{issuer}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-neutral-500 uppercase mb-1 flex justify-between">
                              Categoria
                              <button onClick={handleCreateCategory} className="text-primary hover:underline text-[10px]">Nova +</button>
                            </label>
                            <select 
                                className="w-full border rounded-lg p-2 text-sm outline-none" 
                                value={editCategory} 
                                onChange={e => {
                                    setEditCategory(e.target.value);
                                    const cat = categories.find(c => c.name === e.target.value);
                                    setEditSubcategory(cat?.subcategories[0] || '');
                                }}
                            >
                                {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-neutral-500 uppercase mb-1 flex justify-between">
                              Subcategoria
                              <button onClick={() => handleCreateSubcategory(editCategory)} className="text-primary hover:underline text-[10px]">Nova +</button>
                            </label>
                            <select 
                                className="w-full border rounded-lg p-2 text-sm outline-none" 
                                value={editSubcategory} 
                                onChange={e => setEditSubcategory(e.target.value)}
                            >
                                {categories.find(c => c.name === editCategory)?.subcategories.map(sub => (
                                    <option key={sub} value={sub}>{sub}</option>
                                )) || <option value="">Sem subcategorias</option>}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Tags (Classificação)</label>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {tags.map(tag => (
                            <button
                              key={tag.id}
                              onClick={() => toggleTag(tag.name)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                                editTags.includes(tag.name)
                                ? 'bg-primary border-primary text-white'
                                : 'bg-neutral-50 border-neutral-200 text-neutral-600 hover:border-primary'
                              }`}
                            >
                              {tag.name}
                            </button>
                          ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Descrição</label>
                        <input type="text" className="w-full border rounded-lg p-2 text-sm outline-none" value={editDesc} onChange={e => setEditDesc(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Valor (R$)</label>
                        <input type="number" step="0.01" className="w-full border rounded-lg p-2 text-sm outline-none font-bold" value={editAmount} onChange={e => setEditAmount(e.target.value)} />
                    </div>
                </div>

                <div className="flex justify-end gap-3 mt-8 pt-4 border-t">
                    <Button variant="ghost" onClick={() => setEditingTransaction(null)}>Cancelar</Button>
                    <Button onClick={handleSaveEdit}><Save size={16} className="mr-2"/> Salvar Alterações</Button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
