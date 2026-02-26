
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Circle, CheckCircle2, Trash2, Calendar, Folder, Star, AlertTriangle,
  Plus, Inbox, CalendarDays, X, Save
} from 'lucide-react';
import { Task, Project } from '../types.ts';
import { dataService } from '../services/dataService.ts';

interface TasksProps {
  userId: string;
  onToast: (message: string, type: 'success' | 'error') => void;
}

type TaskPriority = Task['priority'];
type ViewMode = 'all' | 'today' | 'week' | string;

// ─────────── helpers ───────────

const dateStr = (offset = 0): string => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().split('T')[0];
};

const fmtDate = (s?: string) => {
  if (!s) return '';
  const [, m, d] = s.split('-');
  return `${d}/${m}`;
};

const isOverdue = (due?: string, status?: Task['status']) =>
  !!due && status !== 'done' && status !== 'cancelled' && due < dateStr();

// ─────────── priority meta ───────────

const P: Record<TaskPriority, { label: string; dot: string; text: string; selectCls: string }> = {
  low:    { label: 'Baixa',   dot: 'bg-neutral-300', text: 'text-neutral-400', selectCls: 'text-neutral-500' },
  medium: { label: 'Média',   dot: 'bg-yellow-400',  text: 'text-yellow-600',  selectCls: 'text-yellow-600' },
  high:   { label: 'Alta',    dot: 'bg-orange-400',  text: 'text-orange-600',  selectCls: 'text-orange-600' },
  urgent: { label: 'Urgente', dot: 'bg-red-500',     text: 'text-red-600',     selectCls: 'text-red-600' },
};

// ─────────── project palette ───────────

const PALETTE = [
  'text-blue-500', 'text-purple-500', 'text-green-500',
  'text-orange-500', 'text-pink-500', 'text-teal-500',
  'text-indigo-500', 'text-rose-500',
];

// ─────────── section grouping ───────────

type SectionKey = 'overdue' | 'today' | 'soon' | 'later' | 'nodate';

const SECTION_META: Record<SectionKey, { label: string; headerCls: string }> = {
  overdue: { label: 'Atrasadas',       headerCls: 'text-red-500 border-red-200' },
  today:   { label: 'Hoje',            headerCls: 'text-orange-500 border-orange-200' },
  soon:    { label: 'Próximos 7 Dias', headerCls: 'text-blue-500 border-blue-200' },
  later:   { label: 'Mais Tarde',      headerCls: 'text-neutral-400 border-neutral-200' },
  nodate:  { label: 'Sem Data',        headerCls: 'text-neutral-400 border-neutral-200' },
};

function getSection(task: Task): SectionKey {
  const { dueDate: d, status } = task;
  if (!d) return 'nodate';
  const today = dateStr();
  const in7 = dateStr(7);
  if (d < today && status !== 'done' && status !== 'cancelled') return 'overdue';
  if (d === today) return 'today';
  if (d <= in7) return 'soon';
  return 'later';
}

// ─────────── edit draft type ───────────

interface EditDraft {
  title: string;
  description: string;
  dueDate: string;
  projectId: string;
  priority: TaskPriority;
}

// ─────────── main component ───────────

