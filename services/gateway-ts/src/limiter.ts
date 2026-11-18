// A tiny concurrency limiter: at most `max` tasks run at the same time.
export type Limiter = <T>(task: () => Promise<T>) => Promise<T>;

export function createLimiter(max: number): Limiter {
  let active = 0;
  const waiting: Array<() => void> = [];

  return async function run<T>(task: () => Promise<T>): Promise<T> {
    while (active >= max) {
      await new Promise<void>((wake) => waiting.push(wake));
    }
    active++;
    try {
      return await task();
    } finally {
      active--;
      waiting.shift()?.();
    }
  };
}
