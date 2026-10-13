import { HOME_TAB_ROUTE } from "./appRoutes";
import { myPageOriginRoute } from "./myPageNavigation";

export function androidTabBackAction(
  pathname: string,
  canGoBack: boolean,
): "home" | "default" {
  const tabRoot = myPageOriginRoute(pathname);
  if (tabRoot === HOME_TAB_ROUTE) return "default";
  if (tabRoot || !canGoBack) return "home";

  return "default";
}
