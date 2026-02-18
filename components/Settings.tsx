
import React, { useState, useEffect } from 'react';
import { Plus, X, Tag as TagIcon, Layers, ChevronRight, ChevronDown, User, ShieldCheck, Mail } from 'lucide-react';
import { Button } from './ui/Button.tsx';
import { Category, Tag, AppUser, MASTER_EMAIL } from '../types.ts';

interface SettingsProps {
  categories: Category[];
  tags: Tag[];
  currentUserEmail?: string;
  onUpdateCategories: (categories: Category[]) => Promise<void>;
  onUpdateTags: (tags: Tag[]) => Promise<void>;
}

export const Settings: React.FC<SettingsProps> = ({ 
  categories, 
  tags, 
  currentUserEmail,
  onUpdateCategories, 
  onUpdateTags 
}) => {
  const isMaster = currentUserEmail === MASTER_EMAIL;
  const [activeTab, setActiveTab] = useState<'categories' | 'tags' | 'users'>(isMaster ? 'users' : 'categories');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newTagName, setNewTagName] = useState('');
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [newSubcategoryMap, setNewSubcategoryMap] = useState<Record<string, string>>({});
  
  // States para loading individual
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [busyItems, setBusyItems] = useState<Set<string>>(new Set());

  // User Management State
  const [users, setUsers] = useState<AppUser[]>([]);
  const [newUserEmail, setNewUserEmail] = useState('');

  useEffect(() => {
    // Carregar usuários simulados do localStorage
    const savedUsers = localStorage.getItem('app_users');
    if (savedUsers) {
      setUsers(JSON.parse(savedUsers));
    } else {
      const initialUsers: AppUser[] = [
        { id: '1', email: MASTER_EMAIL, role: 'master', createdAt: new Date().toISOString() }
      ];
      setUsers(initialUsers);
      localStorage.setItem('app_users', JSON.stringify(initialUsers));
    }
  }, []);

  const saveUsers = (updatedUsers: AppUser[]) => {
    setUsers(updatedUsers);
    localStorage.setItem('app_users', JSON.stringify(updatedUsers));
  };

  // --- User Management Logic ---
  const handleAddUser = () => {
    if (!newUserEmail.trim() || !newUserEmail.includes('@')) return;
    if (users.find(u => u.email === newUserEmail)) {
        alert("Usuário já existe!");
        return;
    }
    const newUser: AppUser = {
      id: Math.random().toString(36).substr(2, 9),
      email: newUserEmail.toLowerCase(),
      role: 'user',
      createdAt: new Date().toISOString()
    };
    saveUsers([...users, newUser]);
    setNewUserEmail('');
    alert(`Convite enviado para ${newUserEmail} (Simulado).`);
  };

  const handleDeleteUser = (id: string) => {
    const userToDelete = users.find(u => u.id === id);
    if (userToDelete?.role === 'master') {
        alert("Não é possível remover o usuário Master.");
        return;
    }
    saveUsers(users.filter(u => u.id !== id));
  };

  // --- Category Logic ---
  const handleAddCategory = async () => {
    if (!newCategoryName.trim() || isAddingCategory) return;
    setIsAddingCategory(true);
    const newCat: Category = {
      id: Math.random().toString(36).substr(2, 9),
      name: newCategoryName,
      subcategories: [],
      color: '#' + Math.floor(Math.random()*16777215).toString(16)
    };
    try {
      await onUpdateCategories([...categories, newCat]);
      setNewCategoryName('');
    } finally {
      setIsAddingCategory(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (busyItems.has(id)) return;
    setBusyItems(prev => new Set(prev).add(id));
    try {
      await onUpdateCategories(categories.filter(c => c.id !== id));
    } finally {
      setBusyItems(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleAddSubcategory = async (categoryId: string) => {
    const name = newSubcategoryMap[categoryId];
    if (!name?.trim() || busyItems.has(categoryId)) return;

    setBusyItems(prev => new Set(prev).add(categoryId));
    const updatedCategories = categories.map(c => {
      if (c.id === categoryId) {
        return { ...c, subcategories: [...c.subcategories, name] };
      }
      return c;
    });
    
    try {
      await onUpdateCategories(updatedCategories);
      setNewSubcategoryMap(prev => ({ ...prev, [categoryId]: '' }));
    } finally {
      setBusyItems(prev => {
        const next = new Set(prev);
        next.delete(categoryId);
        return next;
      });
    }
  };

  const handleDeleteSubcategory = async (categoryId: string, subName: string) => {
    if (busyItems.has(categoryId)) return;
    setBusyItems(prev => new Set(prev).add(categoryId));
    const updatedCategories = categories.map(c => {
      if (c.id === categoryId) {
        return { ...c, subcategories: c.subcategories.filter(s => s !== subName) };
      }
      return c;
    });
    try {
      await onUpdateCategories(updatedCategories);
    } finally {
      setBusyItems(prev => {
        const next = new Set(prev);
        next.delete(categoryId);
        return next;
      });
    }
  };

  // --- Tag Logic ---
  const handleAddTag = async () => {
    if (!newTagName.trim() || isAddingTag) return;
    setIsAddingTag(true);
    const newTag: Tag = {
      id: Math.random().toString(36).substr(2, 9),
      name: newTagName,
      color: 'bg-blue-100 text-blue-800'
    };
    try {
      await onUpdateTags([...tags, newTag]);
      setNewTagName('');
    } finally {
      setIsAddingTag(false);
    }
  };

  const handleDeleteTag = async (id: string) => {
    if (busyItems.has(id)) return;
    setBusyItems(prev => new Set(prev).add(id));
    try {
      await onUpdateTags(tags.filter(t => t.id !== id));
    } finally {
      setBusyItems(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  return (
    <div className="h-full animate-fade-in flex flex-col">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-neutral-900">Configurações</h2>
        <p className="text-neutral-500 text-sm">Gerencie usuários, categorias e tags do sistema.</p>
      </div>

      <div className="flex gap-4 border-b border-neutral-200 mb-6">
        {isMaster && (
          <button 
            onClick={() => setActiveTab('users')}
            className={`pb-2 px-1 text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'users' ? 'text-primary border-b-2 border-primary' : 'text-neutral-500 hover:text-neutral-800'}`}
          >
            <User size={16}/> Gestão de Usuários
          </button>
        )}
        <button 
          onClick={() => setActiveTab('categories')}
          className={`pb-2 px-1 text-sm font-medium transition-colors ${activeTab === 'categories' ? 'text-primary border-b-2 border-primary' : 'text-neutral-500 hover:text-neutral-800'}`}
        >
          Categorias & Subcategorias
        </button>
        <button 
           onClick={() => setActiveTab('tags')}
           className={`pb-2 px-1 text-sm font-medium transition-colors ${activeTab === 'tags' ? 'text-primary border-b-2 border-primary' : 'text-neutral-500 hover:text-neutral-800'}`}
        >
          Tags
        </button>
      </div>

      <div className="flex-1 overflow-y-auto bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
        {activeTab === 'users' && isMaster ? (
          <div className="space-y-6 max-w-4xl">
             <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-6 flex items-center gap-3">
                <ShieldCheck className="text-primary" size={24}/>
                <div>
                   <p className="text-sm font-bold text-blue-900">Modo Administrador (Master)</p>
                   <p className="text-xs text-blue-700">Você pode gerenciar quem tem acesso à plataforma.</p>
                </div>
             </div>

             <div className="flex gap-2">
              <div className="relative flex-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={16}/>
                <input 
                  type="email" 
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="E-mail do novo usuário..."
                  className="w-full pl-10 border border-neutral-300 rounded-lg py-2 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddUser()}
                />
              </div>
              <Button onClick={handleAddUser} disabled={!newUserEmail}>
                <Plus size={16} className="mr-2"/> Adicionar Usuário
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-3">
               {users.map(u => (
                 <div key={u.id} className="flex justify-between items-center bg-white border border-neutral-200 px-4 py-3 rounded-xl shadow-sm hover:border-primary transition-colors">
                    <div className="flex items-center gap-4">
                       <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${u.role === 'master' ? 'bg-primary' : 'bg-neutral-400'}`}>
                          {u.email.charAt(0).toUpperCase()}
                       </div>
                       <div>
                          <p className="text-sm font-bold text-neutral-800 flex items-center gap-2">
                            {u.email} 
                            {u.role === 'master' && <span className="text-[10px] bg-blue-100 text-primary px-1.5 py-0.5 rounded uppercase tracking-tighter">Master</span>}
                          </p>
                          <p className="text-[10px] text-neutral-400">Desde {new Date(u.createdAt).toLocaleDateString('pt-BR')}</p>
                       </div>
                    </div>
                    {u.role !== 'master' && (
                      <button 
                        onClick={() => handleDeleteUser(u.id)}
                        className="text-neutral-400 hover:text-red-500 p-2 transition-colors"
                      >
                        <X size={18}/>
                      </button>
                    )}
                 </div>
               ))}
            </div>
          </div>
        ) : activeTab === 'categories' ? (
          <div className="space-y-6 max-w-3xl">
            <div className="flex gap-2">
              <input 
                type="text" 
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Nome da nova Categoria..."
                className="flex-1 border border-neutral-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
              />
              <Button onClick={handleAddCategory} isLoading={isAddingCategory} disabled={!newCategoryName || isAddingCategory}>
                <Plus size={16} className="mr-2"/> Adicionar
              </Button>
            </div>

            <div className="space-y-3">
              {categories.map(cat => (
                <div key={cat.id} className="border border-neutral-100 rounded-lg overflow-hidden">
                  <div 
                    className="flex justify-between items-center bg-neutral-50 px-4 py-3 cursor-pointer hover:bg-neutral-100 transition-colors"
                    onClick={() => setExpandedCategory(expandedCategory === cat.id ? null : cat.id)}
                  >
                    <div className="flex items-center gap-3">
                      {expandedCategory === cat.id ? <ChevronDown size={16} className="text-neutral-400"/> : <ChevronRight size={16} className="text-neutral-400"/>}
                      <span className="font-medium text-neutral-800">{cat.name}</span>
                      <span className="text-xs bg-white border border-neutral-200 px-2 py-0.5 rounded-full text-neutral-500">
                        {cat.subcategories.length} sub
                      </span>
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDeleteCategory(cat.id); }}
                      className="text-neutral-400 hover:text-red-500 p-1 disabled:opacity-30"
                      disabled={busyItems.has(cat.id)}
                    >
                      <X size={16}/>
                    </button>
                  </div>
                  
                  {expandedCategory === cat.id && (
                    <div className="bg-white p-4 border-t border-neutral-100 animate-slide-up">
                       <div className="flex flex-wrap gap-2 mb-4">
                          {cat.subcategories.map((sub, idx) => (
                            <span key={idx} className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                              {sub}
                              <button 
                                onClick={() => handleDeleteSubcategory(cat.id, sub)}
                                className="ml-2 hover:text-blue-900 disabled:opacity-30"
                                disabled={busyItems.has(cat.id)}
                              >
                                <X size={12}/>
                              </button>
                            </span>
                          ))}
                          {cat.subcategories.length === 0 && <span className="text-neutral-400 text-xs italic">Nenhuma subcategoria</span>}
                       </div>
                       
                       <div className="flex gap-2">
                          <input 
                            type="text" 
                            value={newSubcategoryMap[cat.id] || ''}
                            onChange={(e) => setNewSubcategoryMap({...newSubcategoryMap, [cat.id]: e.target.value})}
                            placeholder={`Nova subcategoria para ${cat.name}...`}
                            className="flex-1 border border-neutral-200 rounded-lg px-3 py-1.5 text-sm focus:ring-1 focus:ring-primary focus:outline-none"
                            onKeyDown={(e) => e.key === 'Enter' && handleAddSubcategory(cat.id)}
                            disabled={busyItems.has(cat.id)}
                          />
                          <Button 
                            size="sm" 
                            variant="secondary" 
                            onClick={() => handleAddSubcategory(cat.id)}
                            isLoading={busyItems.has(cat.id)}
                            disabled={!newSubcategoryMap[cat.id] || busyItems.has(cat.id)}
                          >
                            <Plus size={14}/>
                          </Button>
                       </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-6 max-w-3xl">
             <div className="flex gap-2">
              <input 
                type="text" 
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="Nome da nova Tag..."
                className="flex-1 border border-neutral-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
              />
              <Button onClick={handleAddTag} isLoading={isAddingTag} disabled={!newTagName || isAddingTag}>
                <Plus size={16} className="mr-2"/> Criar Tag
              </Button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
               {tags.map(tag => (
                 <div key={tag.id} className="flex justify-between items-center bg-white border border-neutral-200 p-3 rounded-lg shadow-sm">
                    <div className="flex items-center gap-2">
                       <TagIcon size={14} className="text-neutral-400"/>
                       <span className="text-sm font-medium text-neutral-700">{tag.name}</span>
                    </div>
                    <button 
                      onClick={() => handleDeleteTag(tag.id)}
                      className="text-neutral-400 hover:text-red-500 disabled:opacity-30"
                      disabled={busyItems.has(tag.id)}
                    >
                      <X size={14}/>
                    </button>
                 </div>
               ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
