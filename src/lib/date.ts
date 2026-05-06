// Utility functions to standardize all date handling to Indian Standard Time (IST)
// IST is UTC+5:30. Server clocks may run in UTC, browsers may run in any
// timezone, so we must NOT rely on the host timezone for "today" / day-of-week
// calculations. All public helpers in this file format/derive values via
// Asia/Kolkata.

const IST_TIMEZONE = 'Asia/Kolkata';

// Reuse formatters - constructing Intl.DateTimeFormat is comparatively expensive.
const istDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: IST_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const istDateParts = new Intl.DateTimeFormat('en-CA', {
  timeZone: IST_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

/**
 * Returns today's date string in IST in YYYY-MM-DD format.
 * Uses Intl in Asia/Kolkata, so the result is correct regardless of the host
 * timezone.
 */
export function getISTTodayDateString(): string {
  return istDateFormatter.format(new Date());
}

/**
 * Returns a Date object that, when formatted with Asia/Kolkata, would yield
 * "now". Use the result *only* for arithmetic (`setDate`, etc.) followed by
 * a re-format via `formatDateToIST`. Do NOT call `getFullYear`/`getMonth` on
 * the result and expect IST values - those getters return host-timezone
 * fields. Existing callers tolerate the offset because the same Date is
 * subsequently re-formatted in IST.
 */
export function getISTNow(): Date {
  return new Date();
}

/**
 * Returns a date range (start/end as YYYY-MM-DD strings) for "today" in IST.
 */
export function getISTTodayRange() {
  const today = getISTTodayDateString();
  return {
    start: today,
    end: today,
  };
}

/**
 * Returns a date range for the past N days (including today) in IST.
 */
export function getISTDateRangeFromDays(days: number) {
  const end = getISTTodayDateString();
  const start = shiftISTDate(end, -(days - 1));
  return { start, end };
}

/**
 * Shift an IST YYYY-MM-DD string by N calendar days (positive or negative).
 * Returns a YYYY-MM-DD string in IST. Implemented by anchoring the date at
 * IST noon (so DST/timezone math can never roll us into the previous/next
 * day in any zone) and then re-formatting in Asia/Kolkata.
 */
export function shiftISTDate(dateStr: string, deltaDays: number): string {
  const anchor = new Date(`${dateStr}T12:00:00+05:30`);
  anchor.setUTCDate(anchor.getUTCDate() + deltaDays);
  return istDateFormatter.format(anchor);
}

/**
 * Formats a Date object to YYYY-MM-DD string in IST.
 */
export function formatDateToIST(date: Date): string {
  return istDateFormatter.format(date);
}

/**
 * Formats a date string for display in Indian locale.
 */
export function formatDateForDisplay(dateStr: string, options?: Intl.DateTimeFormatOptions): string {
  const defaultOptions: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: IST_TIMEZONE,
  };
  return new Date(dateStr + 'T00:00:00+05:30').toLocaleDateString('en-IN', options || defaultOptions);
}

/**
 * Formats a date string to show short day (e.g., "Mon").
 */
export function getShortDayIST(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00+05:30').toLocaleDateString('en-IN', {
    weekday: 'short',
    timeZone: IST_TIMEZONE,
  });
}

/**
 * Formats a date string to show short date (e.g., "Dec 3").
 */
export function getShortDateIST(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00+05:30').toLocaleDateString('en-IN', {
    month: 'short',
    day: 'numeric',
    timeZone: IST_TIMEZONE,
  });
}

/**
 * Formats a date string to show full date (e.g., "Wednesday, December 3, 2025").
 */
export function getFullDateIST(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00+05:30').toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: IST_TIMEZONE,
  });
}

/**
 * Gets the day of month from an IST YYYY-MM-DD string. Since the input is
 * already an IST date string, parsing the leading 8 characters is exact and
 * avoids any timezone shift.
 */
export function getDayOfMonthIST(dateStr: string): number {
  const day = Number(dateStr.slice(8, 10));
  return Number.isNaN(day) ? 0 : day;
}

/**
 * Returns the current year in IST.
 */
export function getISTYear(): number {
  return Number(istDateFormatter.format(new Date()).slice(0, 4));
}

/**
 * Returns true if the given IST YYYY-MM-DD string falls on a Sunday in IST.
 * Uses Intl with the IST timezone so the answer doesn't depend on the host
 * timezone. (The previous implementation used `new Date(year, month-1, day)`
 * which evaluates in the host TZ - usually fine but can drift around DST in
 * non-IST hosts.)
 */
const istWeekdayFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: IST_TIMEZONE,
  weekday: 'short',
});
export function isISTSunday(dateStr: string): boolean {
  const anchor = new Date(`${dateStr}T12:00:00+05:30`);
  return istWeekdayFormatter.format(anchor) === 'Sun';
}

/**
 * Converts a UTC datetime string (from database) to IST date string (YYYY-MM-DD).
 * Handles formats like "YYYY-MM-DD HH:MM:SS" (PostgreSQL) or ISO strings.
 *
 * Uses Asia/Kolkata via Intl - the previous implementation added 5h30m of
 * milliseconds and then read host-TZ getters, which produced wrong results
 * for any browser/server not already in IST.
 */
export function convertUTCToISTDate(utcDatetime: string): string {
  let date: Date;

  if (utcDatetime.includes('T')) {
    const isoString = utcDatetime.endsWith('Z') ? utcDatetime : utcDatetime + 'Z';
    date = new Date(isoString);
  } else if (utcDatetime.includes(' ')) {
    date = new Date(utcDatetime.replace(' ', 'T') + 'Z');
  } else {
    return utcDatetime;
  }

  if (isNaN(date.getTime())) {
    const dateMatch = utcDatetime.match(/^(\d{4}-\d{2}-\d{2})/);
    if (dateMatch) {
      return dateMatch[1];
    }
    return getISTTodayDateString();
  }

  return istDateFormatter.format(date);
}

/**
 * Returns the current IST date/time formatted as YYYY-MM-DD HH:mm:ss.
 * Useful when callers need the wall-clock IST timestamp regardless of host TZ.
 */
export function getISTDateTimeString(): string {
  const parts = istDateParts.formatToParts(new Date());
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === type)?.value || '00';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`;
}
