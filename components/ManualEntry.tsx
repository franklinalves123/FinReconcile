import React, { useState, useEffect } from 'react';
import { Plus, Save, ArrowLeft, Tag as TagIcon, Layers } from 'lucide-react';
import { Button } from './ui/Button.tsx';
import { Category, Transaction, MatchStatus, CardIssuer, Tag } from '../types.ts';

interface ManualEntryProps {
  categories: Category[];
  tags: Tag[];
  onAddTransaction: (transaction: Transaction) => void;
  onCancel: () => void;
}

const ISSUERS: CardIssuer[] = ['Inter', 'Santander', 'Bradesco', 'BRB', 'Porto Bank', 'Itaú', 'Outros'];

export const ManualEntry: React.FC<ManualEntryProps> = ({ categories, tags, onAddTransaction, onCancel }) => {
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(categories[0]?.name || '');
  const [subcategory, setSubcategory] = useState('');
  const [issuer, setIssuer] = useState<CardIssuer>('Inter');
  const [selectedTags, setSelectedTags] = useState<string[]>(['Despesas Pessoais']);

  useEffect(() => {
    const selectedCat = categories.find(c => c.name === category);
    if (selectedCat && selectedCat.subcategories.length > 0) {
      setSubcategory(selectedCat.subcategories[0]);
    } else {
      setSubcategory('');
    }
  }, [category, categories]);

  const handleSave = () => {
    if (!description || !amount) return;

    const today = new Date().toISOString().split('T')[0];

    const newTransaction: Transaction = {
      id: `manual-${Date.now()}`,
      date: today,
      purchaseDate: purchaseDate,
      description: description,
      amount: parseFloat(amount.replace(',', '.')),
      category: category || 'Outros',
      subcategory: subcategory,
      cardIssuer: issuer,
      status: MatchStatus.UNMATCHED,
      invoiceId: 'manual-entry',
      tags: selectedTags
    };

    onAddTransaction(newTransaction);
    onCancel();
  };

  const toggleTag = (tagName: string) => {
    setSelectedTags(prev => 
      prev.includes(tagName) 
        ? prev.filter(t => t !== tagName) 
        : [...prev, tagName]
    );
  };

  return (
    <div className="max-w-2xl mx-auto animate-fade-in mt-8">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={onCancel} className="text-neutral-400 hover:text-neutral-800 transition-colors">
            <ArrowLeft size={24} />
        </button>
        <div>
            <h2 className="text-2xl font-bold text-neutral-900">Lançamento Manual</h2>
            <p className="text-neutral-500 text-sm">Adicione gastos e classifique-os detalhadamente.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Data da Compra</label>
                <input 
                    type="date" 
                    className="w-full border border-neutral-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-primary focus:outline-none"
                    value={purchaseDate}
                    onChange={e => setPurchaseDate(e.target.value)}
                />
            </div>
            <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Banco / Cartão</label>
                <select 
                    className="w-full border border-neutral-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-primary focus:outline-none bg-white"
                    value={issuer}
                    onChange={e => setIssuer(e.target.value as CardIssuer)}
                >
                    {ISSUERS.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
            </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-neutral-500 uppercase mb-2 flex items-center gap-2">
            <TagIcon size={14} /> Classificação (Tags)
          </label>
          <div className="flex flex-wrap gap-3">
            {tags.map(tag => (
              <button
                key={tag.id}
                onClick={() => toggleTag(tag.name)}
                className={`flex-1 px-4 py-2.5 rounded-xl border text-sm font-bold transition-all ${
                  selectedTags.includes(tag.name)
                  ? 'bg-blue-50 border-primary text-primary shadow-sm'
                  : 'bg-neutral-50 border-neutral-200 text-neutral-500 hover:border-primary'
                }`}
              >
                {tag.name}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase mb-2 flex items-center gap-1">
                  <Layers size={14}/> Categoria
                </label>
                <select 
                    className="w-full border border-neutral-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-primary focus:outline-none bg-white font-medium"
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                >
                    {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
            </div>
            <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase mb-2 flex items-center gap-1">
                  <Layers size={14}/> Subcategoria
                </label>
                <select 
                    className="w-full border border-neutral-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-primary focus:outline-none bg-white disabled:bg-neutral-50"
                    value={subcategory}
                    disabled={!category || categories.find(c => c.name === category)?.subcategories.length === 0}
                    onChange={e => setSubcategory(e.target.value)}
                >
                    {categories.find(c => c.name === category)?.subcategories.length ? (
                        categories.find(c => c.name === category)?.subcategories.map(sub => (
                            <option key={sub} value={sub}>{sub}</option>
                        ))
                    ) : (
                        <option value="">Nenhuma subcategoria</option>
                    )}
                </select>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-1">
                <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Valor (R$)</label>
                <input 
                    type="number" 
                    step="0.01"
                    placeholder="0,00"
                    className="w-full border border-neutral-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-primary focus:outline-none font-bold"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                />
            </div>
            <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Descrição</label>
                <input 
                    type="text" 
                    placeholder="Ex: Almoço no Restaurante X"
                    className="w-full border border-neutral-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-primary focus:outline-none"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                />
            </div>
        </div>

        <div className="pt-6 flex justify-end gap-3 border-t border-neutral-100">
            <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!description || !amount}>
                <Save size={18} className="mr-2"/> Confirmar Lançamento
            </Button>
        </div>
      </div>
    </div>
  );
};