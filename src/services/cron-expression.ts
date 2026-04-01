/**
 * Cron expression utilities.
 *
 * Converts cron expressions to human-readable descriptions using cronstrue.
 */

import cronstrue from "cronstrue";

/**
 * Convert a cron expression to a human-readable string.
 *
 * @param expr - Standard cron expression (e.g., "0 8,12,17 * * *").
 * @returns Human-readable description (e.g., "At 8:00 AM, 12:00 PM, and 5:00 PM").
 */
export function cronToHuman(expr: string): string {
  try {
    return cronstrue.toString(expr, {
      use24HourTimeFormat: false,
      verbose: false,
    });
  } catch {
    return expr;
  }
}

/**
 * Format a cron schedule with timezone info.
 *
 * @param expr - Cron expression.
 * @param tz - Timezone string.
 * @returns Formatted schedule string.
 */
export function formatSchedule(expr: string, tz: string): string {
  const human = cronToHuman(expr);
  return `${human} (${tz})`;
}
