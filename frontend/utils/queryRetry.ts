// react-query 공통 재시도 규칙.
// 앱 시작 직후나 네트워크 전환 순간에는 첫 요청이 "Network Error"로 즉시 실패할 수 있다.
// 서버가 응답한 오류(4xx/5xx)는 재시도해도 결과가 같으므로 바로 실패시키고,
// 응답 자체를 받지 못한 네트워크 오류만 짧은 간격으로 몇 번 더 시도한다.
// 앱 시작 직후에는 네트워크가 열리기까지 10초 안팎 걸릴 수 있어 그 구간을 덮을 만큼 재시도한다.
export const NETWORK_RETRY_LIMIT = 5;

type RetryableError = {
  code?: unknown;
  response?: unknown;
  message?: unknown;
};

export function isNetworkError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as RetryableError;
  if (err.response) return false;
  if (err.code === "ERR_NETWORK" || err.code === "ECONNABORTED" || err.code === "ETIMEDOUT") return true;
  return typeof err.message === "string" && /network error|timeout/i.test(err.message);
}

export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  return isNetworkError(error) && failureCount < NETWORK_RETRY_LIMIT;
}

export function queryRetryDelay(attemptIndex: number): number {
  return Math.min(500 * 2 ** attemptIndex, 4000);
}
