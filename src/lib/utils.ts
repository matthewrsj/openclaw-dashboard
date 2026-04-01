/**
 * General utility functions.
 */

/** Combine class names, filtering out falsy values. */
export function cn(...classes: (string | false | null | undefined | Record<string, boolean>)[]): string {
  return classes
    .map(cls => {
      if (typeof cls === "string") return cls;
      if (typeof cls === "object" && cls) {
        return Object.entries(cls)
          .filter(([_, condition]) => condition)
          .map(([className]) => className)
          .join(" ");
      }
      return "";
    })
    .filter(Boolean)
    .join(" ");
}

/** Generate a unique ID. */
export function uniqueId(prefix = ""): string {
  return `${prefix}${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Debounce a function call. */
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/** Clamp a number between min and max. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
