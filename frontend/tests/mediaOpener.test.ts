import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { openMediaUrl } from "../utils/mediaOpener";

const url = "https://files.example/exam.pdf";
const detailSource = readFileSync("app/(tabs)/board/post/[postId].tsx", "utf8");

test("웹 첨부는 같은 탭으로 열고 외부 URL 열기를 호출하지 않는다", async () => {
  const calls: string[] = [];

  await openMediaUrl(url, {
    platform: "web",
    assignWebLocation: (nextUrl) => calls.push(`assign:${nextUrl}`),
    openExternalUrl: async (nextUrl) => calls.push(`external:${nextUrl}`),
  });

  assert.deepEqual(calls, [`assign:${url}`]);
});

test("네이티브 첨부는 외부 URL 열기를 사용한다", async () => {
  const calls: string[] = [];

  await openMediaUrl(url, {
    platform: "ios",
    assignWebLocation: (nextUrl) => calls.push(`assign:${nextUrl}`),
    openExternalUrl: async (nextUrl) => calls.push(`external:${nextUrl}`),
  });

  assert.deepEqual(calls, [`external:${url}`]);
});

test("게시글 상세의 기존 첨부 열기는 공용 미디어 열기를 사용한다", () => {
  for (const source of [detailSource]) {
    assert.match(source, /openMediaUrl\(accessUrl, \{/);
    assert.match(source, /platform: Platform\.OS/);
    assert.match(source, /assignWebLocation: \(url\) => window\.location\.assign\(url\)/);
    assert.match(source, /openExternalUrl: \(url\) => Linking\.openURL\(url\)/);
  }
});
