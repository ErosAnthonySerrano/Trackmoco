"use client";

import { addMonths, format, parseISO } from 'date-fns';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getWeekDate, toIsoDate } from '@/components/installments/installment-utils';
import { Button } from '@/components/ui';

const today = toIsoDate(new Date());

export default function WeeklyInstallmentPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [weekCount, setWeekCount] = useState(4);
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState<'auto' | 'manual'>('auto');
  const [baseDate, setBaseDate] = useState(today);
  const [dates, setDates] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (mode === 'auto') {
      setDates(Array.from({ length: weekCount }, (_, index) => getWeekDate(baseDate, index)));
    } else {
      setDates((current) => {
        const next = Array.from({ length: weekCount }, (_, index) => current[index] ?? '');
        return next;
      });
    }
  }, [mode, baseDate, weekCount]);

  const isManualReady = useMemo(() => dates[0] !== '', [dates]);

  const canEditWeek = (index: number) => {
    if (mode === 'auto') return true;
    if (index === 0) return true;
    return Boolean(dates[index - 1]);
  };

  const suggestedMonth = (index: number) => {
    if (index === 0 || !dates[index - 1]) return '';
    return format(addMonths(parseISO(dates[index - 1]), 1), 'MMMM yyyy');
  };

  const handleModeChange = (nextMode: 'auto' | 'manual') => {
    if (nextMode === mode) return;
    if (nextMode === 'auto' && mode === 'manual' && dates.some(Boolean)) {
      const confirmed = window.confirm('Switching back to Auto-fill will overwrite any manually entered week dates. Continue?');
      if (!confirmed) return;
    }
    setMode(nextMode);
  };

  const handleDateChange = (index: number, value: string) => {
    setDates((current) => {
      const next = [...current];
      next[index] = value;
      return next;
    });
  };

  const allDatesSet = dates.length === weekCount && dates.every(Boolean);
  const hasError = !title || !amount || !allDatesSet;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (hasError) return;
    setSaveError(null);
    setIsSaving(true);

    const supabase = createClient();
    const sessionResult = await supabase.auth.getSession();
    const userId = sessionResult.data.session?.user?.id;
    if (!userId) {
      router.replace('/login');
      return;
    }

    const amountValue = Number(amount);
    const itemRows = dates.map((date, index) => ({
      sequence_index: index + 1,
      label: `Week ${index + 1}`,
      due_date: date,
      amount: amountValue,
      status: 'unpaid',
    }));

    const { data, error } = await supabase
      .from('installments')
      .insert([
        {
          title,
          type: 'weekly',
          start_date: baseDate,
          total_count: itemRows.length,
          default_amount: amountValue,
          currency: 'PHP',
          created_by: userId,
        },
      ])
      .select('id')
      .single();

    const installmentId = data?.id;
    if (error || !installmentId) {
      setIsSaving(false);
      setSaveError(error?.message || JSON.stringify(error) || 'Unable to save installment.');
      console.error('Failed to save weekly installment', { error, data });
      return;
    }

    const { error: itemError } = await supabase.from('installment_items').insert(
      itemRows.map((item) => ({ ...item, installment_id: installmentId }))
    );

    setIsSaving(false);

    if (itemError) {
      await supabase.from('installments').delete().eq('id', installmentId);
      setSaveError(itemError.message || 'Unable to save installment items.');
      console.error('Failed to save weekly installment items', itemError);
      return;
    }

    router.push('/');
  };

  return (
    <main className="min-h-screen bg-bg px-4 py-10">
      <div className="mx-auto max-w-3xl rounded-3xl bg-surface p-10 shadow-lg">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-ink">Create weekly installment</h1>
          <p className="mt-2 text-sm text-ink-muted">Set a weekly payment schedule with auto-fill or manual sequential entry.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid gap-6 sm:grid-cols-2">
            <label className="block text-sm font-medium text-ink-muted">
              Title
              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required
                className="mt-2 w-full rounded-2xl border border-line bg-bg px-4 py-3 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft"
                placeholder="Installment title"
              />
            </label>
            <label className="block text-sm font-medium text-ink-muted">
              Amount
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                required
                className="mt-2 w-full rounded-2xl border border-line bg-bg px-4 py-3 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft"
                placeholder="0.00"
              />
            </label>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <label className="block text-sm font-medium text-ink-muted">
              Number of weeks
              <input
                type="number"
                min="1"
                max="104"
                value={weekCount}
                onChange={(event) => setWeekCount(Number(event.target.value))}
                className="mt-2 w-full rounded-2xl border border-line bg-bg px-4 py-3 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft"
              />
            </label>
            <label className="block text-sm font-medium text-ink-muted">
              Week 1 due date
              <input
                type="date"
                value={baseDate}
                onChange={(event) => setBaseDate(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-line bg-bg px-4 py-3 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft"
              />
            </label>
          </div>

          <div className="rounded-3xl border border-line bg-bg p-6">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-semibold text-ink">Mode</h2>
              <button
                type="button"
                onClick={() => handleModeChange('auto')}
                className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${mode === 'auto' ? 'bg-accent text-accent' : 'bg-surface text-ink border border-line'}`}
              >
                Auto-fill
              </button>
              <button
                type="button"
                onClick={() => handleModeChange('manual')}
                className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${mode === 'manual' ? 'bg-accent text-accent' : 'bg-surface text-ink border border-line'}`}
              >
                Manual
              </button>
            </div>

            <div className="grid gap-4">
              {Array.from({ length: weekCount }, (_, index) => {
                const disabled = mode === 'manual' && !canEditWeek(index);
                const defaultValue = mode === 'auto' ? getWeekDate(baseDate, index) : dates[index] ?? '';
                return (
                  <label key={index} className="block text-sm font-medium text-ink-muted">
                    {`Week ${index + 1}`}
                    <input
                      type="date"
                      value={defaultValue}
                      onChange={(event) => handleDateChange(index, event.target.value)}
                      disabled={disabled}
                      className="mt-2 w-full rounded-2xl border border-line bg-bg px-4 py-3 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    {mode === 'manual' && index > 0 && dates[index - 1] && !dates[index] ? (
                      <p className="mt-2 text-xs text-ink-muted">Suggested month: {suggestedMonth(index)}</p>
                    ) : null}
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-ink-muted">{allDatesSet ? `Weeks ready: ${weekCount}` : 'Complete all due dates to save.'}</p>
            <Button type="submit" disabled={hasError || isSaving} className="w-full sm:w-auto">
              {isSaving ? 'Saving…' : 'Save weekly installment'}
            </Button>
          </div>
          {saveError ? <p className="text-sm text-danger">{saveError}</p> : null}
        </form>
      </div>
    </main>
  );
}
