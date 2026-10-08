import { isAxiosError } from "axios";

export function isNetworkError(error: unknown): boolean {
  if (!isAxiosError(error) || error.response || error.code === "ERR_CANCELED") return false;
  return error.code === "ERR_NETWORK" || error.code === "ECONNABORTED" || error.code === "ETIMEDOUT" || Boolean(error.request);
}
