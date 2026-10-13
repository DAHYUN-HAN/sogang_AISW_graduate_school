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

/**
 * 화면의 첫 조회가 실패한 경우(4xx 포함). 인터넷 끊김은 네트워크 오류 화면이, 401은
 * 로그인 갱신이 맡으므로 빼고, 나머지는 500번대와 같이 앱 전체 LoadError로 덮는다.
 */
export function isLoadFailure(error: unknown): boolean {
  if (!error || isNetworkError(error)) return false;
  if (isAxiosError(error)) {
    if (error.code === "ERR_CANCELED") return false;
    if (error.response?.status === 401) return false;
  }
  return true;
}
