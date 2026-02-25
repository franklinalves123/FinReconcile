
import React, { useState, useEffect, useRef } from 'react';
import { Save, Tag as TagIcon, Layers, CreditCard, Calendar, DollarSign, Plus, Check, X } from 'lucide-react';
import { Button } from './ui/Button.tsx';
import { Category, Transaction, MatchStatus, CardIssuer, Tag } from '../types.ts';
import { parseBRLAmount } from '../services/dataService.ts';

interface ManualEntryProps {
  categories: Category[];
  tags: Tag[];
  onAddTransaction: (transaction: Transaction) => Promise<void>;
  onUpdateCategories: (categories: Category[]) => Promise<void>;
  onCancel: () => void;
}

const ISSUERS: CardIssuer[] = ['Inter', 'Santander', 'Bradesco', 'BRB', 'Porto Bank', 'Itaú', 'Outros'];

const today = () => new Date().toISOString().split('T')[0];

export const ManualEntry: React.FC<ManualEntryProps> = ({
  categories,
  tags,
  onAddTransaction,
  onUpdateCategories,
  onCancel,
}) => {
  const [purchaseDate, setPurchaseDate] = useState(today());
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(categories[0]?.name || '');
  const [subcategory, setSubcategory] = useState('');
  const [issuer, setIssuer] = useState<CardIssuer>('Inter');
  const [selectedTags, setSelectedTags] = useState<string[]>(['Despesas Pessoais']);
  const [isSaving, setIsSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);

  // Inline add — categoria
  const [isAddingCat, setIsAddingCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [isSavingCat, setIsSavingCat] = useState(false);
  const catInputRef = useRef<HTMLInputElement>(null);

  // Inline add — subcategoria
  const [isAddingSub, setIsAddingSub] = useState(false);
  const [newSubName, setNewSubName] = useState('');
  const [isSavingSub, setIsSavingSub] = useState(false);
  const subInputRef = useRef<HTMLInputElement>(null);

  // Sincroniza subcategoria quando categoria muda
  useEffect(() => {
    const cat = categories.find(c => c.name === category);
    setSubcategory(cat?.subcategories[0] || '');
  }, [category, categories]);

  // Foca o input ao abrir
  useEffect(() => { if (isAddingCat) catInputRef.current?.focus(); }, [isAddingCat]);
  useEffect(() => { if (isAddingSub) subInputRef.current?.focus(); }, [isAddingSub]);

  const resetForm = () => {
    setPurchaseDate(today());
    setDescription('');
    setAmount('');
    setCategory(categories[0]?.name || '');
    setSubcategory(categories[0]?.subcategories[0] || '');
    setIssuer('Inter');
    setSelectedTags(['Despesas Pessoais']);
  };

  const toggleTag = (tagName: string) => {
    setSelectedTags(prev =>
      prev.includes(tagName) ? prev.filter(t => t !== tagName) : [...prev, tagName]
    );
  };

  // ── Adicionar nova categoria ──
  const handleAddCategory = async () => {
    const name = newCatName.trim();
    if (!name) { setIsAddingCat(false); return; }

    // Se já existe, só selecionar
    const existing = categories.find(c => c.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      setCategory(existing.name);
      setNewCatName('');
      setIsAddingCat(false);
      return;
    }

    const newCat: Category = {
      id: `cat-${Date.now()}`,
      name,
      subcategories: [],
      color: '#0B5FFF',
    };
    setIsSavingCat(true);
    try {
      await onUpdateCategories([...categories, newCat]);
      setCategory(name);
    } finally {
      setIsSavingCat(false);
      setNewCatName('');
      setIsAddingCat(false);
    }
  };

  // ── Adicionar nova subcategoria ──
  const handleAddSubcategory = async () => {
    const name = newSubName.trim();
    if (!name || !category) { setIsAddingSub(false); return; }

    const currentCat = categories.find(c => c.name === category);
    if (!currentCat) { setIsAddingSub(false); return; }

    // Se já existe, só selecionar
    if (currentCat.subcategories.includes(name)) {
      setSubcategory(name);
      setNewSubName('');
      setIsAddingSub(false);
      return;
    }

    const updated = categories.map(c =>
      c.name === category
        ? { ...c, subcategories: [...c.subcategories, name] }
        : c
    );
    setIsSavingSub(true);
    try {
      await onUpdateCategories(updated);
      setSubcategory(name);
    } finally {
      setIsSavingSub(false);
      setNewSubName('');
      setIsAddingSub(false);
    }
  };

  const handleSave = async () => {
    if (!description.trim() || !amount.trim()) return;
    const parsedAmount = parseBRLAmount(amount);
    if (parsedAmount <= 0) return;

    const newTransaction: Transaction = {
      id: `manual-${Date.now()}`,
      date: purchaseDate,
      purchaseDate,
      description: description.trim(),
      amount: parsedAmount,
      category: category || 'Outros',
      subcategory,
      cardIssuer: issuer,
      status: MatchStatus.MATCHED,
      invoiceId: 'manual-entry',
      tags: selectedTags,
    };

    setIsSaving(true);
    try {
      await onAddTransaction(newTransaction);
      setSavedCount(n => n + 1);
      resetForm();
    } catch {
      // Erro já tratado (toast) pelo App.tsx
    } finally {
      setIsSaving(false);
    }
  };

  const selectedCat = categories.find(c => c.name === category);
  const hasSubcategories = (selectedCat?.subcategories.length ?? 0) > 0;
  const canSave = description.trim().length > 0 && amount.trim().length > 0 && parseBRLAmount(amount) > 0;

  // ── UI helper: campo inline de adição ──
  const InlineInput = ({
    inputRef, value, onChange, onConfirm, onCancel: cancelFn, placeholder, isSaving: saving,
  }: {
    inputRef: React.RefObject<HTMLInputElement | null>;
    value: string;
    onChange: (v: string) => void;
    onConfirm: () => void;
    onCancel: () => void;
    placeholder: string;
    isSaving: boolean;
  }) => (
    <div className="flex gap-1.5 flex-1">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') onConfirm();
          if (e.key === 'Escape') cancelFn();
        }}
        placeholder={placeholder}
        disabled={saving}
        className="flex-1 border border-primary rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:outline-none disabled:opacity-50"
      />
      <button
        onClick={onConfirm}
        disabled={saving || !value.trim()}
        title="Confirmar"
        className="p-2 bg-primary text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-40"
      >
        <Check size={14} />
      </button>
      <button
        onClick={cancelFn}
        disabled={saving}
        title="Cancelar"
        className="p-2 border border-neutral-200 text-neutral-400 hover:text-red-500 rounded-lg transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">

      {/* Cabeçalho */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-neutral-900">Lançamento Manual</h2>
        <p className="text-neutral-500 text-sm mt-1">
          Adicione um gasto diretamente, sem precisar de um PDF de fatura.
        </p>
        {savedCount > 0 && (
          <p className="text-xs text-green-600 font-semibold mt-2">
            ✓ {savedCount} lançamento{savedCount !== 1 ? 's' : ''} salvo{savedCount !== 1 ? 's' : ''} nesta sessão
          </p>
        )}
      </div>

      <div className="space-y-5">

        {/* Card 1 — Quando e onde */}
        <div className="bg-white rounded-xl border border-neutral-200 shadow-sm p-6">
          <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-4">
            Quando e onde
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-600 mb-1.5 flex items-center gap-1.5">
                <Calendar size={13} /> Data da Compra
              </label>
              <input
                type="date"
                className="w-full border border-neutral-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary focus:outline-none transition-shadow"
                value={purchaseDate}
                onChange={e => setPurchaseDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-600 mb-1.5 flex items-center gap-1.5">
                <CreditCard size={13} /> Banco / Cartão
              </label>
              <select
                className="w-full border border-neutral-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary focus:outline-none bg-white transition-shadow"
                value={issuer}
                onChange={e => setIssuer(e.target.value as CardIssuer)}
              >
                {ISSUERS.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Card 2 — O que e quanto */}
        <div className="bg-white rounded-xl border border-neutral-200 shadow-sm p-6">
          <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-4">
            O que e quanto
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-600 mb-1.5">
                Descrição *
              </label>
              <input
                type="text"
                placeholder="Ex: Almoço no Restaurante X, Farmácia..."
                className="w-full border border-neutral-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary focus:outline-none transition-shadow"
                value={description}
                onChange={e => setDescription(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && canSave && handleSave()}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-600 mb-1.5 flex items-center gap-1.5">
                <DollarSign size={13} /> Valor *
              </label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="Ex: 1.500,00 ou R$ 89,90 ou 45.50"
                className="w-full border border-neutral-200 rounded-lg px-3 py-2.5 text-sm font-bold focus:ring-2 focus:ring-primary focus:outline-none transition-shadow"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && canSave && handleSave()}
              />
              {amount && parseBRLAmount(amount) > 0 && (
                <p className="text-xs text-green-600 mt-1 font-medium">
                  = {parseBRLAmount(amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              )}
              {amount && parseBRLAmount(amount) <= 0 && (
                <p className="text-xs text-red-400 mt-1">Valor inválido — use formato: 1500 ou 1.500,00</p>
              )}
            </div>
          </div>
        </div>

        {/* Card 3 — Classificação */}
        <div className="bg-white rounded-xl border border-neutral-200 shadow-sm p-6">
          <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
            <Layers size={13} /> Classificação
          </h3>
          <div className="grid grid-cols-2 gap-4 mb-4">

            {/* Categoria + botão + */}
            <div>
              <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Categoria</label>
              {isAddingCat ? (
                <InlineInput
                  inputRef={catInputRef}
                  value={newCatName}
                  onChange={setNewCatName}
                  onConfirm={handleAddCategory}
                  onCancel={() => { setIsAddingCat(false); setNewCatName(''); }}
                  placeholder="Nome da nova categoria…"
                  isSaving={isSavingCat}
                />
              ) : (
                <div className="flex gap-1.5">
                  <select
                    className="flex-1 border border-neutral-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary focus:outline-none bg-white transition-shadow"
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                  >
                    {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                  <button
                    type="button"
                    onClick={() => setIsAddingCat(true)}
                    title="Nova categoria"
                    className="p-2 border border-neutral-200 text-neutral-400 hover:text-primary hover:border-primary rounded-lg transition-colors"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              )}
            </div>

            {/* Subcategoria + botão + */}
            <div>
              <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Subcategoria</label>
              {isAddingSub ? (
                <InlineInput
                  inputRef={subInputRef}
                  value={newSubName}
                  onChange={setNewSubName}
                  onConfirm={handleAddSubcategory}
                  onCancel={() => { setIsAddingSub(false); setNewSubName(''); }}
                  placeholder="Nome da nova subcategoria…"
                  isSaving={isSavingSub}
                />
              ) : (
                <div className="flex gap-1.5">
                  <select
                    className="flex-1 border border-neutral-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary focus:outline-none bg-white disabled:bg-neutral-50 disabled:text-neutral-400 transition-shadow"
                    value={subcategory}
                    disabled={!hasSubcategories}
                    onChange={e => setSubcategory(e.target.value)}
                  >
                    {hasSubcategories
                      ? selectedCat!.subcategories.map(s => <option key={s} value={s}>{s}</option>)
                      : <option value="">Nenhuma subcategoria</option>
                    }
                  </select>
                  <button
                    type="button"
                    onClick={() => setIsAddingSub(true)}
                    disabled={!category}
                    title="Nova subcategoria"
                    className="p-2 border border-neutral-200 text-neutral-400 hover:text-primary hover:border-primary rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-neutral-600 mb-2 flex items-center gap-1.5">
                <TagIcon size={13} /> Tags
              </label>
              <div className="flex flex-wrap gap-2">
                {tags.map(tag => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.name)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                      selectedTags.includes(tag.name)
                        ? 'bg-primary border-primary text-white shadow-sm'
                        : 'bg-neutral-50 border-neutral-200 text-neutral-600 hover:border-primary hover:text-primary'
                    }`}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Ações */}
        <div className="flex justify-between items-center py-2">
          <button
            type="button"
            onClick={onCancel}
            className="text-sm text-neutral-400 hover:text-neutral-700 transition-colors"
          >
            ← Voltar ao Dashboard
          </button>
          <Button
            onClick={handleSave}
            disabled={!canSave}
            isLoading={isSaving}
            className="min-w-[200px]"
          >
            <Save size={16} className="mr-2" />
            Salvar Lançamento
          </Button>
        </div>

      </div>
    </div>
  );
};
