/**
 * Utilities for formatting, parsing, and generating week ranges in "X - Y Month" format,
 * as well as automatically moving to next weeks based on designated session days.
 */

const monthsLower = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december'
];

const monthsEnglish = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Monday-based start of the week for a given Date
 */
export function getCurrWeekMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  // Adjust so Sunday (0) gets -6 days and Monday (1) gets 0 days
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(date.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/**
 * Standard formatting of Monday to Sunday week range
 */
export function getWeekRangeLabel(mondayDate: Date): string {
  const sunday = new Date(mondayDate);
  sunday.setDate(mondayDate.getDate() + 6);

  const startDay = mondayDate.getDate();
  const endDay = sunday.getDate();

  const startMonth = monthsEnglish[mondayDate.getMonth()];
  const endMonth = monthsEnglish[sunday.getMonth()];

  if (startMonth === endMonth) {
    return `${startDay}-${endDay} ${startMonth}`;
  } else {
    return `${startDay} ${startMonth} - ${endDay} ${endMonth}`;
  }
}

/**
 * Generate weekly options starting from June 1, 2026 onward.
 * It dynamically extends to at least 12 weeks from June 1, 2026, or +8 weeks from baseDate.
 */
export function generateWeekOptions(baseDate: Date = new Date()): string[] {
  const startMonday = new Date(2026, 5, 1); // June 1, 2026 (index 5 is June in JS)
  startMonday.setHours(0, 0, 0, 0);

  const baseMonday = getCurrWeekMonday(baseDate);
  const weeksList: string[] = [];

  // Determine end baseline (at least +8 weeks from baseDate, or minimum 12 weeks from startMonday)
  const endMonday = new Date(baseMonday);
  endMonday.setDate(endMonday.getDate() + (8 * 7));

  const minEndMonday = new Date(startMonday);
  minEndMonday.setDate(minEndMonday.getDate() + (12 * 7));

  const finalEndMonday = endMonday > minEndMonday ? endMonday : minEndMonday;

  // Generate starting from June 1, 2026
  const current = new Date(startMonday);
  while (current <= finalEndMonday) {
    weeksList.push(getWeekRangeLabel(current));
    current.setDate(current.getDate() + 7);
  }

  return weeksList;
}

/**
 * Parses "StartDay-EndDay Month" (e.g. "8-14 June") or "StartDay StartMonth - EndDay EndMonth" (e.g. "29 June - 5 July")
 * to obtain Monday and Sunday Date objects.
 */
export function parseWeekRangeToDates(range: string, year: number = 2026): { monday: Date; sunday: Date } | null {
  try {
    const rangeClean = range.trim();

    // Matching format "8-14 June" or "06-07 June"
    const matchSimple = rangeClean.match(/^(\d+)-(\d+)\s+([A-Za-z]+)$/i);
    if (matchSimple) {
      const endDay = parseInt(matchSimple[2], 10);
      const monthStr = matchSimple[3].toLowerCase();
      const monthIdx = monthsLower.indexOf(monthStr);
      if (monthIdx !== -1) {
        const sunday = new Date(year, monthIdx, endDay, 23, 59, 59, 999);
        const monday = new Date(sunday);
        monday.setDate(sunday.getDate() - 6);
        monday.setHours(0, 0, 0, 0);
        return { monday, sunday };
      }
    }

    // Matching cross-month format "29 June - 5 July"
    const matchCross = rangeClean.match(/^(\d+)\s+([A-Za-z]+)\s*-\s*(\d+)\s+([A-Za-z]+)$/i);
    if (matchCross) {
      const endDay = parseInt(matchCross[3], 10);
      const endMonthStr = matchCross[4].toLowerCase();
      const endMonthIdx = monthsLower.indexOf(endMonthStr);
      if (endMonthIdx !== -1) {
        const sunday = new Date(year, endMonthIdx, endDay, 23, 59, 59, 999);
        const monday = new Date(sunday);
        monday.setDate(sunday.getDate() - 6);
        monday.setHours(0, 0, 0, 0);
        return { monday, sunday };
      }
    }

    return null;
  } catch (err) {
    console.error('Error parsing week range label:', err);
    return null;
  }
}

/**
 * Gets the actual Date of a chosen weekday within a given week range
 * and configures its time based on a "HH:MM" string.
 */
export function getSpecificWeekdayDate(weekRange: string, dayName: string, timeStr: string = '19:30'): Date | null {
  const parsed = parseWeekRangeToDates(weekRange);
  if (!parsed) return null;

  const { monday } = parsed;

  const dayMapping: { [key: string]: number } = {
    'понеделник': 0, 'monday': 0,
    'вторник': 1, 'tuesday': 1,
    'сряда': 2, 'wednesday': 2,
    'четвъртък': 3, 'thursday': 3,
    'петък': 4, 'friday': 4,
    'събота': 5, 'saturday': 5,
    'неделя': 6, 'sunday': 6
  };

  const offset = dayMapping[dayName.toLowerCase()];
  if (offset === undefined) return null;

  const targetDate = new Date(monday);
  targetDate.setDate(monday.getDate() + offset);

  // Parse timeStr (default to 19:30 SOF time)
  const parts = (timeStr || '19:30').split(':');
  const hour = parseInt(parts[0], 10) || 19;
  const min = parseInt(parts[1], 10) || 30;
  targetDate.setHours(hour, min, 0, 0);

  return targetDate;
}

