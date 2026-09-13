"use client";

import { useEffect, useState } from 'react';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { Button, Modal, Select, useToast } from '@/components/ui';

type ScheduleType = 'daily' | 'weekly' | 'monthly' | 'yearly';

type InstallmentEditValues = {
  title: string;
  amount: string;
  scheduleType: ScheduleType;
  startDate: string;
  endDate: string;
  scheduleCount: string;
  startMonth: string;
  dueDay: string;
  startYear: string;
  yearMonth: string;
};

type UnpaidItem = { id: string; sequenceIndex: number; dueDate: string };

interface InstallmentEditModalProps {
  open: boolean;
  installmentId: string;
  title: string;
  type: ScheduleType;
  startDate: string;
  unpaidItems: UnpaidItem[];
  totalAmount: string;
  unpaidCount: number;
  onClose: () => void;
  onSaved: (values: { title: string; type: ScheduleType; defaultAmount: string; items: Array<{ id: string; sequence_index: number; label: string; due_date: string; amount: string }> }) => void;
}

const scheduleOptions = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

function getAnchorDate(startDate: string, unpaidItems: UnpaidItem[]) {
  return unpaidItems[0]?.dueDate || startDate;
}

function getInitialSchedule(startDate: string, type: ScheduleType, unpaidItems: UnpaidItem[]) {
  const anchor = getAnchorDate(startDate, unpaidItems);
  const parsed = anchor ? parseISO(anchor) : new Date();
  return {
    scheduleType: type,
    startDate: anchor,
    endDate: unpaidItems.length > 0 ? unpaidItems[unpaidItems.length - 1].dueDate : anchor,
    scheduleCount: String(Math.max(unpaidItems.length, 1)),
    startMonth: anchor ? format(parsed, 'yyyy-MM') : '',
    dueDay: anchor ? String(parsed.getDate()) : '1',
    startYear: anchor ? format(parsed, 'yyyy') : String(new Date().getFullYear()),
    yearMonth: anchor ? String(parsed.getMonth() + 1) : '1',
  };
}

