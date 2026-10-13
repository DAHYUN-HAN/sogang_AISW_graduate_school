import {
  COMMUNITY_TAB_ROUTE,
  COUNCIL_TAB_ROUTE,
  HOME_TAB_ROUTE,
  NOTICES_TAB_ROUTE,
  PARTICIPATION_TAB_ROUTE,
} from "./appRoutes";

export const MY_PAGE_ORIGIN_ROUTES = [
  HOME_TAB_ROUTE,
  NOTICES_TAB_ROUTE,
  COMMUNITY_TAB_ROUTE,
  PARTICIPATION_TAB_ROUTE,
  COUNCIL_TAB_ROUTE,
] as const;

export type MyPageOriginRoute = (typeof MY_PAGE_ORIGIN_ROUTES)[number];

export function myPageOriginRoute(value: unknown): MyPageOriginRoute | null {
  if (typeof value !== "string") return null;
  const withoutGroup = value.replace(/^\/\(tabs\)/, "");
  const normalized = withoutGroup.length > 1 ? withoutGroup.replace(/\/+$/, "") : withoutGroup;
  const route = MY_PAGE_ORIGIN_ROUTES.find((candidate) => candidate.replace("/(tabs)", "") === normalized);
  return route ?? null;
}
