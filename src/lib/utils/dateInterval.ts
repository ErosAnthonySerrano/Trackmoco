export type Unit = 'week' | 'month' | 'year';

export function addIntervalClamped(
  startDate: Date,
  unit: Unit,
  count: number,
  anchorDay?: number
): Date {
  if (!Number.isInteger(count) || count < 0) throw new Error('count must be a non-negative integer');

  const base = new Date(startDate.getTime());

  if (unit === 'week') {
    const result = new Date(base);
    result.setDate(result.getDate() + 7 * count);
    return result;
  }

  if (unit === 'month') {
    const year = base.getFullYear();
    const month = base.getMonth();
    const desiredDay = anchorDay ?? base.getDate();
    // create date anchored to first of target month, then clamp day
    const target = new Date(year, month + count, 1);
    const maxDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    const day = Math.min(desiredDay, maxDay);
    target.setDate(day);
    return target;
  }

  // year
  if (unit === 'year') {
    const year = base.getFullYear() + count;
    const month = base.getMonth();
    const desiredDay = anchorDay ?? base.getDate();
    const target = new Date(year, month, 1);
    const maxDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    const day = Math.min(desiredDay, maxDay);
    target.setDate(day);
    return target;
  }

  throw new Error('unsupported unit');
}

export default addIntervalClamped;