export const Tasks: React.FC<TasksProps> = ({ userId, onToast }) => {
  const [tasks, setTasks]       = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading]   = useState(true);
  const [view, setView]         = useState<ViewMode>('all');

  // quick-add
  const [addText, setAddText]       = useState('');
  const [addFocused, setAddFocused] = useState(false);
  const [saving, setSaving]         = useState(false);
  const addRef = useRef<HTMLInputElement>(null);

  // done animation
  const [justDone, setJustDone] = useState<Set<string>>(new Set());

  // edit panel
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editDraft, setEditDraft]     = useState<EditDraft>({ title: '', description: '', dueDate: '', projectId: '', priority: 'medium' });
  const [editSaving, setEditSaving]   = useState(false);

  useEffect(() => { load(); }, [userId]);

  const load = async () => {
    try {
      setLoading(true);
      const [t, p] = await Promise.all([
        dataService.getTasks(userId),
        dataService.getProjects(userId),
      ]);
      setTasks(t);
      setProjects(p);
    } catch (e: any) {
      onToast('Erro ao carregar tarefas: ' + (e.message || ''), 'error');
    } finally {
      setLoading(false);
    }
  };

  // ── project maps ──
  const projColor = useMemo(() => {
    const m: Record<string, string> = {};
    projects.forEach((p, i) => { m[p.id] = PALETTE[i % PALETTE.length]; });
    return m;
  }, [projects]);

  const projName = useMemo(() => {
    const m: Record<string, string> = {};
    projects.forEach(p => { m[p.id] = p.name; });
    return m;
  }, [projects]);

  // ── filter by view ──
  const visible = useMemo(() => {
    const today = dateStr();
    const in7   = dateStr(7);
    let base = tasks.filter(t => t.status !== 'cancelled');
    if (view === 'today') {
      base = base.filter(t => t.dueDate === today || isOverdue(t.dueDate, t.status));
    } else if (view === 'week') {
      base = base.filter(t => (t.dueDate && t.dueDate <= in7) || isOverdue(t.dueDate, t.status));
    } else if (view !== 'all') {
      base = base.filter(t => t.projectId === view);
    }
    return base;
  }, [tasks, view]);

  // ── group sections ──
  const sections = useMemo(() => {
    const active = visible.filter(t => t.status !== 'done');
    const done   = visible.filter(t => t.status === 'done');
    const map: Partial<Record<SectionKey, Task[]>> = {};
    active.forEach(t => {
      const k = getSection(t);
      if (!map[k]) map[k] = [];
      map[k]!.push(t);
    });
    const result: { key: SectionKey | 'done'; tasks: Task[] }[] = [];
    const ORDER: SectionKey[] = ['overdue', 'today', 'soon', 'later', 'nodate'];
    ORDER.forEach(k => { if (map[k]?.length) result.push({ key: k, tasks: map[k]! }); });
    if (done.length) result.push({ key: 'done', tasks: done });
    return result;
  }, [visible]);

  // ── sidebar counts ──
  const todayCount = useMemo(() =>
    tasks.filter(t => t.status !== 'done' && t.status !== 'cancelled' &&
      (t.dueDate === dateStr() || isOverdue(t.dueDate, t.status))).length
  , [tasks]);

  const weekCount = useMemo(() =>
    tasks.filter(t => t.status !== 'done' && t.status !== 'cancelled' &&
      t.dueDate && t.dueDate <= dateStr(7)).length
  , [tasks]);

  const projCount = useMemo(() => {
    const m: Record<string, number> = {};
    tasks.filter(t => t.status !== 'done' && t.status !== 'cancelled' && t.projectId)
      .forEach(t => { m[t.projectId!] = (m[t.projectId!] || 0) + 1; });
    return m;
  }, [tasks]);

  // ── handlers ──

  const handleCheck = async (task: Task) => {
    const newStatus = task.status === 'done' ? 'todo' : 'done';
    const updated = { ...task, status: newStatus } as Task;
    if (newStatus === 'done') {
      setJustDone(s => new Set(s).add(task.id));
      setTimeout(() => {
        setTasks(prev => prev.map(t => t.id === task.id ? updated : t));
        setJustDone(s => { const n = new Set(s); n.delete(task.id); return n; });
      }, 600);
    } else {
      setTasks(prev => prev.map(t => t.id === task.id ? updated : t));
    }
    try {
      await dataService.saveTask(updated, userId);
    } catch {
      setTasks(prev => prev.map(t => t.id === task.id ? task : t));
      onToast('Erro ao atualizar tarefa.', 'error');
    }
  };

  const handleDelete = async (taskId: string) => {
    if (editingTask?.id === taskId) setEditingTask(null);
    setTasks(prev => prev.filter(t => t.id !== taskId));
    try {
      await dataService.deleteTask(taskId, userId);
    } catch {
      onToast('Erro ao excluir tarefa.', 'error');
      load();
    }
  };

  const handleQuickAdd = async () => {
    const title = addText.trim();
    if (!title) return;
    setSaving(true);
    try {
      const today = dateStr();
      const newTask: Task = {
        id: crypto.randomUUID(),
        userId,
        createdAt: new Date().toISOString(),
        title,
        status: 'todo',
        priority: 'medium',
        dueDate:   (view === 'today' || view === 'week') ? today : undefined,
        projectId: (view !== 'all' && view !== 'today' && view !== 'week') ? view : undefined,
      };
      await dataService.saveTask(newTask, userId);
      setTasks(prev => [newTask, ...prev]);
      setAddText('');
      onToast('Tarefa criada!', 'success');
    } catch (e: any) {
      onToast('Erro ao criar tarefa: ' + (e.message || ''), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenEdit = (task: Task) => {
    setEditingTask(task);
    setEditDraft({
      title:       task.title,
      description: task.description || '',
      dueDate:     task.dueDate     || '',
      projectId:   task.projectId   || '',
      priority:    task.priority,
    });
  };

  const handleSaveEdit = async () => {
    if (!editingTask) return;
    setEditSaving(true);
    const updated: Task = {
      ...editingTask,
      title:       editDraft.title.trim() || editingTask.title,
      description: editDraft.description.trim() || undefined,
      dueDate:     editDraft.dueDate     || undefined,
      projectId:   editDraft.projectId   || undefined,
      priority:    editDraft.priority,
    };
    try {
      await dataService.saveTask(updated, userId);
      setTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
      setEditingTask(null);
      onToast('Tarefa atualizada!', 'success');
    } catch (e: any) {
      onToast('Erro ao salvar: ' + (e.message || ''), 'error');
    } finally {
      setEditSaving(false);
    }
  };

  const viewLabel = useMemo(() => {
    if (view === 'all')   return 'Todas as Tarefas';
    if (view === 'today') return 'Hoje';
    if (view === 'week')  return 'Próximos 7 Dias';
    return projName[view] || 'Projeto';
  }, [view, projName]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="flex -m-8 h-[calc(100vh-4rem)] overflow-hidden">

      {/* ─── Left Sidebar ─── */}
      <aside className="w-52 flex-shrink-0 bg-white border-r border-neutral-100 flex flex-col overflow-y-auto">
        <div className="p-4 border-b border-neutral-100">
          <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Tarefas</p>
        </div>
        <nav className="p-2 space-y-0.5">
          <SidebarItem icon={<Inbox size={15} />} label="Todas"
            count={tasks.filter(t => t.status !== 'done' && t.status !== 'cancelled').length}
            active={view === 'all'} onClick={() => setView('all')} />
          <SidebarItem icon={<Star size={15} />} label="Hoje"
            count={todayCount} active={view === 'today'} onClick={() => setView('today')}
            countCls="bg-orange-100 text-orange-600" />
          <SidebarItem icon={<CalendarDays size={15} />} label="Próximos 7 Dias"
            count={weekCount} active={view === 'week'} onClick={() => setView('week')}
            countCls="bg-blue-100 text-blue-600" />
        </nav>
        <div className="px-2 pt-4 pb-2">
          <p className="text-[9px] font-black uppercase tracking-widest text-neutral-400 px-2 mb-1">Listas</p>
          {projects.length === 0 && (
            <p className="text-[11px] text-neutral-400 px-2 py-2 italic">Nenhum projeto</p>
          )}
          {projects.map((proj, i) => (
            <SidebarItem key={proj.id}
              icon={<Folder size={15} className={PALETTE[i % PALETTE.length]} />}
              label={proj.name} count={projCount[proj.id] || 0}
              active={view === proj.id} onClick={() => setView(proj.id)} />
          ))}
        </div>
      </aside>

      {/* ─── Main list ─── */}
      <main className="flex-1 flex flex-col overflow-hidden bg-[#F6F7FB] min-w-0">
        <div className="px-8 pt-6 pb-4">
          <h2 className="text-lg font-black text-neutral-800">{viewLabel}</h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            {visible.filter(t => t.status !== 'done').length} tarefa(s) pendente(s)
          </p>
        </div>

        {/* Quick-add */}
        <div className="px-8 pb-4">
          <div className={`flex items-center gap-3 bg-white rounded-xl px-4 py-3 border transition-all ${addFocused ? 'border-primary shadow-sm ring-2 ring-primary/10' : 'border-neutral-200'}`}>
            <Plus size={16} className={addFocused ? 'text-primary' : 'text-neutral-300'} />
            <input
              ref={addRef}
              value={addText}
              onChange={e => setAddText(e.target.value)}
              onFocus={() => setAddFocused(true)}
              onBlur={() => setAddFocused(false)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleQuickAdd();
                if (e.key === 'Escape') { setAddText(''); addRef.current?.blur(); }
              }}
              placeholder="Adicionar nova tarefa..."
              className="flex-1 text-sm text-neutral-800 placeholder-neutral-400 bg-transparent outline-none"
              disabled={saving}
            />
            {addText && (
              <button
                onMouseDown={e => { e.preventDefault(); handleQuickAdd(); }}
                className="text-[10px] font-bold uppercase text-primary bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded-lg transition-colors"
              >
                {saving ? '...' : 'Adicionar'}
              </button>
            )}
          </div>
        </div>

        {/* Task list */}
        <div className="flex-1 overflow-y-auto px-8 pb-8 space-y-6">
          {sections.length === 0 && (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <CheckCircle2 size={36} className="text-neutral-200 mb-3" />
              <p className="text-sm font-semibold text-neutral-400">Nenhuma tarefa aqui</p>
              <p className="text-xs text-neutral-300 mt-1">Use o campo acima para adicionar</p>
            </div>
          )}
          {sections.map(({ key, tasks: sectionTasks }) => {
            const isDoneSection = key === 'done';
            const meta = isDoneSection
              ? { label: 'Concluídas', headerCls: 'text-neutral-400 border-neutral-200' }
              : SECTION_META[key as SectionKey];
            return (
              <div key={key}>
                <div className={`flex items-center gap-2 mb-2 pb-1.5 border-b ${meta.headerCls}`}>
                  <span className={`text-[10px] font-black uppercase tracking-wider ${meta.headerCls.split(' ')[0]}`}>{meta.label}</span>
                  <span className={`text-[10px] font-bold ${meta.headerCls.split(' ')[0]}`}>{sectionTasks.length}</span>
                </div>
                <div className="space-y-1">
                  {sectionTasks.map(task => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      isDone={isDoneSection || justDone.has(task.id)}
                      isJustDone={justDone.has(task.id)}
                      isEditing={editingTask?.id === task.id}
                      projectName={task.projectId ? projName[task.projectId] : undefined}
                      projectColor={task.projectId ? projColor[task.projectId] : undefined}
                      onCheck={() => handleCheck(task)}
                      onDelete={() => handleDelete(task.id)}
                      onEdit={() => handleOpenEdit(task)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* ─── Detail / Edit panel ─── */}
      <div className={`flex-shrink-0 bg-white border-l border-neutral-200 flex flex-col transition-all duration-200 ease-in-out overflow-hidden ${editingTask ? 'w-80' : 'w-0'}`}>
        {editingTask && (
          <TaskDetailPanel
            draft={editDraft}
            projects={projects}
            saving={editSaving}
            onChange={patch => setEditDraft(prev => ({ ...prev, ...patch }))}
            onSave={handleSaveEdit}
            onClose={() => setEditingTask(null)}
          />
        )}
      </div>
    </div>
  );
};

// ─────────── TaskRow ───────────

interface TaskRowProps {
  task: Task;
  isDone: boolean;
  isJustDone: boolean;
  isEditing: boolean;
  projectName?: string;
  projectColor?: string;
  onCheck: () => void;
  onDelete: () => void;
  onEdit: () => void;
}

const TaskRow: React.FC<TaskRowProps> = ({
  task, isDone, isJustDone, isEditing, projectName, projectColor, onCheck, onDelete, onEdit
}) => {
  const [hovered, setHovered] = useState(false);
  const pm = P[task.priority];
  const overdue = isOverdue(task.dueDate, task.status);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`group flex items-center gap-3 bg-white rounded-xl px-4 py-2.5 border transition-all
        ${isEditing ? 'border-primary ring-1 ring-primary/20' : 'border-transparent hover:border-neutral-200 hover:shadow-sm'}
        ${isJustDone ? 'opacity-50 scale-[0.99]' : ''}`}
    >
      {/* Checkbox */}
      <button
        onClick={onCheck}
        className={`flex-shrink-0 transition-colors ${isDone ? 'text-green-500' : 'text-neutral-300 hover:text-primary'}`}
      >
        {isDone ? <CheckCircle2 size={18} /> : <Circle size={18} />}
      </button>

      {/* Title — clickable to open panel */}
      <span
        onClick={onEdit}
        className={`flex-1 text-sm min-w-0 truncate cursor-pointer transition-colors
          ${isDone ? 'line-through text-neutral-400' : 'text-neutral-800 font-medium hover:text-primary'}`}
      >
        {task.title}
      </span>

      {/* Right meta */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {projectName && (
          <span className={`hidden sm:inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-neutral-50 ${projectColor || 'text-neutral-500'}`}>
            <Folder size={9} /> {projectName}
          </span>
        )}
        {task.dueDate && (
          <span className={`flex items-center gap-1 text-[10px] font-medium ${overdue ? 'text-red-500' : 'text-neutral-400'}`}>
            {overdue && <AlertTriangle size={10} />}
            <Calendar size={10} />
            {fmtDate(task.dueDate)}
          </span>
        )}
        <span className={`flex items-center gap-1 text-[10px] font-bold ${pm.text}`}>
          <span className={`w-2 h-2 rounded-full ${pm.dot}`} />
          {pm.label}
        </span>
        <button
          onClick={onDelete}
          className={`transition-opacity ${hovered ? 'opacity-100' : 'opacity-0'} text-neutral-300 hover:text-red-400`}
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
};

// ─────────── TaskDetailPanel ───────────

interface TaskDetailPanelProps {
  draft: EditDraft;
  projects: Project[];
  saving: boolean;
  onChange: (patch: Partial<EditDraft>) => void;
  onSave: () => void;
  onClose: () => void;
}

const TaskDetailPanel: React.FC<TaskDetailPanelProps> = ({
  draft, projects, saving, onChange, onSave, onClose
}) => {
  const titleRef = useRef<HTMLInputElement>(null);
  useEffect(() => { setTimeout(() => titleRef.current?.focus(), 50); }, []);

  return (
    <div className="flex flex-col h-full w-80">
      {/* Panel header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
        <p className="text-xs font-black uppercase tracking-widest text-neutral-500">Detalhes</p>
        <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700 transition-colors">
          <X size={16} />
        </button>
      </div>

      {/* Fields */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
        {/* Title */}
        <div>
          <label className="text-[10px] font-bold uppercase text-neutral-400 block mb-1">Título</label>
          <input
            ref={titleRef}
            value={draft.title}
            onChange={e => onChange({ title: e.target.value })}
            onKeyDown={e => { if (e.key === 'Enter') onSave(); }}
            className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 text-neutral-800"
          />
        </div>

        {/* Description */}
        <div>
          <label className="text-[10px] font-bold uppercase text-neutral-400 block mb-1">Descrição</label>
          <textarea
            value={draft.description}
            onChange={e => onChange({ description: e.target.value })}
            rows={4}
            placeholder="Adicione detalhes..."
            className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 text-neutral-800 resize-none"
          />
        </div>

        {/* Due date */}
        <div>
          <label className="text-[10px] font-bold uppercase text-neutral-400 block mb-1">Data de Vencimento</label>
          <input
            type="date"
            value={draft.dueDate}
            onChange={e => onChange({ dueDate: e.target.value })}
            className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 text-neutral-800"
          />
        </div>

        {/* Project */}
        <div>
          <label className="text-[10px] font-bold uppercase text-neutral-400 block mb-1">Lista / Projeto</label>
          <select
            value={draft.projectId}
            onChange={e => onChange({ projectId: e.target.value })}
            className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 text-neutral-800 bg-white"
          >
            <option value="">— Sem projeto —</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* Priority */}
        <div>
          <label className="text-[10px] font-bold uppercase text-neutral-400 block mb-1">Prioridade</label>
          <div className="grid grid-cols-2 gap-2">
            {(['low', 'medium', 'high', 'urgent'] as TaskPriority[]).map(prio => (
              <button
                key={prio}
                onClick={() => onChange({ priority: prio })}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-bold transition-all
                  ${draft.priority === prio
                    ? 'border-primary bg-blue-50 text-primary'
                    : 'border-neutral-200 text-neutral-500 hover:border-neutral-300'
                  }`}
              >
                <span className={`w-2 h-2 rounded-full ${P[prio].dot}`} />
                {P[prio].label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Save button */}
      <div className="px-5 py-4 border-t border-neutral-100">
        <button
          onClick={onSave}
          disabled={saving || !draft.title.trim()}
          className="w-full flex items-center justify-center gap-2 bg-primary text-white text-sm font-bold py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Save size={14} />
          {saving ? 'Salvando...' : 'Salvar Alterações'}
        </button>
      </div>
    </div>
  );
};

// ─────────── SidebarItem ───────────

interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  countCls?: string;
}

const SidebarItem: React.FC<SidebarItemProps> = ({
  icon, label, count, active, onClick, countCls = 'bg-neutral-100 text-neutral-500'
}) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all text-left
      ${active ? 'bg-blue-50 text-primary font-semibold' : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'}`}
  >
    <span className={active ? 'text-primary' : 'text-neutral-400'}>{icon}</span>
    <span className="flex-1 truncate">{label}</span>
    {count > 0 && (
      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${active ? 'bg-primary/10 text-primary' : countCls}`}>
        {count}
      </span>
    )}
  </button>
);
