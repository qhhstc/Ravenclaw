"use client";

import { Card, Spin, Tabs } from "antd";
import BrandManager from "./BrandManager";
import ChannelManager from "./ChannelManager";
import CountryManager from "./CountryManager";
import CurrencyManager from "./CurrencyManager";
import ExchangeRateManager from "./ExchangeRateManager";
import PlatformManager from "./PlatformManager";
import StoreManager from "./StoreManager";
import { useBasicOptions } from "./useBasicOptions";

export default function BasicDataTabs() {
  const { options, loading } = useBasicOptions();

  return (
    <Spin spinning={loading}>
      <Card styles={{ body: { padding: 0 } }}>
        <Tabs
          defaultActiveKey="brands"
          destroyOnHidden={false}
          items={[
            { key: "brands", label: "品牌管理", children: <BrandManager options={options} /> },
            { key: "platforms", label: "平台管理", children: <PlatformManager /> },
            { key: "stores", label: "店铺/站点", children: <StoreManager options={options} /> },
            { key: "channels", label: "渠道管理", children: <ChannelManager options={options} /> },
            { key: "countries", label: "国家/地区", children: <CountryManager /> },
            { key: "currencies", label: "币种管理", children: <CurrencyManager /> },
            { key: "exchange-rates", label: "汇率管理", children: <ExchangeRateManager options={options} /> },
          ]}
          tabBarStyle={{ padding: "0 20px", marginBottom: 0 }}
        />
      </Card>
    </Spin>
  );
}