export function InstallmentEditModal({
  open,
  installmentId,
  title,
  type,
  startDate,
  unpaidItems,
  totalAmount,
  unpaidCount,
  onClose,
  onSaved,
}: InstallmentEditModalProps) {
  const { toast } = useToast();
  const [values, setValues] = useState<InstallmentEditValues>({
    title,
    amount: totalAmount,
    ...getInitialSchedule(startDate, type, unpaidItems),
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setValues({ title, amount: totalAmount, ...getInitialSchedule(startDate, type, unpaidItems) });
      setError(null);
    }
  }, [open, startDate, title, totalAmount, type, unpaidItems]);

  const updateValue = <Key extends keyof InstallmentEditValues>(key: Key, value: InstallmentEditValues[Key]) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const selectedCount = values.scheduleType === 'daily'
    ? values.startDate && values.endDate && values.endDate >= values.startDate
      ? differenceInCalendarDays(parseISO(values.endDate), parseISO(values.startDate)) + 1
      : 0
    : values.scheduleType === 'weekly'
      ? Number(values.scheduleCount) || 0
      : Number(values.scheduleCount) || 0;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const amount = Number(values.amount);
    if (!values.title.trim()) {
      setError('Enter an installment name.');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Amount must be a positive number.');
      return;
    }
    const dueDay = Number(values.dueDay);
    const startYear = Number(values.startYear);
    const yearMonth = Number(values.yearMonth);
    const scheduleCount = Number(values.scheduleCount);
    if (values.scheduleType === 'monthly' && (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 32)) {
      setError('Choose a due day from 1 to 31, or last day of month.');
      return;
    }
    if (values.scheduleType === 'yearly' && (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31 || !Number.isInteger(startYear) || yearMonth < 1 || yearMonth > 12)) {
      setError('Choose a valid yearly month and due day.');
      return;
    }
    if (values.scheduleType === 'daily' && (!values.startDate || !values.endDate || values.endDate < values.startDate)) {
      setError('Choose an end date on or after the starting date.');
      return;
    }
    if (values.scheduleType !== 'daily' && (!Number.isInteger(scheduleCount) || scheduleCount < 1 || scheduleCount > 500)) {
      setError('Number of payments must be between 1 and 500.');
      return;
    }

    setIsSaving(true);
    const response = await fetch('/api/installments/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        installment_id: installmentId,
        title: values.title.trim(),
        total_amount: amount,
        schedule_type: values.scheduleType,
        schedule_start: values.scheduleType === 'monthly'
          ? `${values.startMonth}-01`
          : values.scheduleType === 'yearly'
            ? `${values.startYear}-${String(yearMonth).padStart(2, '0')}-${String(dueDay).padStart(2, '0')}`
            : values.startDate,
          schedule_end: values.scheduleType === 'daily' ? values.endDate : null,
          schedule_count: values.scheduleType === 'daily' ? null : scheduleCount,
        due_day: dueDay,
      }),
    });
    const result = await response.json() as {
      error?: string;
      installment?: { title: string; type: ScheduleType; default_amount: string | number };
      items?: Array<{ id: string; sequence_index: number; label: string; due_date: string; amount: string | number }>;
    };
    setIsSaving(false);

    if (!response.ok || !result.installment || !result.items) {
      setError(result.error || 'Unable to update installment.');
      return;
    }

    onSaved({
      title: result.installment.title,
      type: result.installment.type,
      defaultAmount: String(result.installment.default_amount),
      items: result.items.map((item) => ({ id: item.id, sequence_index: item.sequence_index, label: item.label, due_date: item.due_date, amount: String(item.amount) })),
    });
    onClose();
    toast({ title: 'Installment updated', description: unpaidCount > 0 ? 'Unpaid payments were updated.' : 'Installment details were updated.', variant: 'success' });
  };

  return (
    <Modal
      open={open}
      title="Edit installment"
      description="Update the name and payment amount. Date changes apply only to unpaid payments."
      onClose={() => { if (!isSaving) onClose(); }}
      footer={
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" disabled={isSaving} onClick={onClose}>Cancel</Button>
          <Button type="submit" form="installment-edit-form" isLoading={isSaving}>Save changes</Button>
        </div>
      }
    >
      <form id="installment-edit-form" onSubmit={handleSubmit} className="space-y-5">
        <label className="block text-sm font-medium text-ink-muted">
          Installment name
          <input
            type="text"
            value={values.title}
            onChange={(event) => updateValue('title', event.target.value)}
            className="mt-2 w-full rounded-2xl border border-line bg-bg px-4 py-3 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
            required
          />
        </label>

        <label className="block text-sm font-medium text-ink-muted">
          Total amount for unpaid payments
          <input
            type="number"
            min="0.01"
            step="0.01"
            inputMode="decimal"
            value={values.amount}
            onChange={(event) => updateValue('amount', event.target.value)}
            className="mt-2 w-full rounded-2xl border border-line bg-bg px-4 py-3 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
            required
          />
          <span className="mt-2 block text-xs font-normal text-ink-muted">This total is divided across the selected unpaid schedule. Paid payment amounts remain unchanged.</span>
        </label>

        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-ink-muted">Payment schedule</p>
            <Select
              value={values.scheduleType}
              onChange={(value) => updateValue('scheduleType', value as ScheduleType)}
              options={scheduleOptions}
              className="mt-2 w-full"
            />
          </div>

          {values.scheduleType === 'daily' || values.scheduleType === 'weekly' ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-ink-muted">
                Starting date
                <input
                  type="date"
                  value={values.startDate}
                  onChange={(event) => updateValue('startDate', event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-line bg-bg px-4 py-3 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
                  required
                />
              </label>
              {values.scheduleType === 'daily' ? (
                <label className="block text-sm font-medium text-ink-muted">
                  Ending date
                  <input
                    type="date"
                    value={values.endDate}
                    onChange={(event) => updateValue('endDate', event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-line bg-bg px-4 py-3 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
                    required
                  />
                </label>
              ) : null}
            </div>
          ) : null}

          {values.scheduleType === 'weekly' ? (
            <label className="block text-sm font-medium text-ink-muted">
              Number of weeks
              <input
                type="number"
                min="1"
                max="500"
                value={values.scheduleCount}
                onChange={(event) => updateValue('scheduleCount', event.target.value)}
                className="mt-2 w-full rounded-2xl border border-line bg-bg px-4 py-3 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
                required
              />
            </label>
          ) : null}

          {values.scheduleType === 'monthly' ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-ink-muted">
                  Number of months
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={values.scheduleCount}
                    onChange={(event) => updateValue('scheduleCount', event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-line bg-bg px-4 py-3 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
                    required
                  />
                </label>
                <label className="block text-sm font-medium text-ink-muted">
                  Start month
                  <input
                    type="month"
                    value={values.startMonth}
                    onChange={(event) => updateValue('startMonth', event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-line bg-bg px-4 py-3 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
                    required
                  />
                </label>
              </div>
              <label className="block text-sm font-medium text-ink-muted">
                Due day
                <Select
                  value={values.dueDay}
                  onChange={(value) => updateValue('dueDay', value)}
                  options={[
                    ...Array.from({ length: 31 }, (_, index) => ({ value: String(index + 1), label: String(index + 1) })),
                    { value: '32', label: 'Last day of month' },
                  ]}
                  className="mt-2 w-full"
                />
              </label>
            </div>
          ) : null}

          {values.scheduleType === 'yearly' ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-ink-muted">
                  Number of years
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={values.scheduleCount}
                    onChange={(event) => updateValue('scheduleCount', event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-line bg-bg px-4 py-3 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
                    required
                  />
                </label>
                <label className="block text-sm font-medium text-ink-muted">
                  Start year
                  <input
                    type="number"
                    min="1900"
                    max="2200"
                    value={values.startYear}
                    onChange={(event) => updateValue('startYear', event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-line bg-bg px-4 py-3 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
                    required
                  />
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-ink-muted">
                  Month
                  <Select
                    value={values.yearMonth}
                    onChange={(value) => updateValue('yearMonth', value)}
                    options={Array.from({ length: 12 }, (_, index) => ({ value: String(index + 1), label: format(new Date(2020, index, 1), 'MMMM') }))}
                    className="mt-2 w-full"
                  />
                </label>
                <label className="block text-sm font-medium text-ink-muted">
                  Due day
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={values.dueDay}
                    onChange={(event) => updateValue('dueDay', event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-line bg-bg px-4 py-3 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
                    required
                  />
                </label>
              </div>
            </div>
          ) : null}

          <p className="text-xs text-ink-muted">
            This will configure {selectedCount} unpaid payment{selectedCount === 1 ? '' : 's'} at approximately PHP {selectedCount > 0 ? (Number(values.amount) / selectedCount).toFixed(2) : '0.00'} each. Paid payments will keep their dates and history.
          </p>
        </div>

        {error ? <p className="text-sm text-danger">{error}</p> : null}
      </form>
    </Modal>
  );
}
