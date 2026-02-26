
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Circle, CheckCircle2, Trash2, Calendar, Folder, Star, Clock, AlertTriangle,
  Zap, ChevronRight, Plus, Inbox, CalendarDays
} from 'lucide-react';
import { Task, Project } from '../types.ts';
import { dataService } from '../services/dataService.ts';

interface TasksProps {
  userId: string;
  onToast: (message: string, type: 'success' | 'error') => void;
}

type TaskPriority = Task['priority'];
type ViewMode = 'all' | 'today' | 'week' | string; // string → project id

// ─────────── helpers ───────────

const dateStr = (offset = 0): string => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().split('T')[0];
};

const fmtDate = (s?: string) => {
  if (!s) return '';
  const [y, m, d] = s.split('-');
  return `${d}/${m}`;
};

const isOverdue = (due?: string, status?: Task['status']) =>
  !!due && status !== 'done' && status !== 'cancelled' && due < dateStr();

// ─────────── priority meta ───────────

const P: Record<TaskPriority, { label: string; dot: string; text: string }> = {
  low:    { label: 'Baixa',   dot: 'bg-neutral-300',  text: 'text-neutral-400' },
  medium: { label: 'Média',   dot: 'bg-yellow-400',   text: 'text-yellow-600' },
  high:   { label: 'Alta',    dot: 'bg-orange-400',   text: 'text-orange-600' },
  urgent: { label: 'Urgente', dot: 'bg-red-500',      text: 'text-red-600' },
};

// ─────────── project palette ───────────

const PALETTE = [
  'text-blue-500',   'text-purple-500', 'text-green-500',
  'text-orange-500', 'text-pink-500',   'text-teal-500',
  'text-indigo-500', 'text-rose-500',
];

// ─────────── section grouping ───────────

type SectionKey = 'overdue' | 'today' | 'soon' | 'later' | 'nodate';

