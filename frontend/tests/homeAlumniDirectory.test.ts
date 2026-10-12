import assert from "node:assert/strict";
import test from "node:test";

type DirectoryBoard = {
  slug: string;
  is_active?: boolean;
  metadata?: Record<string, unknown> | null;
};

type DirectoryLinkState =
  | { status: "ready"; url: string }
  | { status: "missing" }
  | { status: "invalid" };

type DirectoryLinkResolver = (boards: DirectoryBoard[]) => DirectoryLinkState;

async function directoryLinkResolver() {
  const module = await import("../utils/homeAlumniDirectory").catch(() => ({}));
  const resolver = (module as { homeAlumniDirectoryLink?: DirectoryLinkResolver }).homeAlumniDirectoryLink;
  if (!resolver) assert.fail("homeAlumniDirectoryLink must be exported");
  return resolver;
}

test("홈 동문회 주소록은 게시판 설정이 없어도 지정된 리맴버 링크를 사용한다", async () => {
  const resolveLink = await directoryLinkResolver();

  assert.deepEqual(resolveLink([]), {
    status: "ready",
    url: "https://app.rmbr.in/SPbmZjUxRzb",
  });
});

test("홈 동문회 주소록은 게시판 활성 상태와 관리자 링크보다 지정된 리맴버 링크를 우선한다", async () => {
  const resolveLink = await directoryLinkResolver();

  assert.deepEqual(
    resolveLink([
      {
        slug: "alumni-directory",
        is_active: false,
        metadata: { external_url: "https://wrong.example.com/alumni" },
      },
    ]),
    { status: "ready", url: "https://app.rmbr.in/SPbmZjUxRzb" },
  );
});
