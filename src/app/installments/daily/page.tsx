"use client";

import { useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { allocateAmount, getDailyRange, toIsoDate } from '@/components/installments/installment-utils';
import { BackButton, Button } from '@/components/ui';

const today = toIsoDate(new Date());

export default function DailyInstallmentPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [amount, setAmount] = useState('');
  const [paymentAmounts, setPaymentAmounts] = useState<number[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const days = useMemo(() => {
    const range = getDailyRange(startDate, endDate);
    return range;
  }, [startDate, endDate]);

  const [checkedDays, setCheckedDays] = useState<Set<string>>(new Set());

  const groupedDays = useMemo(() => {
    return days.reduce<Record<string, string[]>>((acc, day) => {
      const month = format(parseISO(day), 'MMMM yyyy');
      acc[month] = [...(acc[month] ?? []), day];
      return acc;
    }, {});
  }, [days]);

  const selectedDays = useMemo(() => days.filter((day) => checkedDays.has(day)), [days, checkedDays]);

  useEffect(() => {
    setCheckedDays(new Set(days));
  }, [days]);

  const invalidRange = startDate === '' || endDate === '' || new Date(endDate) <= new Date(startDate);
  const selectedCount = days.filter((day) => checkedDays.has(day)).length;
  const itemCount = selectedCount;
  const allSelected = days.length > 0 && selectedCount === days.length;
  const amountValue = Number(amount);
  const hasError = !title.trim() || amountValue <= 0 || !Number.isFinite(amountValue) || selectedCount === 0 || paymentAmounts.length !== selectedCount || invalidRange;
  const rangeError = invalidRange ? 'End date must be later than start date.' : null;

  const toggleDay = (day: string) => {
    setPaymentAmounts([]);
    setCheckedDays((current) => {
      const next = new Set(current);
      if (next.has(day)) {
        next.delete(day);
      } else {
        next.add(day);
      }
      return next;
    });
  };

  const handleCalculateAmount = () => setPaymentAmounts(allocateAmount(amountValue, selectedCount));

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

    const selectedDays = days.filter((day) => checkedDays.has(day));
    const itemRows = selectedDays.map((day, index) => ({
      sequence_index: index + 1,
      label: `Day ${index + 1}`,
      due_date: day,
      amount: paymentAmounts[index] ?? amountValue,
      status: 'unpaid',
    }));

    const { data, error } = await supabase
      .from('installments')
      .insert([
        {
          title,
          type: 'daily',
          start_date: startDate,
          end_date: endDate,
          total_count: itemRows.length,
          default_amount: paymentAmounts[0] ?? amountValue,
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
      console.error('Failed to save daily installment', { error, data });
      return;
    }

    const { error: itemError } = await supabase.from('installment_items').insert(
      itemRows.map((item) => ({ ...item, installment_id: installmentId }))
    );

    setIsSaving(false);

    if (itemError) {
      await supabase.from('installments').delete().eq('id', installmentId);
      setSaveError(itemError.message || 'Unable to save installment items.');
      console.error('Failed to save daily installment items', itemError);
      return;
    }

    router.push('/');
  };

  return (
    <main className="min-h-screen bg-bg px-4 py-6 sm:py-10">
      <div className="mx-auto max-w-3xl rounded-3xl bg-surface p-5 shadow-lg sm:p-10">
        <BackButton href="/installments" label="Back to installment types" />
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-ink sm:text-3xl">Create daily installment</h1>
          <p className="mt-2 text-sm text-ink-muted">Pick a date range and skip any days you don't want included.</p>
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
              Total amount
              <div className="mt-2 flex gap-2">
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(event) => { setAmount(event.target.value); setPaymentAmounts([]); }}
                required
                className="min-w-0 flex-1 rounded-2xl border border-line bg-bg px-4 py-3 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft"
                placeholder="0.00"
              />
              <Button type="button" variant="secondary" onClick={handleCalculateAmount} disabled={!amount || selectedCount === 0} className="shrink-0 px-3 text-xs">Calculate</Button>
              </div>
              <span className="mt-2 block text-xs font-normal text-ink-muted">Divide the total across the selected days.</span>
            </label>
          </div>
          {amount && (Number(amount) <= 0 || !Number.isFinite(Number(amount))) ? (
            <p className="text-sm text-danger">Amount must be a positive number.</p>
          ) : null}

          <div className="grid gap-6 sm:grid-cols-2">
            <label className="block text-sm font-medium text-ink-muted">
              Start date
              <input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-line bg-bg px-4 py-3 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft"
              />
            </label>
            <label className="block text-sm font-medium text-ink-muted">
              End date
              <input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-line bg-bg px-4 py-3 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft"
              />
            </label>
          </div>

          <div className="rounded-3xl border border-line bg-bg p-6">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-ink">Days in range</h2>
                <p className="text-sm text-ink-muted">{days.length} day(s) found. {selectedCount} selected.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPaymentAmounts([]);
                  setCheckedDays(new Set(allSelected ? [] : days));
                }}
                className="rounded-2xl border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink transition hover:bg-accent-soft"
              >
                {allSelected ? 'Clear all' : 'Select all'}
              </button>
            </div>

            {days.length === 0 ? (
              <p className="rounded-3xl bg-danger-soft/20 px-4 py-3 text-sm text-danger">{rangeError}</p>
            ) : (
              <div className="space-y-6 max-h-72 overflow-y-auto">
                {Object.entries(groupedDays).map(([month, monthDays]) => (
                  <div key={month}>
                    <div className="mb-3 rounded-2xl bg-surface px-4 py-3 text-sm font-semibold text-ink">{month}</div>
                    <div className="space-y-2">
                      {monthDays.map((day) => {
                        const selectedIndex = selectedDays.findIndex((selectedDay) => selectedDay === day) + 1;
                        return (
                          <label
                            key={day}
                            className="flex cursor-pointer items-center justify-between rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-ink transition hover:bg-accent-soft"
                          >
                            <span>{checkedDays.has(day) ? `Day ${selectedIndex} — ${day}` : day}</span>
                            {checkedDays.has(day) && paymentAmounts[selectedIndex - 1] !== undefined ? <span className="font-semibold">₱{paymentAmounts[selectedIndex - 1].toFixed(2)}</span> : null}
                            <input
                              type="checkbox"
                              checked={checkedDays.has(day)}
                              onChange={() => toggleDay(day)}
                              className="h-5 w-5 rounded border border-line text-accent focus:ring-accent"
                            />
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {selectedCount === 0 && days.length > 0 ? (
              <p className="mt-4 text-sm text-danger">Select at least one day.</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-ink-muted">This will create {itemCount} item(s).</p>
            <Button type="submit" disabled={hasError || isSaving} className="w-full sm:w-auto">
              {isSaving ? 'Saving…' : 'Save daily installment'}
            </Button>
          </div>
          {saveError ? <p className="text-sm text-danger">{saveError}</p> : null}
        </form>
      </div>
    </main>
  );
}
