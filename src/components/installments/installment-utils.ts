import { addDays, addMonths, addYears, eachDayOfInterval, format, parseISO } from 'date-fns';
import { addIntervalClamped } from '@/lib/utils/dateInterval';

export function toIsoDate(date: Date) {
  return format(date, 'yyyy-MM-dd');
}

export function parseIsoDate(value: string) {
  return parseISO(value);
}

export function isValidDateString(value: string) {
  return value.length === 10 && !Number.isNaN(Date.parse(value));
}

export function getDailyRange(startDate: string, endDate: string) {
  if (!isValidDateString(startDate) || !isValidDateString(endDate)) {
    return [];
  }

  const start = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);

  if (end < start) {
    return [];
  }

  return eachDayOfInterval({ start, end }).map((date) => toIsoDate(date));
}

export function getWeekDate(start: string, index: number) {
  const base = parseIsoDate(start);
  return toIsoDate(addDays(base, index * 7));
}

export function getMonthLabel(dateString: string) {
  return format(parseIsoDate(dateString), 'MMMM yyyy');
}

export function getYearLabel(dateString: string) {
  return format(parseIsoDate(dateString), 'yyyy');
}

export function getMonthRows(startMonth: string, count: number) {
  if (!startMonth || count < 1) return [];
  const [year, month] = startMonth.split('-').map(Number);
  if (Number.isNaN(year) || Number.isNaN(month)) return [];
  return Array.from({ length: count }, (_, index) => {
    const date = addMonths(new Date(year, month - 1, 1), index);
    return {
      date: toIsoDate(date),
      label: format(date, 'MMMM yyyy'),
    };
  });
}

export function getYearRows(startYear: number, count: number) {
  if (!startYear || count < 1) return [];
  return Array.from({ length: count }, (_, index) => {
    const date = addYears(new Date(startYear, 0, 1), index);
    return {
      date: toIsoDate(date),
      label: format(date, 'yyyy'),
    };
  });
}

export function getFixedMonthlyDates(startMonth: string, count: number, anchorDay: number) {
  if (!startMonth || count < 1) return [];
  const [year, month] = startMonth.split('-').map(Number);
  if (Number.isNaN(year) || Number.isNaN(month)) return [];
  const base = new Date(year, month - 1, 1);

  return Array.from({ length: count }, (_, index) => {
    const date = addIntervalClamped(base, 'month', index, anchorDay);
    return toIsoDate(date);
  });
}

export function getFixedYearlyDates(startYear: number, count: number, month: number, day: number) {
  if (!startYear || count < 1 || month < 1 || month > 12 || day < 1) return [];
  const base = new Date(startYear, month - 1, day);

  return Array.from({ length: count }, (_, index) => {
    const date = addIntervalClamped(base, 'year', index, day);
    return toIsoDate(date);
  });
}
