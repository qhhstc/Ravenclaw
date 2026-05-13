export type AppRoute = {
  path: string;
  title: string;
  menuLabel: string;
  iconKey: string;
};

export const appRoutes: AppRoute[] = [
  { path: "/dashboard", title: "经营看板", menuLabel: "经营看板", iconKey: "line-chart" },
  { path: "/channel-data", title: "渠道数据", menuLabel: "渠道数据", iconKey: "bar-chart" },
  { path: "/crm/customers", title: "客户 CRM", menuLabel: "客户 CRM", iconKey: "team" },
  { path: "/inquiries", title: "询盘报价", menuLabel: "询盘报价", iconKey: "idcard" },
  { path: "/products", title: "产品库", menuLabel: "产品库", iconKey: "product" },
  { path: "/orders", title: "订单中心", menuLabel: "订单中心", iconKey: "ordered-list" },
  { path: "/reports/profit", title: "利润报表", menuLabel: "利润报表", iconKey: "dollar" },
  { path: "/finance", title: "财务中心", menuLabel: "财务中心", iconKey: "dollar" },
  { path: "/influencers", title: "红人合作", menuLabel: "红人合作", iconKey: "usergroup-add" },
  { path: "/settings/basic", title: "基础资料", menuLabel: "基础资料", iconKey: "shop" },
  { path: "/settings/system", title: "账号管理", menuLabel: "账号管理", iconKey: "setting" },
];

export function getRouteTitle(pathname: string) {
  return appRoutes.find((route) => isRouteSelected(pathname, route.path))?.title ?? "经营管理系统";
}

export function getSelectedRoute(pathname: string) {
  if (pathname === "/settings/users" || pathname.startsWith("/settings/users/") || pathname === "/users" || pathname.startsWith("/users/")) {
    return "/settings/system";
  }
  if (pathname === "/influencer" || pathname.startsWith("/influencer/")) return "/influencers";
  return appRoutes.find((route) => isRouteSelected(pathname, route.path))?.path ?? "/dashboard";
}

export function isRouteSelected(pathname: string, routePath: string) {
  if (pathname === routePath || pathname.startsWith(`${routePath}/`)) return true;
  if (routePath === "/settings/system") {
    return pathname === "/settings/users" || pathname.startsWith("/settings/users/") || pathname === "/users" || pathname.startsWith("/users/");
  }
  if (routePath === "/influencers") {
    return pathname === "/influencer" || pathname.startsWith("/influencer/");
  }
  return false;
}