const SECTION_META: Record<SectionKey, { label: string; headerCls: string }> = {
  overdue: { label: 'Atrasadas',      headerCls: 'text-red-500 border-red-200' },
  today:   { label: 'Hoje',           headerCls: 'text-orange-500 border-orange-200' },
  soon:    { label: 'Próximos 7 Dias', headerCls: 'text-blue-500 border-blue-200' },
  later:   { label: 'Mais Tarde',     headerCls: 'text-neutral-400 border-neutral-200' },
  nodate:  { label: 'Sem Data',       headerCls: 'text-neutral-400 border-neutral-200' },
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

// ─────────── main component ───────────

export const Tasks: React.FC<TasksProps> = ({ userId, onToast }) => {
  const [tasks, setTasks]       = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading]   = useState(true);
  const [view, setView]         = useState<ViewMode>('all');

  // quick-add state
  const [addText, setAddText]       = useState('');
  const [addFocused, setAddFocused] = useState(false);
  const [saving, setSaving]         = useState(false);
  const addRef = useRef<HTMLInputElement>(null);

  // per-task transient done animation
  const [justDone, setJustDone] = useState<Set<string>>(new Set());

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

  // ── project color map ──
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
      base = base.filter(t =>
        (t.dueDate && t.dueDate <= in7) || isOverdue(t.dueDate, t.status)
      );
    } else if (view !== 'all') {
      // project id
      base = base.filter(t => t.projectId === view);
    }
    return base;
  }, [tasks, view]);

  // ── group into sections ──
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

  // ── stats for sidebar badges ──
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
    setTasks(prev => prev.filter(t => t.id !== taskId));
    try {
      await dataService.deleteTask(taskId, userId);
    } catch (e: any) {
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
        dueDate: view === 'today' ? today : view === 'week' ? today : undefined,
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

  // ── sidebar view label ──
  const viewLabel = useMemo(() => {
    if (view === 'all') return 'Todas as Tarefas';
    if (view === 'today') return 'Hoje';
    if (view === 'week') return 'Próximos 7 Dias';
    return projName[view] || 'Projeto';
  }, [view, projName]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="flex -m-8 h-[calc(100vh-4rem)] overflow-hidden">

      {/* ─── Sidebar ─── */}
      <aside className="w-52 flex-shrink-0 bg-white border-r border-neutral-100 flex flex-col overflow-y-auto">
        <div className="p-4 border-b border-neutral-100">
          <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Tarefas</p>
        </div>

        {/* Quick nav */}
        <nav className="p-2 space-y-0.5">
          <SidebarItem
            icon={<Inbox size={15} />}
            label="Todas"
            count={tasks.filter(t => t.status !== 'done' && t.status !== 'cancelled').length}
            active={view === 'all'}
            onClick={() => setView('all')}
          />
          <SidebarItem
            icon={<Star size={15} />}
            label="Hoje"
            count={todayCount}
            active={view === 'today'}
            onClick={() => setView('today')}
            countCls="bg-orange-100 text-orange-600"
          />
          <SidebarItem
            icon={<CalendarDays size={15} />}
            label="Próximos 7 Dias"
            count={weekCount}
            active={view === 'week'}
            onClick={() => setView('week')}
            countCls="bg-blue-100 text-blue-600"
          />
        </nav>

        {/* Projects */}
        <div className="px-2 pt-4 pb-2">
          <p className="text-[9px] font-black uppercase tracking-widest text-neutral-400 px-2 mb-1">Listas</p>
          {projects.length === 0 && (
            <p className="text-[11px] text-neutral-400 px-2 py-2 italic">Nenhum projeto</p>
          )}
          {projects.map((proj, i) => (
            <SidebarItem
              key={proj.id}
              icon={<Folder size={15} className={PALETTE[i % PALETTE.length]} />}
              label={proj.name}
              count={projCount[proj.id] || 0}
              active={view === proj.id}
              onClick={() => setView(proj.id)}
            />
          ))}
        </div>
      </aside>

      {/* ─── Main content ─── */}
      <main className="flex-1 flex flex-col overflow-hidden bg-[#F6F7FB]">
        {/* Header */}
        <div className="px-8 pt-6 pb-4 bg-[#F6F7FB]">
          <h2 className="text-lg font-black text-neutral-800">{viewLabel}</h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            {visible.filter(t => t.status !== 'done').length} tarefa(s) pendente(s)
          </p>
        </div>

        {/* Quick add input */}
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

        {/* Task list — scrollable */}
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
                {/* Section header */}
                <div className={`flex items-center gap-2 mb-2 pb-1.5 border-b ${meta.headerCls}`}>
                  <span className={`text-[10px] font-black uppercase tracking-wider ${meta.headerCls.split(' ')[0]}`}>
                    {meta.label}
                  </span>
                  <span className={`text-[10px] font-bold ${meta.headerCls.split(' ')[0]}`}>
                    {sectionTasks.length}
                  </span>
                </div>

                {/* Task rows */}
                <div className="space-y-1">
                  {sectionTasks.map(task => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      isDone={isDoneSection || justDone.has(task.id)}
                      isJustDone={justDone.has(task.id)}
                      projectName={task.projectId ? projName[task.projectId] : undefined}
                      projectColor={task.projectId ? projColor[task.projectId] : undefined}
                      onCheck={() => handleCheck(task)}
                      onDelete={() => handleDelete(task.id)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
};

// ─────────── TaskRow ───────────

interface TaskRowProps {
  task: Task;
  isDone: boolean;
  isJustDone: boolean;
  projectName?: string;
  projectColor?: string;
  onCheck: () => void;
  onDelete: () => void;
}

const TaskRow: React.FC<TaskRowProps> = ({ task, isDone, isJustDone, projectName, projectColor, onCheck, onDelete }) => {
  const [hovered, setHovered] = useState(false);
  const pm = P[task.priority];
  const overdue = isOverdue(task.dueDate, task.status);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`group flex items-center gap-3 bg-white rounded-xl px-4 py-2.5 border border-transparent hover:border-neutral-200 hover:shadow-sm transition-all ${isJustDone ? 'opacity-50 scale-[0.99]' : ''}`}
    >
      {/* Checkbox */}
      <button
        onClick={onCheck}
        className={`flex-shrink-0 transition-colors ${isDone ? 'text-green-500' : 'text-neutral-300 hover:text-primary'}`}
      >
        {isDone
          ? <CheckCircle2 size={18} />
          : <Circle size={18} />
        }
      </button>

      {/* Title */}
      <span className={`flex-1 text-sm min-w-0 truncate transition-all ${isDone ? 'line-through text-neutral-400' : 'text-neutral-800 font-medium'}`}>
        {task.title}
      </span>

      {/* Right meta */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Project tag */}
        {projectName && (
          <span className={`hidden sm:inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-neutral-50 ${projectColor || 'text-neutral-500'}`}>
            <Folder size={9} /> {projectName}
          </span>
        )}

        {/* Due date */}
        {task.dueDate && (
          <span className={`flex items-center gap-1 text-[10px] font-medium ${overdue ? 'text-red-500' : 'text-neutral-400'}`}>
            {overdue && <AlertTriangle size={10} />}
            <Calendar size={10} />
            {fmtDate(task.dueDate)}
          </span>
        )}

        {/* Priority dot */}
        <span className={`flex items-center gap-1 text-[10px] font-bold ${pm.text}`}>
          <span className={`w-2 h-2 rounded-full ${pm.dot}`} />
          {pm.label}
        </span>

        {/* Delete (hover only) */}
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

// ─────────── SidebarItem ───────────

interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  countCls?: string;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ icon, label, count, active, onClick, countCls = 'bg-neutral-100 text-neutral-500' }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all text-left ${active ? 'bg-blue-50 text-primary font-semibold' : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'}`}
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
