import type { Href, Router } from "expo-router";
import { adminDestination } from "./adminNavigation";

export function adminPostRouter(router: Router, enabled: boolean): Router {
  if (!enabled) return router;
  const destination = (href: Href) => adminDestination(href as string | { pathname: string; params?: unknown }) as Href;
  return {
    ...router,
    push: (href, options) => router.push(destination(href), options),
    replace: (href, options) => router.replace(destination(href), options),
    navigate: (href, options) => router.navigate(destination(href), options),
    dismissTo: (href, options) => router.dismissTo(destination(href), options),
  };
}
