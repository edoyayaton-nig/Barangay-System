/**
 * Clinic Schedule Date & Day-of-Week Utilities
 * Ensures appointment dates strictly align with clinic operating schedules
 * (e.g., Every Monday -> only Mondays, Every Wednesday -> only Wednesdays, Tuesday & Friday -> only Tuesdays and Fridays).
 */

const DAY_MAP: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  thur: 4,
  thurs: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Parses a freeform clinic schedule day string into an array of valid day numbers (0=Sun, 1=Mon, ..., 6=Sat).
 * Examples:
 *  - "Every Monday" -> [1]
 *  - "Every Wednesday" -> [3]
 *  - "Every Monday & Thursday" -> [1, 4]
 *  - "Tuesday & Friday" -> [2, 5]
 *  - "Monday to Friday" -> [1, 2, 3, 4, 5]
 */
export function parseOperatingDays(dayOfWeekStr?: string): number[] {
  if (!dayOfWeekStr) return [1, 2, 3, 4, 5]; // Default weekdays
  const str = dayOfWeekStr.toLowerCase().trim();

  // Check range like "Monday to Friday" or "Mon - Fri"
  if (str.includes('to') || str.includes('-')) {
    const parts = str.split(/\s+(?:to|-)\s+/);
    if (parts.length === 2) {
      let startDay = -1;
      let endDay = -1;
      for (const [name, val] of Object.entries(DAY_MAP)) {
        if (parts[0].includes(name) && startDay === -1) startDay = val;
        if (parts[1].includes(name) && endDay === -1) endDay = val;
      }
      if (startDay !== -1 && endDay !== -1) {
        const days: number[] = [];
        if (startDay <= endDay) {
          for (let d = startDay; d <= endDay; d++) days.push(d);
        } else {
          for (let d = startDay; d <= 6; d++) days.push(d);
          for (let d = 0; d <= endDay; d++) days.push(d);
        }
        if (days.length > 0) return days;
      }
    }
  }

  // Find all explicitly mentioned day names
  const matchedDays = new Set<number>();
  const tokens = str.replace(/[^a-z]/g, ' ').split(/\s+/);
  for (const token of tokens) {
    if (DAY_MAP[token] !== undefined) {
      matchedDays.add(DAY_MAP[token]);
    }
  }

  if (matchedDays.size > 0) {
    return Array.from(matchedDays).sort((a, b) => a - b);
  }

  // Fallback: Weekdays
  return [1, 2, 3, 4, 5];
}

export interface OperatingDateOption {
  dateStr: string; // YYYY-MM-DD
  label: string;   // e.g. "Monday, Sep 14, 2026"
  dayName: string; // e.g. "Monday"
  formatted: string; // e.g. "Sep 14 (Mon)"
}

/**
 * Generates the next N valid calendar dates strictly matching the schedule's operating days.
 */
export function getUpcomingOperatingDates(dayOfWeekStr?: string, count = 8, startFrom?: Date): OperatingDateOption[] {
  const allowedDays = parseOperatingDays(dayOfWeekStr);
  const results: OperatingDateOption[] = [];
  
  const current = startFrom ? new Date(startFrom) : new Date();
  // Start from tomorrow
  current.setDate(current.getDate() + 1);

  let iterations = 0;
  while (results.length < count && iterations < 60) {
    iterations++;
    const dayOfWeek = current.getDay();
    if (allowedDays.includes(dayOfWeek)) {
      const yr = current.getFullYear();
      const mo = String(current.getMonth() + 1).padStart(2, '0');
      const da = String(current.getDate()).padStart(2, '0');
      const dateStr = `${yr}-${mo}-${da}`;

      const dayName = DAY_NAMES[dayOfWeek];
      const monthName = MONTH_NAMES[current.getMonth()].slice(0, 3);
      const label = `${dayName}, ${monthName} ${current.getDate()}, ${yr}`;
      const formatted = `${monthName} ${current.getDate()} (${dayName.slice(0, 3)})`;

      results.push({ dateStr, label, dayName, formatted });
    }
    current.setDate(current.getDate() + 1);
  }

  return results;
}

/**
 * Checks if a specific date string (YYYY-MM-DD) is an operating day for the schedule.
 */
export function isDateMatchingSchedule(dateStr: string, dayOfWeekStr?: string): boolean {
  if (!dateStr) return false;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return false;
  const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  if (isNaN(d.getTime())) return false;
  
  const allowedDays = parseOperatingDays(dayOfWeekStr);
  return allowedDays.includes(d.getDay());
}

/**
 * Given a picked date, if it doesn't match the schedule, snaps to the next available valid operating date.
 */
export function getNearestOperatingDate(dateStr: string, dayOfWeekStr?: string): string {
  if (!dateStr) {
    const upcoming = getUpcomingOperatingDates(dayOfWeekStr, 1);
    return upcoming[0]?.dateStr || '';
  }
  if (isDateMatchingSchedule(dateStr, dayOfWeekStr)) {
    return dateStr;
  }
  const parts = dateStr.split('-');
  const picked = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  const upcoming = getUpcomingOperatingDates(dayOfWeekStr, 1, picked);
  return upcoming[0]?.dateStr || dateStr;
}

/**
 * Formats a clean summary label for operating days
 * e.g. [1] -> "Every Monday", [1, 4] -> "Every Monday & Thursday", [3] -> "Every Wednesday"
 */
export function formatOperatingDaysSummary(dayOfWeekStr?: string): string {
  const days = parseOperatingDays(dayOfWeekStr);
  if (days.length === 5 && days.every((d, i) => d === i + 1)) return 'Monday to Friday';
  if (days.length === 7) return 'Every Day (Mon – Sun)';
  return days.map(d => DAY_NAMES[d]).join(', ');
}
