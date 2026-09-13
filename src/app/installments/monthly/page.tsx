"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getFixedMonthlyDates, getMonthRows, getMonthLabel, getScheduleDateError } from '@/components/installments/installment-utils';
import { BackButton, Button, Select } from '@/components/ui';

const today = new Date();
const defaultStartMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

export default function MonthlyInstallmentPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [monthCount, setMonthCount] = useState('6');
  const [startMonth, setStartMonth] = useState(defaultStartMonth);
  const [amount, setAmount] = useState('');
  const [calculatedAmount, setCalculatedAmount] = useState('');
  const [paymentAmounts, setPaymentAmounts] = useState<number[]>([]);
  const [sameDay, setSameDay] = useState(true);
  const [anchorDay, setAnchorDay] = useState(1);
  const [manualDates, setManualDates] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const monthCountValue = Number(monthCount);

  const autoDates = useMemo(() => {
    if (!sameDay) return [];
    return getFixedMonthlyDates(startMonth, monthCountValue, anchorDay);
  }, [sameDay, startMonth, monthCountValue, anchorDay]);

  useEffect(() => {
    if (!sameDay) {
      // Synchronize the editable date list with the selected month count.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setManualDates((current) =>
        Array.from({ length: monthCountValue }, (_, index) => current[index] ?? autoDates[index] ?? '')
      );
    }
  }, [sameDay, monthCountValue, autoDates]);

  const handleSameDayToggle = (checked: boolean) => {
    if (checked && !sameDay && manualDates.some(Boolean)) {
      const confirmed = window.confirm('Turning on same due day will overwrite manual dates. Continue?');
      if (!confirmed) return;
    }

    setSameDay(checked);
    if (!checked) {
      setManualDates(autoDates);
    }
  };

  const monthRows = useMemo(() => getMonthRows(startMonth, monthCountValue), [startMonth, monthCountValue]);

  const dates = sameDay ? autoDates : manualDates;

  const allSet = dates.length === monthCountValue && dates.every(Boolean);
  const dateError = allSet ? getScheduleDateError(dates) : null;
  const amountValue = Number(calculatedAmount || amount);
  const hasError = !title.trim() || amountValue <= 0 || !Number.isFinite(amountValue) || !Number.isInteger(monthCountValue) || monthCountValue < 1 || paymentAmounts.length !== monthCountValue || !allSet || Boolean(dateError);

  const handleCalculateAmount = () => {
    const totalAmount = Number(amount);
    if (totalAmount <= 0 || !Number.isFinite(totalAmount) || monthCountValue <= 0) {
      setCalculatedAmount('');
      setPaymentAmounts([]);
      return;
    }

    const totalCents = Math.round(totalAmount * 100);
    const baseCents = Math.floor(totalCents / monthCountValue);
    const remainderCents = totalCents % monthCountValue;
    const allocations = Array.from({ length: monthCountValue }, (_, index) => (
      (baseCents + (index < remainderCents ? 1 : 0)) / 100
    ));

    setPaymentAmounts(allocations);
    setCalculatedAmount((totalCents / monthCountValue / 100).toFixed(2));
  };

  const handleMonthCountChange = (value: string) => {
    setMonthCount(value);
    setCalculatedAmount('');
    setPaymentAmounts([]);
  };

  const handleManualChange = (index: number, value: string) => {
    setManualDates((current) => {
      const next = [...current];
      next[index] = value;
      return next;
    });
  };

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

    const itemRows = dates.map((date, index) => ({
      sequence_index: index + 1,
      label: getMonthLabel(date),
      due_date: date,
      amount: paymentAmounts[index] ?? amountValue,
      status: 'unpaid',
    }));

    const { data, error } = await supabase
      .from('installments')
      .insert([
        {
          title,
          type: 'monthly',
          start_date: `${startMonth}-01`,
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
      console.error('Failed to save monthly installment', { error, data });
      return;
    }

    const { error: itemError } = await supabase.from('installment_items').insert(
      itemRows.map((item) => ({ ...item, installment_id: installmentId }))
    );

    setIsSaving(false);

    if (itemError) {
      await supabase.from('installments').delete().eq('id', installmentId);
      setSaveError(itemError.message || 'Unable to save installment items.');
      console.error('Failed to save monthly installment items', itemError);
      return;
    }

    router.push('/');
  };

  return (
    <main className="min-h-screen bg-bg px-4 py-6 sm:py-10">
      <div className="mx-auto max-w-3xl rounded-3xl bg-surface p-5 shadow-lg sm:p-10">
        <BackButton href="/installments" label="Back to installment types" />
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-ink sm:text-3xl">Create monthly installment</h1>
          <p className="mt-2 text-sm text-ink-muted">Set a monthly schedule with optional fixed due-day clamping.</p>
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
                  pattern="[0-9]*([.][0-9]{1,2})?"
                  value={amount}
                  onChange={(event) => {
                    setAmount(event.target.value);
                    setCalculatedAmount('');
                  }}
                  required
                  className="min-w-0 flex-1 rounded-2xl border border-line bg-bg px-4 py-3 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft"
                  placeholder="0.00"
                />
                <Button type="button" variant="secondary" onClick={handleCalculateAmount} disabled={!amount || monthCountValue <= 0} className="shrink-0 px-3 text-xs sm:px-4">
                  Calculate
                </Button>
              </div>
              <span className="mt-2 block text-xs font-normal text-ink-muted">Divide the total across {monthCount} monthly payments.</span>
            </label>
          </div>
          {amount && (Number(amount) <= 0 || !Number.isFinite(Number(amount))) ? (
            <p className="text-sm text-danger">Amount must be a positive number.</p>
          ) : null}
          {calculatedAmount ? (
            <div className="rounded-2xl border border-accent bg-accent-soft px-4 py-3 text-sm text-ink">
              <span className="font-semibold">Calculated monthly amount:</span> ₱{Number(calculatedAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          ) : null}

          <div className="grid gap-6 sm:grid-cols-2">
            <label className="block text-sm font-medium text-ink-muted">
              Number of months
              <input
                type="number"
                min="1"
                max="120"
                value={monthCount}
                onChange={(event) => handleMonthCountChange(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-line bg-bg px-4 py-3 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft"
              />
            </label>
            <label className="block text-sm font-medium text-ink-muted">
              Start month
              <input
                type="month"
                value={startMonth}
                onChange={(event) => setStartMonth(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-line bg-bg px-4 py-3 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft"
              />
            </label>
          </div>

          <div className="rounded-3xl border border-line bg-bg p-6">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-3 text-sm font-semibold text-ink">
                <input
                  type="checkbox"
                  checked={sameDay}
                  onChange={(event) => handleSameDayToggle(event.target.checked)}
                  className="h-5 w-5 rounded border border-line text-accent focus:ring-accent"
                />
                Set the same due day every month
              </label>
            </div>

            {sameDay ? (
              <label className="block text-sm font-medium text-ink-muted">
                Due day
                <Select
                  value={String(anchorDay)}
                  onChange={(value) => setAnchorDay(Number(value))}
                  options={[
                    ...Array.from({ length: 31 }, (_, index) => ({ value: String(index + 1), label: String(index + 1) })),
                    { value: '32', label: 'Last day of month' },
                  ]}
                />
              </label>
            ) : null}

            <div className="grid gap-4">
              {monthRows.map((row, index) => (
                <div key={row.date} className="rounded-2xl border border-line bg-surface p-4">
                  <label className="block text-sm font-medium text-ink-muted">
                    {row.label}
                    <input
                      type="date"
                      value={sameDay ? autoDates[index] ?? '' : manualDates[index] ?? ''}
                      onChange={(event) => handleManualChange(index, event.target.value)}
                      disabled={sameDay}
                      className="mt-2 w-full rounded-2xl border border-line bg-bg px-4 py-3 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </label>
                  <p className="mt-3 flex items-center justify-between text-sm">
                    <span className="text-ink-muted">Payment amount</span>
                    <span className="font-semibold text-ink">₱{(paymentAmounts[index] ?? amountValue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>

            {dateError ? <p className="text-sm text-danger">{dateError}</p> : null}
              <p className="text-sm text-ink-muted">{allSet ? `${monthCount} months ready` : 'Complete all due dates to save.'}</p>
              {paymentAmounts.length === monthCountValue ? (
                <p className="mt-1 text-xs text-ink-muted">
                  Preview total: ₱{paymentAmounts.reduce((total, value) => total + value, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              ) : null}
            </div>
            <Button type="submit" disabled={hasError || isSaving} className="w-full sm:w-auto">
              {isSaving ? 'Saving…' : 'Save monthly installment'}
            </Button>
          </div>
          {saveError ? <p className="text-sm text-danger">{saveError}</p> : null}
        </form>
      </div>
    </main>
  );
}
