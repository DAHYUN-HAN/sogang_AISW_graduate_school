import assert from "node:assert/strict";
import test from "node:test";

import { isNetworkError, NETWORK_RETRY_LIMIT, queryRetryDelay, shouldRetryQuery } from "../utils/queryRetry";

test("응답을 받지 못한 네트워크 오류만 네트워크 오류로 본다", () => {
  assert.equal(isNetworkError({ code: "ERR_NETWORK", message: "Network Error" }), true);
  assert.equal(isNetworkError({ code: "ECONNABORTED", message: "timeout of 10000ms exceeded" }), true);
  assert.equal(isNetworkError({ message: "Network Error" }), true);
  assert.equal(isNetworkError({ response: { status: 401 }, message: "Request failed" }), false);
  assert.equal(isNetworkError({ response: { status: 500 } }), false);
  assert.equal(isNetworkError(new Error("boom")), false);
  assert.equal(isNetworkError(null), false);
});

test("네트워크 오류는 제한 횟수까지만 재시도하고 서버 오류는 재시도하지 않는다", () => {
  const networkError = { code: "ERR_NETWORK", message: "Network Error" };
  assert.equal(shouldRetryQuery(0, networkError), true);
  assert.equal(shouldRetryQuery(NETWORK_RETRY_LIMIT - 1, networkError), true);
  assert.equal(shouldRetryQuery(NETWORK_RETRY_LIMIT, networkError), false);
  assert.equal(shouldRetryQuery(0, { response: { status: 404 } }), false);
  assert.equal(shouldRetryQuery(0, { response: { status: 401 } }), false);
});

test("재시도 간격은 짧게 시작해 4초를 넘지 않는다", () => {
  assert.equal(queryRetryDelay(0), 500);
  assert.equal(queryRetryDelay(1), 1000);
  assert.equal(queryRetryDelay(2), 2000);
  assert.equal(queryRetryDelay(3), 4000);
  assert.equal(queryRetryDelay(5), 4000);
});

test("네트워크 재시도 총 대기 시간은 앱 시작 직후 네트워크 준비 구간(10초)을 덮는다", () => {
  let total = 0;
  for (let attempt = 0; attempt < NETWORK_RETRY_LIMIT; attempt += 1) total += queryRetryDelay(attempt);
  assert.ok(total >= 10_000, `total ${total}ms`);
});
