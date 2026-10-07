import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { AxiosError } from "axios";
import ts from "typescript";
import { isNetworkError } from "../utils/networkError";
import { enabledRefetch, refreshQueries } from "../utils/pullToRefresh";

const source = ts.createSourceFile("home.tsx", readFileSync("app/(tabs)/(home,notices,community,participation,council)/home.tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const screen = source.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === "HomeScreen")!;
const js = ts.transpileModule(screen.getText(source).replace("export default ", "") + "\ntree = HomeScreen();", {
  compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React },
}).outputText;
type Element = { type: unknown; props: Record<string, any>; children: any[] };
function render(errors: Record<string, unknown>) {
  const retries: string[] = [];
  const query = (key: string) => ({ data: { data: [] }, isError: Boolean(errors[key]), error: errors[key], isLoading: false, isRefetching: false,
    refetch: async () => { retries.push(key); } });
  const board = query("boards");
  const bindings: Record<string, any> = {
    React: { Fragment: "Fragment", createElement: (type: unknown, props: unknown, ...children: unknown[]) => ({ type, props: props ?? {}, children }) },
    useSafeAreaInsets: () => ({ top: 0 }), useUserStore: (selector: any) => selector({ user: { nickname: "테스트" }, isAuthenticated: true }),
    useMyPageDrawer: () => ({ openDrawer() {} }), useState: (initial: any) => [typeof initial === "function" ? initial() : initial, () => {}],
    useFocusEffect() {}, useCallback: (fn: any) => fn, useMemo: (fn: any) => fn(),
    currentKoreaMonth: () => new Date(2026, 9, 1), calendarMonthWindowRange: () => ({ start: "2026-10-01", end: "2026-10-31" }),
    useBoardsQuery: () => ({ ...board, isError: board.isError, error: board.error }), flattenBoards: () => [],
    isNoticeContentBoard: () => false, findBoardId: () => 7, POPULAR_BOARD_SLUGS: [], ALBUM_BOARD_SLUGS: [],
    useQuery: ({ queryKey }: any) => query(queryKey[0] === "home" ? queryKey[1] : queryKey[0]),
    bannerApi: {}, postApi: {}, eventApi: {}, notificationApi: {}, keepPreviousData: undefined, HOME_ALBUM_LIMIT: 10,
    homeAlumniDirectoryLink: () => ({ status: "ready", url: "https://example.com" }),
    isNetworkError, enabledRefetch, refreshQueries, styles: { content: {}, networkErrorContent: { flexGrow: 1, backgroundColor: "#FFFFFF" }, networkErrorBody: { backgroundColor: "#FFFFFF" } },
    COLORS: { primary: "#2761FF" }, SHOW_HOME_POPULAR_POSTS: false, tree: undefined,
  };
  for (const name of ["ScrollView", "RefreshControl", "View", "Text", "IconButton", "BellIcon", "ProfileIcon", "NetworkErrorState", "ActivityIndicator", "HomeErrorState", "HomeBannerCarousel", "SectionHeader", "NoticeList", "CalendarCard", "HomeSectionGate", "HomePopularPostsSection", "AlbumStrip", "Pressable", "ForwardIcon"]) bindings[name] = name;
  runInNewContext(js, bindings);
  const nodes: Element[] = [];
  function walk(value: any) { if (Array.isArray(value)) value.forEach(walk); else if (value && typeof value === "object" && "children" in value) { nodes.push(value); value.children.forEach(walk); } }
  walk(bindings.tree);
  return { nodes, tree: bindings.tree as Element, retries };
}

test("여러 홈 요청이 연결에 실패해도 흰 배경의 오류 화면은 하나만 표시하고 모두 재시도한다", async () => {
  const network = new AxiosError("Network Error", "ERR_NETWORK");
  const { nodes, tree, retries } = render({ boards: network, banners: network, notices: network, events: network, album: network });
  const errors = nodes.filter(node => node.type === "NetworkErrorState");
  assert.equal(errors.length, 1);
  assert.equal(nodes.some(node => ["HomeErrorState", "NoticeList", "AlbumStrip", "CalendarCard", "SectionHeader"].includes(String(node.type))), false);
  assert.equal(tree.props.contentContainerStyle[1].backgroundColor, "#FFFFFF");
  errors[0].props.onRetry();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(retries.sort(), ["album", "banners", "boards", "events", "notices", "notifications"]);
});

test("일정 하나의 연결 실패도 통합하고 서버 응답 오류와 복구 후에는 정상 홈을 표시한다", () => {
  assert.equal(render({ events: new AxiosError("timeout", "ETIMEDOUT") }).nodes.filter(node => node.type === "NetworkErrorState").length, 1);
  for (const errors of [{ events: new Error("server error") }, {}]) {
    const { nodes } = render(errors);
    assert.equal(nodes.some(node => node.type === "NetworkErrorState"), false);
    assert.equal(nodes.some(node => node.type === "NoticeList"), true);
  }
});
