
import React, { useState, useEffect, useMemo } from 'react';
import { Plus, X, CheckCircle2, Clock, AlertTriangle, Zap, ChevronRight, Trash2, Calendar } from 'lucide-react';
import { Task } from '../types.ts';
import { dataService } from '../services/dataService.ts';
import { Button } from './ui/Button.tsx';

interface TasksProps {
  userId: string;
  onToast: (message: string, type: 'success' | 'error') => void;
}

type TaskStatus = Task['status'];
type TaskPriority = Task['priority'];

const COLUMNS: { status: TaskStatus; label: string; color: string; bg: string; ring: string }[] = [
  { status: 'todo',        label: 'A Fazer',   color: 'text-neutral-500', bg: 'bg-neutral-50',  ring: 'ring-neutral-200' },
  { status: 'in_progress', label: 'Fazendo',   color: 'text-blue-600',    bg: 'bg-blue-50',     ring: 'ring-blue-200'    },
  { status: 'done',        label: 'Concluído', color: 'text-green-600',   bg: 'bg-green-50',    ring: 'ring-green-200'   },
  { status: 'cancelled',   label: 'Cancelado', color: 'text-red-400',     bg: 'bg-red-50',      ring: 'ring-red-200'     },
];

const PRIORITY_META: Record<TaskPriority, { label: string; color: string; icon: React.ReactNode }> = {
  low:    { label: 'Baixa',   color: 'bg-neutral-100 text-neutral-500', icon: <Clock size={10} /> },
  medium: { label: 'Média',   color: 'bg-yellow-100 text-yellow-700',   icon: <AlertTriangle size={10} /> },
  high:   { label: 'Alta',    color: 'bg-orange-100 text-orange-700',   icon: <AlertTriangle size={10} /> },
  urgent: { label: 'Urgente', color: 'bg-red-100 text-red-700',         icon: <Zap size={10} /> },
};

const NEXT_STATUS: Record<TaskStatus, TaskStatus | null> = {
  todo:        'in_progress',
  in_progress: 'done',
  done:        null,
  cancelled:   'todo',
};

const NEXT_STATUS_LABEL: Record<TaskStatus, string> = {
  todo:        'Iniciar',
  in_progress: 'Concluir',
  done:        '',
  cancelled:   'Reabrir',
};

function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function isOverdue(dateStr?: string, status?: TaskStatus): boolean {
  if (!dateStr || status === 'done' || status === 'cancelled') return false;
  return new Date(dateStr) < new Date(new Date().toISOString().split('T')[0]);
}

const EMPTY_FORM = { title: '', description: '', priority: 'medium' as TaskPriority, dueDate: '' };

