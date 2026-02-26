
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Target, Plus, Trash2, Flame, TrendingUp,
  CheckCircle2, Circle, ChevronLeft, ChevronRight
} from 'lucide-react';
import { Habit, HabitLog } from '../types.ts';
import { dataService } from '../services/dataService.ts';

interface HabitsProps {
  userId: string;
  onToast: (message: string, type: 'success' | 'error') => void;
}

// ─────────── date helpers (GMT-3 safe) ───────────

/** Returns today as YYYY-MM-DD in America/Sao_Paulo — avoids UTC day shift */
const todayGMT3 = (): string =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

const fmtDay = (d: string) => {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
};

// ─────────── calendar helpers ───────────

const MONTH_NAMES_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
const DOW_HEADERS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

function buildCalDays(year: number, month: number): (string | null)[] {
  const firstDow = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: (string | null)[] = Array(firstDow).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

// ─────────── day-status helpers ───────────

type DayStatus = 'all' | 'partial' | 'none';

function getDayStatus(day: string, habits: Habit[], logs: HabitLog[]): DayStatus {
  if (habits.length === 0) return 'none';
  const done = new Set(logs.filter(l => l.date === day && l.completed).map(l => l.habitId));
  const count = habits.filter(h => done.has(h.id)).length;
  if (count === habits.length) return 'all';
  if (count > 0) return 'partial';
  return 'none';
}

// ─────────── main component ───────────

export const Habits: React.FC<HabitsProps> = ({ userId, onToast }) => {
  const today = todayGMT3();
  const [tyear, tmonth] = today.split('-').map(Number);

  const [habits, setHabits]   = useState<Habit[]>([]);
  const [logs, setLogs]       = useState<HabitLog[]>([]);
  const [loading, setLoading] = useState(true);

  const [viewMonth, setViewMonth] = useState({ year: tyear, month: tmonth });
  const [selectedDate, setSelectedDate] = useState<string>(today);

  const [addText, setAddText]       = useState('');
  const [addFocused, setAddFocused] = useState(false);
  const [addSaving, setAddSaving]   = useState(false);
  const addRef = useRef<HTMLInputElement>(null);

  useEffect(() => { load(); }, [userId]);

  const load = async () => {
    try {
      setLoading(true);
      const [h, l] = await Promise.all([
        dataService.getHabits(userId),
        dataService.getHabitLogs(userId),
      ]);
      setHabits(h);
      setLogs(l);
    } catch (e: any) {
      onToast('Erro ao carregar hábitos: ' + (e.message || ''), 'error');
    } finally {
      setLoading(false);
    }
  };

  // Calendar grid for the viewed month
  const calDays = useMemo(() => buildCalDays(viewMonth.year, viewMonth.month), [viewMonth]);

  // Metrics (always based on today + current month)
  const metrics = useMemo(() => {
    const doneSet = new Set(logs.filter(l => l.date === today && l.completed).map(l => l.habitId));
    const doneToday = habits.filter(h => doneSet.has(h.id)).length;

    // Streak: consecutive days backwards from today where all habits are done
    let streak = 0;
    if (habits.length > 0) {
      const cursor = new Date(today + 'T12:00:00');
      for (let i = 0; i < 365; i++) {
        const ds = cursor.toISOString().split('T')[0];
        if (getDayStatus(ds, habits, logs) !== 'all') break;
        streak++;
        cursor.setDate(cursor.getDate() - 1);
      }
    }

    // Month rate: % of days (up to today) where all habits completed
    const todayDay = parseInt(today.split('-')[2]);
    let greenDays = 0;
    for (let d = 1; d <= todayDay; d++) {
      const ds = `${tyear}-${String(tmonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      if (getDayStatus(ds, habits, logs) === 'all') greenDays++;
    }
    const rate = todayDay > 0 && habits.length > 0
      ? Math.round((greenDays / todayDay) * 100) : 0;

    return { total: habits.length, doneToday, streak, rate };
  }, [habits, logs, today, tyear, tmonth]);

  // Checkbox state for selected date
  const selectedChecks = useMemo(() => {
    const m: Record<string, boolean> = {};
    habits.forEach(h => {
      const log = logs.find(l => l.habitId === h.id && l.date === selectedDate);
      m[h.id] = log?.completed ?? false;
    });
    return m;
  }, [habits, logs, selectedDate]);

  // ── handlers ──

  const handleAddHabit = async () => {
    const name = addText.trim();
    if (!name) return;
    setAddSaving(true);
    try {
      const newHabit: Habit = {
        id: crypto.randomUUID(),
        userId,
        createdAt: new Date().toISOString(),
        name,
        frequency: 'daily',
      };
      await dataService.saveHabit(newHabit, userId);
      setHabits(prev => [...prev, newHabit]);
      setAddText('');
      onToast('Hábito criado!', 'success');
    } catch (e: any) {
      onToast('Erro ao criar hábito: ' + (e.message || ''), 'error');
    } finally {
      setAddSaving(false);
    }
  };

  const handleDeleteHabit = async (habitId: string) => {
    if (!window.confirm('Excluir hábito? O histórico de registros será mantido.')) return;
    setHabits(prev => prev.filter(h => h.id !== habitId));
    try {
      await dataService.deleteHabit(habitId, userId);
    } catch {
      onToast('Erro ao excluir hábito.', 'error');
      load();
    }
  };

  const handleToggleLog = async (habit: Habit) => {
    const existing = logs.find(l => l.habitId === habit.id && l.date === selectedDate);
    const newCompleted = !(existing?.completed ?? false);
    const logId = existing?.id ?? crypto.randomUUID();
    const updated: HabitLog = {
      id: logId,
      userId,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      habitId: habit.id,
      date: selectedDate,
      completed: newCompleted,
    };

    // Optimistic
    setLogs(prev => existing
      ? prev.map(l => l.id === existing.id ? updated : l)
      : [...prev, updated]
    );

    try {
      await dataService.saveHabitLog(updated, userId);
    } catch {
      // Revert
      setLogs(prev => existing
        ? prev.map(l => l.id === logId ? existing : l)
        : prev.filter(l => l.id !== logId)
      );
      onToast('Erro ao salvar registro.', 'error');
    }
  };

  const prevMonth = () => setViewMonth(p =>
    p.month === 1 ? { year: p.year - 1, month: 12 } : { year: p.year, month: p.month - 1 }
  );
  const nextMonth = () => setViewMonth(p =>
    p.month === 12 ? { year: p.year + 1, month: 1 } : { year: p.year, month: p.month + 1 }
  );

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const isFuture = (day: string) => day > today;

  return (
    <div className="animate-fade-in pb-10">
      <div className="grid grid-cols-1 xl:grid-cols-[340px_1fr] gap-6 items-start">

        {/* ─── Left: metrics + calendar ─── */}
        <div className="space-y-4">

          {/* Metric cards 2×2 */}
          <div className="grid grid-cols-2 gap-3">
            <MetricCard
              label="Total de Hábitos"
              value={metrics.total}
              icon={<Target size={15} />}
              iconCls="text-primary bg-blue-50"
            />
            <MetricCard
              label="Sequência Atual"
              value={`${metrics.streak}d`}
              icon={<Flame size={15} />}
              iconCls="text-orange-500 bg-orange-50"
            />
            <MetricCard
              label="Concluídos Hoje"
              value={`${metrics.doneToday}/${metrics.total}`}
              icon={<CheckCircle2 size={15} />}
              iconCls="text-green-600 bg-green-50"
            />
            <MetricCard
              label="Taxa do Mês"
              value={`${metrics.rate}%`}
              icon={<TrendingUp size={15} />}
              iconCls="text-purple-600 bg-purple-50"
            />
          </div>

          {/* Calendar */}
          <div className="bg-white rounded-xl border border-neutral-200 shadow-sm p-4">
            {/* Month nav */}
            <div className="flex items-center justify-between mb-4">
              <button onClick={prevMonth} className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors">
                <ChevronLeft size={15} />
              </button>
              <span className="text-sm font-bold text-neutral-800">
                {MONTH_NAMES_PT[viewMonth.month - 1]} {viewMonth.year}
              </span>
              <button onClick={nextMonth} className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors">
                <ChevronRight size={15} />
              </button>
            </div>

            {/* DOW headers */}
            <div className="grid grid-cols-7 mb-1">
              {DOW_HEADERS.map((d, i) => (
                <div key={i} className="text-center text-[10px] font-black uppercase text-neutral-300 py-1">{d}</div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 gap-1">
              {calDays.map((day, i) => {
                if (!day) return <div key={i} className="aspect-square" />;

                const status = getDayStatus(day, habits, logs);
                const isToday   = day === today;
                const isSelected = day === selectedDate;
                const future    = isFuture(day);
                const dayNum    = parseInt(day.split('-')[2]);

                let bg = '';
                let textCls = '';
                if (status === 'all' && !future) {
                  bg = 'bg-green-500'; textCls = 'text-white font-bold';
                } else if (status === 'partial' && !future) {
                  bg = 'bg-yellow-400'; textCls = 'text-white font-bold';
                } else if (isToday) {
                  bg = 'bg-primary/10'; textCls = 'text-primary font-black';
                } else if (future) {
                  textCls = 'text-neutral-300';
                } else {
                  textCls = 'text-neutral-600 hover:bg-neutral-100';
                }

                return (
                  <button
                    key={day}
                    disabled={future}
                    onClick={() => setSelectedDate(day)}
                    title={day}
                    className={`relative flex items-center justify-center rounded-lg aspect-square text-xs transition-all
                      ${bg} ${textCls}
                      ${isSelected ? 'ring-2 ring-primary ring-offset-1' : ''}
                      ${future ? 'cursor-default' : 'cursor-pointer'}`}
                  >
                    {dayNum}
                    {isToday && status === 'none' && (
                      <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mt-4 pt-3 border-t border-neutral-100">
              {[
                { cls: 'bg-green-500',  label: 'Todos' },
                { cls: 'bg-yellow-400', label: 'Parcial' },
                { cls: 'bg-neutral-200', label: 'Nenhum' },
              ].map(l => (
                <div key={l.label} className="flex items-center gap-1.5 text-[10px] text-neutral-500">
                  <div className={`w-3 h-3 rounded ${l.cls}`} />{l.label}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ─── Right: habit list ─── */}
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-black text-neutral-800">Meus Hábitos</h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              {selectedDate === today
                ? 'Hoje'
                : fmtDay(selectedDate)
              }
              {' · '}{habits.length} hábito{habits.length !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Quick-add */}
          <div className={`flex items-center gap-3 bg-white rounded-xl px-4 py-3 border transition-all
            ${addFocused ? 'border-primary shadow-sm ring-2 ring-primary/10' : 'border-neutral-200'}`}
          >
            <Plus size={16} className={addFocused ? 'text-primary' : 'text-neutral-300'} />
            <input
              ref={addRef}
              value={addText}
              onChange={e => setAddText(e.target.value)}
              onFocus={() => setAddFocused(true)}
              onBlur={() => setAddFocused(false)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleAddHabit();
                if (e.key === 'Escape') { setAddText(''); addRef.current?.blur(); }
              }}
              placeholder="Adicionar novo hábito..."
              className="flex-1 text-sm text-neutral-800 placeholder-neutral-400 bg-transparent outline-none"
              disabled={addSaving}
            />
            {addText && (
              <button
                onMouseDown={e => { e.preventDefault(); handleAddHabit(); }}
                className="text-[10px] font-bold uppercase text-primary bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded-lg transition-colors"
              >
                {addSaving ? '...' : 'Adicionar'}
              </button>
            )}
          </div>

          {/* List */}
          {habits.length === 0 ? (
            <div className="bg-white rounded-xl border border-neutral-100 p-12 flex flex-col items-center text-center">
              <Target size={36} className="text-neutral-200 mb-3" />
              <p className="text-sm font-semibold text-neutral-400">Nenhum hábito ainda</p>
              <p className="text-xs text-neutral-300 mt-1">Use o campo acima para começar</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-neutral-200 shadow-sm divide-y divide-neutral-50 overflow-hidden">
              {habits.map(habit => (
                <HabitRow
                  key={habit.id}
                  habit={habit}
                  done={selectedChecks[habit.id] ?? false}
                  onToggle={() => handleToggleLog(habit)}
                  onDelete={() => handleDeleteHabit(habit.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─────────── MetricCard ───────────

const MetricCard: React.FC<{
  label: string; value: string | number; icon: React.ReactNode; iconCls: string;
}> = ({ label, value, icon, iconCls }) => (
  <div className="bg-white rounded-xl border border-neutral-100 shadow-sm p-4">
    <div className={`inline-flex p-1.5 rounded-lg mb-2 ${iconCls}`}>{icon}</div>
    <p className="text-[10px] font-bold uppercase text-neutral-400 leading-tight mb-0.5">{label}</p>
    <p className="text-xl font-black text-neutral-900">{value}</p>
  </div>
);

// ─────────── HabitRow ───────────

const HabitRow: React.FC<{
  habit: Habit; done: boolean; onToggle: () => void; onDelete: () => void;
}> = ({ habit, done, onToggle, onDelete }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex items-center gap-3 px-4 py-3.5 hover:bg-neutral-50/80 transition-colors"
    >
      <button
        onClick={onToggle}
        className={`flex-shrink-0 transition-colors ${done ? 'text-green-500' : 'text-neutral-300 hover:text-primary'}`}
      >
        {done ? <CheckCircle2 size={20} /> : <Circle size={20} />}
      </button>
      <span className={`flex-1 text-sm transition-all ${done ? 'line-through text-neutral-400' : 'text-neutral-800 font-medium'}`}>
        {habit.name}
      </span>
      <button
        onClick={onDelete}
        className={`flex-shrink-0 transition-opacity text-neutral-300 hover:text-red-400 ${hovered ? 'opacity-100' : 'opacity-0'}`}
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
};
