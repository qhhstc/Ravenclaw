import {
  BarChartOutlined,
  DollarOutlined,
  GlobalOutlined,
  IdcardOutlined,
  LineChartOutlined,
  OrderedListOutlined,
  SettingOutlined,
  ShopOutlined,
  TeamOutlined,
  UsergroupAddOutlined,
} from "@ant-design/icons";
import { createElement, type ReactNode } from "react";

export type AppRoute = {
  path: string;
  title: string;
  menuLabel: string;
  icon: ReactNode;
};

export const appRoutes: AppRoute[] = [
  { path: "/dashboard", title: "经营看板", menuLabel: "经营看板", icon: createElement(LineChartOutlined) },
  { path: "/channel-data", title: "渠道数据", menuLabel: "渠道数据", icon: createElement(BarChartOutlined) },
  { path: "/crm/customers", title: "客户 CRM", menuLabel: "客户 CRM", icon: createElement(TeamOutlined) },
  { path: "/inquiries", title: "询盘报价", menuLabel: "询盘报价", icon: createElement(IdcardOutlined) },
  { path: "/orders", title: "订单中心", menuLabel: "订单中心", icon: createElement(OrderedListOutlined) },
  { path: "/finance", title: "财务中心", menuLabel: "财务中心", icon: createElement(DollarOutlined) },
  { path: "/influencers", title: "红人合作", menuLabel: "红人合作", icon: createElement(UsergroupAddOutlined) },
  { path: "/settings/basic", title: "基础资料", menuLabel: "基础资料", icon: createElement(ShopOutlined) },
  { path: "/settings/system", title: "系统设置", menuLabel: "系统设置", icon: createElement(SettingOutlined) },
];

export function getRouteTitle(pathname: string) {
  return appRoutes.find((route) => pathname === route.path || pathname.startsWith(`${route.path}/`))?.title ?? "跨境经营数据中心";
}

export function getSelectedRoute(pathname: string) {
  return appRoutes.find((route) => pathname === route.path || pathname.startsWith(`${route.path}/`))?.path ?? "/dashboard";
}

export function getSystemIcon() {
  return createElement(GlobalOutlined);
}
