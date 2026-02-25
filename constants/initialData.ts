
import type { Category, Tag } from '../types.ts';

export const INITIAL_CATEGORIES: Category[] = [
  { id: 'c1', name: 'Alimentação',  subcategories: ['Restaurante', 'Mercado'],     color: '#EF4444' },
  { id: 'c2', name: 'Transporte',   subcategories: ['Uber/99', 'Combustível'],     color: '#F59E0B' },
  { id: 'c3', name: 'Compras',      subcategories: ['Roupas', 'Eletrônicos'],      color: '#3B82F6' },
  { id: 'c4', name: 'Saúde',        subcategories: ['Médico', 'Farmácia'],         color: '#10B981' },
  { id: 'c5', name: 'Educação',     subcategories: ['Cursos', 'Livros'],           color: '#8B5CF6' },
  { id: 'c6', name: 'Viagem',       subcategories: ['Hospedagem', 'Passagem'],     color: '#EC4899' },
  { id: 'c7', name: 'Serviços',     subcategories: ['Assinaturas', 'Manutenção'], color: '#6366F1' },
  { id: 'c8', name: 'Outros',       subcategories: [],                             color: '#9CA3AF' },
];

export const DEFAULT_TAGS: Tag[] = [
  { id: 'tag-pessoal', name: 'Despesas Pessoais', color: 'bg-blue-100 text-blue-700' },
  { id: 'tag-empresa', name: 'Empresa',           color: 'bg-purple-100 text-purple-700' },
];
