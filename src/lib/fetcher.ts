type RetryOptions = {
  attempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  timeoutMs?: number;
  retryStatuses?: number[];
  retryOn?: (response: Response) => boolean;
};

const DEFAULT_RETRY_STATUSES = [408, 425, 429, 500, 502, 503, 504];
const DEFAULT_ATTEMPTS = 3;
const DEFAULT_BASE_DELAY_MS = 250;
const DEFAULT_MAX_DELAY_MS = 2000;
const DEFAULT_TIMEOUT_MS = 10000;

function getDelayMs(attempt: number, baseDelayMs: number, maxDelayMs: number) {
  const expDelay = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt));
  const jitter = Math.floor(Math.random() * (baseDelayMs + 50));
  return expDelay + jitter;
}

function shouldRetry(response: Response, retryStatuses: number[], retryOn?: (response: Response) => boolean) {
  if (retryOn) return retryOn(response);
  return retryStatuses.includes(response.status);
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchWithRetry(input: RequestInfo, init?: RequestInit, options?: RetryOptions) {
  const attempts = options?.attempts ?? DEFAULT_ATTEMPTS;
  const baseDelayMs = options?.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const maxDelayMs = options?.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retryStatuses = options?.retryStatuses ?? DEFAULT_RETRY_STATUSES;

  let lastError: unknown;

  for (let attempt = 0; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = init?.signal ? null : setTimeout(() => controller.abort(), timeoutMs);
    const signal = init?.signal ?? controller.signal;

    try {
      const response = await fetch(input, { ...init, signal });
      if (!response.ok && shouldRetry(response, retryStatuses, options?.retryOn) && attempt < attempts) {
        await sleep(getDelayMs(attempt, baseDelayMs, maxDelayMs));
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt >= attempts) break;
      await sleep(getDelayMs(attempt, baseDelayMs, maxDelayMs));
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("fetch-failed");
}
