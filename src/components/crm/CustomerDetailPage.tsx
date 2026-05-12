"use client";

import { ArrowLeftOutlined, EditOutlined } from "@ant-design/icons";
import { Button, Card, Descriptions, Empty, Space, Spin, Tabs, Tag, Typography, message } from "antd";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import CustomerContactPanel from "./CustomerContactPanel";
import CustomerFollowupPanel from "./CustomerFollowupPanel";
import CustomerFormModal from "./CustomerFormModal";
import CustomerRelatedPanel from "./CustomerRelatedPanel";
import CustomerTradeAnalysisPanel from "./CustomerTradeAnalysisPanel";
import {
  FollowupTime,
  LevelTag,
  StatusTag,
  channelLabel,
  customerTypeOptions,
  formatDateTime,
  optionLabel,
  type CrmBrand,
  type CrmChannel,
  type CrmCountry,
  type CrmUser,
  type CustomerRecord,
} from "./crmOptions";

type Props = { customerId: number };
type ItemResponse = { item?: CustomerRecord; message?: string };
type OptionResponse<T> = { items: T[]; message?: string };

export default function CustomerDetailPage({ customerId }: Props) {
  const router = useRouter();
  const [customer, setCustomer] = useState<CustomerRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [brands, setBrands] = useState<CrmBrand[]>([]);
  const [countries, setCountries] = useState<CrmCountry[]>([]);
  const [channels, setChannels] = useState<CrmChannel[]>([]);
  const [users, setUsers] = useState<CrmUser[]>([]);

  const loadCustomer = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/crm/customers/${customerId}`);
      const data = (await response.json()) as ItemResponse;
      if (!response.ok || !data.item) throw new Error(data.message || "客户详情加载失败");
      setCustomer(data.item);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "客户详情加载失败");
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  const loadOptions = useCallback(async () => {
    try {
      const [brandRes, countryRes, channelRes, userRes] = await Promise.all([
        fetch("/api/basic/brands?pageSize=100&status=active"),
        fetch("/api/basic/countries?pageSize=100&status=active"),
        fetch("/api/basic/channels?pageSize=100"),
        fetch("/api/crm/users"),
      ]);
      const [brandData, countryData, channelData, userData] = (await Promise.all([brandRes.json(), countryRes.json(), channelRes.json(), userRes.json()])) as [OptionResponse<CrmBrand>, OptionResponse<CrmCountry>, OptionResponse<CrmChannel>, OptionResponse<CrmUser>];
      setBrands(brandData.items ?? []);
      setCountries(countryData.items ?? []);
      setChannels(channelData.items ?? []);
      setUsers(userData.items ?? []);
    } catch {
      message.error("基础选项加载失败");
    }
  }, []);

  useEffect(() => {
    queueMicrotask(loadCustomer);
    queueMicrotask(loadOptions);
  }, [loadCustomer, loadOptions]);

  async function saveCustomer(values: Record<string, unknown>) {
    setSaving(true);
    try {
      const response = await fetch(`/api/crm/customers/${customerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message || "保存失败");
      message.success("客户已更新");
      setModalOpen(false);
      await loadCustomer();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  if (!customer && !loading) return <Empty description="客户不存在或已被删除" />;

  return (
    <Spin spinning={loading}>
      {customer ? (
        <div className="max-w-full overflow-hidden">
          <Card className="mb-4" styles={{ body: { padding: 20 } }}>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
              <div>
                <Space className="mb-2" wrap>
                  <Typography.Title level={3} className="!mb-0 !text-[#172033]">{customer.name}</Typography.Title>
                  <LevelTag level={customer.level} />
                  <StatusTag status={customer.status} />
                </Space>
                <div className="text-sm text-[#667085]">{customer.companyName || "未填写公司名称"}</div>
              </div>
              <Space>
                <Button icon={<ArrowLeftOutlined />} onClick={() => router.push("/crm/customers")}>返回</Button>
                <Button type="primary" icon={<EditOutlined />} onClick={() => setModalOpen(true)}>编辑</Button>
              </Space>
            </div>
            <Descriptions bordered size="small" column={{ xs: 1, md: 2, xl: 4 }}>
              <Descriptions.Item label="国家">{customer.countryCode || "-"}</Descriptions.Item>
              <Descriptions.Item label="所属品牌">{customer.brand?.name ?? "-"}</Descriptions.Item>
              <Descriptions.Item label="来源渠道">{channelLabel(customer.sourceChannel)}</Descriptions.Item>
              <Descriptions.Item label="负责人">{customer.owner?.name ?? "-"}</Descriptions.Item>
              <Descriptions.Item label="最近跟进">{formatDateTime(customer.lastFollowupAt)}</Descriptions.Item>
              <Descriptions.Item label="下次跟进"><FollowupTime value={customer.nextFollowupAt} status={customer.status} /></Descriptions.Item>
              <Descriptions.Item label="客户类型">{optionLabel(customerTypeOptions, customer.customerType)}</Descriptions.Item>
              <Descriptions.Item label="标签">{customer.tags?.length ? customer.tags.map((tag) => <Tag key={tag}>{tag}</Tag>) : "-"}</Descriptions.Item>
            </Descriptions>
          </Card>

          <Card>
            <Tabs
              items={[
                {
                  key: "basic",
                  label: "基本信息",
                  children: (
                    <Descriptions bordered column={{ xs: 1, md: 2 }}>
                      <Descriptions.Item label="邮箱">{customer.email || "-"}</Descriptions.Item>
                      <Descriptions.Item label="电话">{customer.phone || "-"}</Descriptions.Item>
                      <Descriptions.Item label="WhatsApp">{customer.whatsapp || "-"}</Descriptions.Item>
                      <Descriptions.Item label="网站">{customer.website || "-"}</Descriptions.Item>
                      <Descriptions.Item label="创建时间">{formatDateTime(customer.createdAt)}</Descriptions.Item>
                      <Descriptions.Item label="更新时间">{formatDateTime(customer.updatedAt)}</Descriptions.Item>
                      <Descriptions.Item label="备注" span={2}>{customer.remark || "-"}</Descriptions.Item>
                    </Descriptions>
                  ),
                },
                { key: "contacts", label: "联系人", children: <CustomerContactPanel customerId={customer.id} contacts={customer.contacts ?? []} onReload={loadCustomer} /> },
                { key: "followups", label: "跟进记录", children: <CustomerFollowupPanel customerId={customer.id} followups={customer.followups ?? []} onReload={loadCustomer} /> },
                { key: "trade", label: "交易分析", children: <CustomerTradeAnalysisPanel orders={customer.orders ?? []} /> },
                { key: "related", label: "相关数据", children: <CustomerRelatedPanel /> },
              ]}
            />
          </Card>

          <CustomerFormModal
            open={modalOpen}
            saving={saving}
            editing={customer}
            brands={brands}
            countries={countries}
            channels={channels}
            users={users}
            onCancel={() => setModalOpen(false)}
            onSubmit={saveCustomer}
          />
        </div>
      ) : null}
    </Spin>
  );
}
