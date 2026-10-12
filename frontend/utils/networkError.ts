import { isAxiosError } from "axios";

/**
 * 인터넷은 되지만 서버가 조회(GET)에 500번대로 실패한 경우. 앱 전체를 피그마
 * Screen/Common/LoadError로 덮는다. 쓰기 요청 실패는 화면마다 토스트로 알린다.
 */
export function isServerLoadError(error: unknown): boolean {
  if (!isAxiosError(error) || !error.response) return false;
  const method = (error.config?.method ?? "get").toLowerCase();
  return method === "get" && error.response.status >= 500;
}

export function isNetworkError(error: unknown): boolean {
  if (!isAxiosError(error) || error.response || error.code === "ERR_CANCELED") return false;
  return error.code === "ERR_NETWORK" || error.code === "ECONNABORTED" || error.code === "ETIMEDOUT" || Boolean(error.request);
}