export const Tasks: React.FC<TasksProps> = ({ userId, onToast }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => { loadTasks(); }, [userId]);

  const loadTasks = async () => {
    try {
      setLoading(true);
      const data = await dataService.getTasks(userId);
      setTasks(data);
    } catch (e: any) {
      onToast('Erro ao carregar tarefas: ' + (e.message || 'verifique sua conexão.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => ({
    total:     tasks.length,
    done:      tasks.filter(t => t.status === 'done').length,
    pending:   tasks.filter(t => t.status === 'todo' || t.status === 'in_progress').length,
    overdue:   tasks.filter(t => isOverdue(t.dueDate, t.status)).length,
  }), [tasks]);

  const handleCreate = async () => {
    if (!form.title.trim()) { onToast('Informe o título da tarefa.', 'error'); return; }
    setSaving(true);
    try {
      const newTask: Task = {
        id: crypto.randomUUID(),
        userId,
        createdAt: new Date().toISOString(),
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        status: 'todo',
        priority: form.priority,
        dueDate: form.dueDate || undefined,
      };
      await dataService.saveTask(newTask, userId);
      setTasks(prev => [newTask, ...prev]);
      setForm(EMPTY_FORM);
      setShowForm(false);
      onToast('Tarefa criada com sucesso!', 'success');
    } catch (e: any) {
      onToast('Erro ao criar tarefa: ' + (e.message || ''), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleMove = async (task: Task, newStatus: TaskStatus) => {
    const updated = { ...task, status: newStatus };
    setTasks(prev => prev.map(t => t.id === task.id ? updated : t));
    try {
      await dataService.saveTask(updated, userId);
    } catch (e: any) {
      setTasks(prev => prev.map(t => t.id === task.id ? task : t));
      onToast('Erro ao atualizar tarefa.', 'error');
    }
  };

  const handleCancel = async (task: Task) => {
    await handleMove(task, 'cancelled');
  };

  const handleDelete = async (taskId: string) => {
    if (!window.confirm('Excluir tarefa permanentemente?')) return;
    setDeletingId(taskId);
    try {
      await dataService.deleteTask(taskId, userId);
      setTasks(prev => prev.filter(t => t.id !== taskId));
      onToast('Tarefa excluída.', 'success');
    } catch (e: any) {
      onToast('Erro ao excluir tarefa.', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const tasksByStatus = useMemo(() => {
    const map: Record<TaskStatus, Task[]> = { todo: [], in_progress: [], done: [], cancelled: [] };
    tasks.forEach(t => map[t.status].push(t));
    return map;
  }, [tasks]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-neutral-100 shadow-sm">
          <p className="text-[10px] font-bold uppercase text-neutral-400 mb-1">Total</p>
          <p className="text-3xl font-black text-neutral-900">{stats.total}</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-green-100 shadow-sm">
          <p className="text-[10px] font-bold uppercase text-green-600 mb-1 flex items-center gap-1"><CheckCircle2 size={11}/>Concluídas</p>
          <p className="text-3xl font-black text-green-700">{stats.done}</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-blue-100 shadow-sm">
          <p className="text-[10px] font-bold uppercase text-blue-600 mb-1 flex items-center gap-1"><Clock size={11}/>Pendentes</p>
          <p className="text-3xl font-black text-blue-700">{stats.pending}</p>
        </div>
        <div className={`bg-white p-5 rounded-xl border shadow-sm ${stats.overdue > 0 ? 'border-red-200' : 'border-neutral-100'}`}>
          <p className={`text-[10px] font-bold uppercase mb-1 flex items-center gap-1 ${stats.overdue > 0 ? 'text-red-500' : 'text-neutral-400'}`}>
            <AlertTriangle size={11}/>Atrasadas
          </p>
          <p className={`text-3xl font-black ${stats.overdue > 0 ? 'text-red-600' : 'text-neutral-900'}`}>{stats.overdue}</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex justify-between items-center">
        <h2 className="text-sm font-bold text-neutral-700 uppercase tracking-wide">Quadro Kanban</h2>
        <Button onClick={() => setShowForm(v => !v)} size="sm">
          <Plus size={14} className="mr-1" /> Nova Tarefa
        </Button>
      </div>

      {/* New task inline form */}
      {showForm && (
        <div className="bg-white border border-primary/30 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-neutral-800">Nova Tarefa</h3>
            <button onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }} className="text-neutral-400 hover:text-neutral-700">
              <X size={16} />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="text-[10px] font-bold uppercase text-neutral-500 block mb-1">Título *</label>
              <input
                autoFocus
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                placeholder="Ex: Revisar extrato bancário..."
                className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-[10px] font-bold uppercase text-neutral-500 block mb-1">Descrição</label>
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={2}
                placeholder="Detalhes opcionais..."
                className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-neutral-500 block mb-1">Prioridade</label>
              <select
                value={form.priority}
                onChange={e => setForm(f => ({ ...f, priority: e.target.value as TaskPriority }))}
                className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="low">Baixa</option>
                <option value="medium">Média</option>
                <option value="high">Alta</option>
                <option value="urgent">Urgente</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-neutral-500 block mb-1">Data de Vencimento</label>
              <input
                type="date"
                value={form.dueDate}
                onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }}>Cancelar</Button>
            <Button size="sm" onClick={handleCreate} disabled={saving}>
              {saving ? 'Salvando...' : 'Criar Tarefa'}
            </Button>
          </div>
        </div>
      )}

      {/* Kanban board */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {COLUMNS.map(col => (
          <div key={col.status} className={`rounded-xl ring-1 ${col.ring} ${col.bg} p-4 flex flex-col gap-3 min-h-[300px]`}>
            {/* Column header */}
            <div className="flex items-center justify-between mb-1">
              <span className={`text-xs font-bold uppercase ${col.color}`}>{col.label}</span>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${col.bg} ring-1 ${col.ring} ${col.color}`}>
                {tasksByStatus[col.status].length}
              </span>
            </div>

            {/* Task cards */}
            {tasksByStatus[col.status].length === 0 && (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-[11px] text-neutral-400 italic">Nenhuma tarefa</p>
              </div>
            )}
            {tasksByStatus[col.status].map(task => {
              const pm = PRIORITY_META[task.priority];
              const overdue = isOverdue(task.dueDate, task.status);
              const nextStatus = NEXT_STATUS[task.status];
              const isDeleting = deletingId === task.id;
              return (
                <div key={task.id} className="bg-white rounded-lg shadow-sm border border-neutral-100 p-3 flex flex-col gap-2 hover:shadow-md transition-shadow">
                  {/* Priority badge */}
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${pm.color}`}>
                      {pm.icon} {pm.label}
                    </span>
                    <button
                      onClick={() => handleDelete(task.id)}
                      disabled={isDeleting}
                      className="text-neutral-300 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>

                  {/* Title */}
                  <p className={`text-sm font-semibold leading-snug ${task.status === 'done' ? 'line-through text-neutral-400' : 'text-neutral-800'}`}>
                    {task.title}
                  </p>

                  {/* Description */}
                  {task.description && (
                    <p className="text-[11px] text-neutral-500 leading-relaxed line-clamp-2">{task.description}</p>
                  )}

                  {/* Due date */}
                  {task.dueDate && (
                    <div className={`flex items-center gap-1 text-[10px] font-medium ${overdue ? 'text-red-500' : 'text-neutral-400'}`}>
                      <Calendar size={10} />
                      {overdue && <AlertTriangle size={10} />}
                      {formatDate(task.dueDate)}
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex gap-1.5 pt-1 border-t border-neutral-50">
                    {nextStatus && (
                      <button
                        onClick={() => handleMove(task, nextStatus)}
                        className="flex-1 flex items-center justify-center gap-1 text-[10px] font-bold uppercase text-primary bg-blue-50 hover:bg-blue-100 rounded-md py-1 transition-colors"
                      >
                        <ChevronRight size={10} /> {NEXT_STATUS_LABEL[task.status]}
                      </button>
                    )}
                    {task.status !== 'cancelled' && task.status !== 'done' && (
                      <button
                        onClick={() => handleCancel(task)}
                        className="flex items-center justify-center gap-1 text-[10px] font-bold uppercase text-red-400 bg-red-50 hover:bg-red-100 rounded-md px-2 py-1 transition-colors"
                      >
                        <X size={10} /> Cancelar
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};
