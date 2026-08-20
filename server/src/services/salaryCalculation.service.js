/** Standard divisor for daily rate (always 30, regardless of calendar month length). */
export const SALARY_DAYS_PER_MONTH = 30;

/** Days in calendar month (month is 1–12). */
export function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function parseEffectiveFrom(effectiveFrom) {
  if (!effectiveFrom) return null;

  if (effectiveFrom instanceof Date && !Number.isNaN(effectiveFrom.getTime())) {
    return {
      year: effectiveFrom.getUTCFullYear(),
      month: effectiveFrom.getUTCMonth() + 1,
      day: effectiveFrom.getUTCDate(),
    };
  }

  const isoPrefix = String(effectiveFrom).slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoPrefix)) {
    const [y, m, d] = isoPrefix.split('-').map(Number);
    return { year: y, month: m, day: d };
  }

  const parsed = new Date(effectiveFrom);
  if (!Number.isNaN(parsed.getTime())) {
    return {
      year: parsed.getUTCFullYear(),
      month: parsed.getUTCMonth() + 1,
      day: parsed.getUTCDate(),
    };
  }

  return null;
}

function monthKey(year, month) {
  return year * 100 + month;
}

/**
 * Payable working days in a calendar month.
 * - Full month (started on or before this month): all calendar days in the month
 * - Partial month (start date falls in this month): from start day through month end
 * - Not started yet: 0 days
 */
export function getPayableDaysInMonth({ effectiveFrom, year, month }) {
  const calendarDays = daysInMonth(year, month);
  const start = parseEffectiveFrom(effectiveFrom);
  const targetKey = monthKey(year, month);

  if (!start) {
    return {
      calendarDays,
      payableDays: calendarDays,
      startDay: 1,
      isPartialMonth: false,
      notStarted: false,
    };
  }

  const startKey = monthKey(start.year, start.month);

  if (startKey > targetKey) {
    return {
      calendarDays,
      payableDays: 0,
      startDay: null,
      isPartialMonth: false,
      notStarted: true,
    };
  }

  if (startKey < targetKey) {
    return {
      calendarDays,
      payableDays: calendarDays,
      startDay: 1,
      isPartialMonth: false,
      notStarted: false,
    };
  }

  const payableDays = Math.max(0, calendarDays - start.day + 1);
  return {
    calendarDays,
    payableDays,
    startDay: start.day,
    isPartialMonth: payableDays < calendarDays,
    notStarted: false,
  };
}

function leaveDatesInMonth({ leaveDates, year, month, startDay }) {
  const unique = [
    ...new Set(
      (leaveDates || [])
        .map((d) => String(d).slice(0, 10))
        .filter((d) => {
          const parts = d.split('-').map(Number);
          if (parts[0] !== year || parts[1] !== month) return false;
          if (startDay != null && parts[2] < startDay) return false;
          return true;
        })
    ),
  ];
  return unique.sort();
}

/**
 * Monthly payout after start-date proration and leave deductions.
 *
 * - dailyRate = monthlySalary / 30 (always 30-day basis)
 * - Full month: baseSalary = monthlySalary
 * - Partial month (mid-month start): baseSalary = dailyRate × payableDays in that month
 * - deductibleDays = max(0, leaveDays - allowedLeaves)
 * - expected = baseSalary - (deductibleDays × dailyRate)
 */
export function calculateMonthlyPayout({
  monthlySalary,
  allowedLeaves = 0,
  leaveDates = [],
  effectiveFrom = null,
  year,
  month,
}) {
  const salary = Number(monthlySalary) || 0;
  const dailyRate = salary / SALARY_DAYS_PER_MONTH;

  const period = getPayableDaysInMonth({ effectiveFrom, year, month });
  const { calendarDays, payableDays, startDay, isPartialMonth, notStarted } = period;

  const datesInMonth = leaveDatesInMonth({ leaveDates, year, month, startDay: startDay ?? undefined });
  const leaveDays = notStarted ? 0 : datesInMonth.length;
  const allowed = Math.max(0, Number(allowedLeaves) || 0);
  const deductibleDays = notStarted ? 0 : Math.max(0, leaveDays - allowed);

  let baseSalary = 0;
  if (!notStarted && payableDays > 0) {
    if (isPartialMonth) {
      baseSalary = Math.round(dailyRate * payableDays);
    } else {
      baseSalary = salary;
    }
  }

  const deduction = Math.round(deductibleDays * dailyRate);
  const expected = Math.max(0, Math.round(baseSalary - deduction));

  return {
    calendarDays,
    payableDays,
    salaryDaysBasis: SALARY_DAYS_PER_MONTH,
    dailyRate,
    isPartialMonth,
    notStarted,
    baseSalary,
    leaveDays,
    leaveDates: datesInMonth,
    allowedLeaves: allowed,
    deductibleDays,
    deduction,
    expected,
  };
}
