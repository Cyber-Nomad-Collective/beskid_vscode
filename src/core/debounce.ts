export function debounce<T extends (...args: never[]) => void>(
  fn: T,
  delayMs: number,
): { schedule: (...args: Parameters<T>) => void; cancel: () => void } {
  let timer: NodeJS.Timeout | undefined;
  return {
    schedule: (...args: Parameters<T>) => {
      if (timer) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => {
        timer = undefined;
        fn(...args);
      }, delayMs);
    },
    cancel: () => {
      if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }
    },
  };
}
