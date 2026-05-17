"use client";

import { ArrowRightOutlined, EditOutlined, FileAddOutlined, PlusOutlined, PrinterOutlined, ReloadOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Empty, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Table, Tabs, Tag, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { moneyText } from "@/components/orders/orderOptions";

type Option = { label: string; value: number | string };

type InquiryRecord = {
  id: number;
  inquiryNo: string;
  title: string;
  content?: string | null;
  status: string;
  customerId?: number | null;
  brandId?: number | null;
  platformId?: number | null;
  storeId?: number | null;
  channelId?: number | null;
  countryCode?: string | null;
  customer?: { id: number; name: string; companyName?: string | null; countryCode?: string | null } | null;
  brand?: { id: number; name: string; code?: string | null } | null;
  platform?: { id: number; name: string; code?: string | null } | null;
  store?: { id: number; name: string; defaultCurrency?: string | null } | null;
  channel?: { id: number; businessLine: string; channelName: string } | null;
  quotes?: Array<{ id: number; quoteNo: string; status: string; totalAmount: number; currency: string }>;
  createdAt: string;
  updatedAt: string;
};

type QuoteItem = {
  id?: number;
  sku?: string | null;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice?: number;
  remark?: string | null;
};

type QuoteRecord = {
  id: number;
  quoteNo: string;
  status: string;
  currency: string;
  totalAmount: number;
  productAmount?: number;
  shippingFee?: number;
  discountAmount?: number;
  taxAmount?: number;
  otherFee?: number;
  remark?: string | null;
  customerId?: number | null;
  inquiryId?: number | null;
  brandId?: number | null;
  platformId?: number | null;
  storeId?: number | null;
  channelId?: number | null;
  countryCode?: string | null;
  customer?: { id: number; name: string; companyName?: string | null } | null;
  inquiry?: { id: number; inquiryNo: string; title: string; status: string } | null;
  brand?: { id: number; name: string } | null;
  platform?: { id: number; name: string } | null;
  store?: { id: number; name: string } | null;
  channel?: { id: number; businessLine: string; channelName: string } | null;
  items?: QuoteItem[];
  order?: { id: number; orderNo: string } | null;
  createdAt: string;
};

type ListResponse<T> = { items?: T[]; total?: number; message?: string };

const inquiryStatusLabels: Record<string, string> = {
  new: "新询盘",
  quoted: "已报价",
  won: "已成交",
  lost: "已丢单",
  closed: "已关闭",
};

const quoteStatusLabels: Record<string, string> = {
  draft: "草稿",
  sent: "已发送",
  accepted: "已接受",
  converted: "已转订单",
  rejected: "已拒绝",
};

const statusColors: Record<string, string> = {
  new: "blue",
  quoted: "purple",
  won: "green",
  lost: "red",
  closed: "default",
  draft: "default",
  sent: "blue",
  accepted: "green",
  converted: "purple",
  rejected: "red",
};

const currencyOptions = ["USD", "CNY", "EUR", "JPY", "GBP"].map((value) => ({ label: value, value }));
const quoteStatusOptions = Object.entries(quoteStatusLabels).filter(([value]) => value !== "converted").map(([value, label]) => ({ label, value }));
const inquiryStatusOptions = Object.entries(inquiryStatusLabels).map(([value, label]) => ({ label, value }));

function rowTotal(item?: QuoteItem) {
  return Number(item?.quantity || 0) * Number(item?.unitPrice || 0);
}

export default function InquiriesPage() {
  const router = useRouter();
  const [inquiryForm] = Form.useForm();
  const [quoteForm] = Form.useForm();
  const [inquiries, setInquiries] = useState<InquiryRecord[]>([]);
  const [quotes, setQuotes] = useState<QuoteRecord[]>([]);
  const [customers, setCustomers] = useState<Option[]>([]);
  const [brands, setBrands] = useState<Option[]>([]);
  const [platforms, setPlatforms] = useState<Option[]>([]);
  const [stores, setStores] = useState<Option[]>([]);
  const [channels, setChannels] = useState<Option[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [convertingId, setConvertingId] = useState<number | null>(null);
  const [inquiryModalOpen, setInquiryModalOpen] = useState(false);
  const [quoteModalOpen, setQuoteModalOpen] = useState(false);
  const [editingInquiry, setEditingInquiry] = useState<InquiryRecord | null>(null);
  const [editingQuote, setEditingQuote] = useState<QuoteRecord | null>(null);
  const [currentRole, setCurrentRole] = useState("viewer");

  const canManage = ["admin", "sales"].includes(currentRole);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [inquiryResponse, quoteResponse] = await Promise.all([
        fetch("/api/inquiries?pageSize=100"),
        fetch("/api/quotes?pageSize=100"),
      ]);
      const [inquiryData, quoteData] = await Promise.all([
        inquiryResponse.json() as Promise<ListResponse<InquiryRecord>>,
        quoteResponse.json() as Promise<ListResponse<QuoteRecord>>,
      ]);
      if (!inquiryResponse.ok) throw new Error(inquiryData.message || "询盘列表加载失败");
      if (!quoteResponse.ok) throw new Error(quoteData.message || "报价列表加载失败");
      setInquiries(inquiryData.items ?? []);
      setQuotes(quoteData.items ?? []);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "询盘报价加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadOptions = useCallback(async () => {
    const [customerResponse, brandResponse, platformResponse, storeResponse, channelResponse, meResponse] = await Promise.all([
      fetch("/api/crm/customers?pageSize=100"),
      fetch("/api/basic/brands?pageSize=100&status=active"),
      fetch("/api/basic/platforms?pageSize=100&status=active"),
      fetch("/api/basic/stores?pageSize=100&status=active"),
      fetch("/api/basic/channels?pageSize=100&status=active"),
      fetch("/api/auth/me"),
    ]);
    const [customerData, brandData, platformData, storeData, channelData, meData] = await Promise.all([customerResponse.json(), brandResponse.json(), platformResponse.json(), storeResponse.json(), channelResponse.json(), meResponse.json()]);
    setCustomers((customerData.items ?? []).map((item: { id: number; name: string; companyName?: string }) => ({ label: item.companyName ? `${item.name} (${item.companyName})` : item.name, value: item.id })));
    setBrands((brandData.items ?? []).map((item: { id: number; name: string; code?: string }) => ({ label: item.code ? `${item.name} (${item.code})` : item.name, value: item.id })));
    setPlatforms((platformData.items ?? []).map((item: { id: number; name: string; code?: string }) => ({ label: item.code ? `${item.name} (${item.code})` : item.name, value: item.id })));
    setStores((storeData.items ?? []).map((item: { id: number; name: string }) => ({ label: item.name, value: item.id })));
    setChannels((channelData.items ?? []).map((item: { id: number; businessLine: string; channelName: string }) => ({ label: `${item.businessLine} / ${item.channelName}`, value: item.id })));
    setCurrentRole(meData.user?.role ?? "viewer");
  }, []);

  useEffect(() => {
    queueMicrotask(loadData);
    queueMicrotask(loadOptions);
  }, [loadData, loadOptions]);

  function openInquiryCreate() {
    setEditingInquiry(null);
    inquiryForm.resetFields();
    inquiryForm.setFieldsValue({ status: "new" });
    setInquiryModalOpen(true);
  }

  function openInquiryEdit(row: InquiryRecord) {
    setEditingInquiry(row);
    inquiryForm.setFieldsValue(row);
    setInquiryModalOpen(true);
  }

  function openQuoteCreate(source?: InquiryRecord) {
    setEditingQuote(null);
    quoteForm.resetFields();
    quoteForm.setFieldsValue({
      inquiryId: source?.id,
      customerId: source?.customerId,
      brandId: source?.brandId,
      platformId: source?.platformId,
      storeId: source?.storeId,
      channelId: source?.channelId,
      countryCode: source?.countryCode ?? source?.customer?.countryCode,
      currency: source?.store?.defaultCurrency ?? "USD",
      status: "draft",
      shippingFee: 0,
      discountAmount: 0,
      taxAmount: 0,
      otherFee: 0,
      items: [{ quantity: 1, unitPrice: 0 }],
    });
    setQuoteModalOpen(true);
  }

  async function openQuoteEdit(row: QuoteRecord) {
    try {
      const response = await fetch(`/api/quotes/${row.id}`);
      const data = (await response.json()) as { item?: QuoteRecord; message?: string };
      if (!response.ok || !data.item) throw new Error(data.message || "报价详情加载失败");
      setEditingQuote(data.item);
      quoteForm.setFieldsValue({ ...data.item, items: data.item.items?.length ? data.item.items : [{ quantity: 1, unitPrice: 0 }] });
      setQuoteModalOpen(true);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "报价详情加载失败");
    }
  }

  async function saveInquiry() {
    const values = await inquiryForm.validateFields();
    setSaving(true);
    try {
      const response = await fetch(editingInquiry ? `/api/inquiries/${editingInquiry.id}` : "/api/inquiries", {
        method: editingInquiry ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message || "询盘保存失败");
      message.success(editingInquiry ? "询盘已更新" : "询盘已新增");
      setInquiryModalOpen(false);
      await loadData();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "询盘保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function saveQuote() {
    const values = await quoteForm.validateFields();
    setSaving(true);
    try {
      const response = await fetch(editingQuote ? `/api/quotes/${editingQuote.id}` : "/api/quotes", {
        method: editingQuote ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message || "报价保存失败");
      message.success(editingQuote ? "报价已更新" : "报价已新增");
      setQuoteModalOpen(false);
      await loadData();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "报价保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function convertQuote(quoteId: number) {
    setConvertingId(quoteId);
    try {
      const response = await fetch(`/api/quotes/${quoteId}/convert-to-order`, { method: "POST" });
      const data = (await response.json()) as { item?: { id: number }; message?: string };
      if (!response.ok || !data.item) throw new Error(data.message || "转订单失败");
      message.success("报价已转为订单");
      router.push(`/orders/${data.item.id}`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "转订单失败");
    } finally {
      setConvertingId(null);
    }
  }

  const inquiryColumns: ColumnsType<InquiryRecord> = [
    { title: "询盘号", dataIndex: "inquiryNo", width: 160, fixed: "left", render: (value) => <span className="font-medium">{value}</span> },
    { title: "标题", dataIndex: "title", width: 240 },
    { title: "客户", width: 180, render: (_, row) => row.customer?.name ?? "-" },
    { title: "品牌", width: 120, render: (_, row) => row.brand?.name ?? "-" },
    { title: "渠道", width: 180, render: (_, row) => row.channel ? `${row.channel.businessLine} / ${row.channel.channelName}` : "-" },
    { title: "状态", dataIndex: "status", width: 110, render: (value) => <Tag color={statusColors[value] ?? "default"}>{inquiryStatusLabels[value] ?? value}</Tag> },
    { title: "报价数", width: 90, align: "right", render: (_, row) => row.quotes?.length ?? 0 },
    {
      title: "操作",
      key: "actions",
      fixed: "right",
      width: 230,
      render: (_, row) => (
        <Space size={0}>
          {canManage ? <Button type="link" size="small" icon={<FileAddOutlined />} onClick={() => openQuoteCreate(row)}>新增报价</Button> : null}
          {canManage ? <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openInquiryEdit(row)}>编辑</Button> : null}
        </Space>
      ),
    },
  ];

  const quoteColumns: ColumnsType<QuoteRecord> = [
    { title: "报价单号", dataIndex: "quoteNo", fixed: "left", width: 160, render: (value: string) => <span className="font-medium">{value}</span> },
    { title: "询盘", width: 230, render: (_, row) => row.inquiry ? `${row.inquiry.inquiryNo} · ${row.inquiry.title}` : "-" },
    { title: "客户", width: 180, render: (_, row) => row.customer?.name ?? "-" },
    { title: "商品行", width: 90, align: "right", render: (_, row) => row.items?.length ?? 0 },
    { title: "金额", dataIndex: "totalAmount", align: "right", width: 130, render: (value, row) => moneyText(value, row.currency) },
    { title: "状态", dataIndex: "status", width: 110, render: (value) => <Tag color={statusColors[value] ?? "default"}>{quoteStatusLabels[value] ?? value}</Tag> },
    { title: "关联订单", width: 150, render: (_, row) => row.order ? <Button type="link" size="small" onClick={() => router.push(`/orders/${row.order?.id}`)}>{row.order.orderNo}</Button> : "-" },
    {
      title: "操作",
      key: "actions",
      fixed: "right",
      width: 290,
      render: (_, row) => row.order || row.status === "converted" ? (
        <Space size={0} className="whitespace-nowrap">
          <Button type="link" size="small" icon={<PrinterOutlined />} onClick={() => window.open(`/quote-print/${row.id}`, "_blank", "noopener,noreferrer")}>打印</Button>
          <Button type="link" size="small" onClick={() => row.order && router.push(`/orders/${row.order.id}`)}>查看订单</Button>
        </Space>
      ) : (
        <Space size={0} className="whitespace-nowrap">
          {canManage ? <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openQuoteEdit(row)}>维护明细</Button> : null}
          <Button type="link" size="small" icon={<PrinterOutlined />} onClick={() => window.open(`/quote-print/${row.id}`, "_blank", "noopener,noreferrer")}>打印</Button>
          {canManage ? (
            <Popconfirm title="确认将该报价单转为订单？" onConfirm={() => convertQuote(row.id)}>
              <Button type="link" size="small" icon={<ArrowRightOutlined />} loading={convertingId === row.id}>转订单</Button>
            </Popconfirm>
          ) : null}
        </Space>
      ),
    },
  ];

  return (
    <div className="page-stack">
      <div className="page-section-header">
        <div>
          <Typography.Title level={3} className="!mb-1 !text-[var(--foreground)]">询盘报价</Typography.Title>
          <Typography.Text type="secondary">从客户询盘开始，维护报价商品明细，打印报价单，成交后直接转入订单中心。</Typography.Text>
        </div>
        <Space wrap>
          <Button icon={<ReloadOutlined />} loading={loading} onClick={loadData}>刷新</Button>
          {canManage ? <Button icon={<PlusOutlined />} onClick={openInquiryCreate}>新增询盘</Button> : null}
          {canManage ? <Button type="primary" icon={<FileAddOutlined />} onClick={() => openQuoteCreate()}>新增报价</Button> : null}
        </Space>
      </div>

      <Alert
        type="info"
        showIcon
        message="流程说明"
        description="业务员先录入询盘；确认产品和价格后从询盘创建报价并维护商品明细；客户接受后点击转订单，系统会把客户、询盘、报价和商品行带到订单。"
      />

      <Tabs
        className="content-tabs"
        items={[
          {
            key: "inquiries",
            label: "询盘列表",
            children: (
              <Card styles={{ body: { padding: 0 } }}>
                <Table<InquiryRecord> rowKey="id" loading={loading} columns={inquiryColumns} dataSource={inquiries} pagination={{ pageSize: 10, showSizeChanger: true }} scroll={{ x: 1330 }} locale={{ emptyText: <Empty description="暂无询盘数据" /> }} />
              </Card>
            ),
          },
          {
            key: "quotes",
            label: "报价列表",
            children: (
              <Card styles={{ body: { padding: 0 } }}>
                <Table<QuoteRecord> rowKey="id" loading={loading} columns={quoteColumns} dataSource={quotes} pagination={{ pageSize: 10, showSizeChanger: true }} scroll={{ x: 1420 }} locale={{ emptyText: <Empty description="暂无报价数据" /> }} />
              </Card>
            ),
          },
        ]}
      />

      <Modal title={editingInquiry ? "编辑询盘" : "新增询盘"} open={inquiryModalOpen} width={760} confirmLoading={saving} onCancel={() => setInquiryModalOpen(false)} onOk={saveInquiry} destroyOnHidden>
        <Form form={inquiryForm} layout="vertical">
          <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
            <Form.Item name="title" label="询盘标题" rules={[{ required: true, message: "请输入询盘标题" }]}><Input placeholder="例如：美国客户盲盒批发询价" /></Form.Item>
            <Form.Item name="status" label="状态"><Select options={inquiryStatusOptions} /></Form.Item>
            <Form.Item name="customerId" label="客户"><Select allowClear showSearch optionFilterProp="label" options={customers} /></Form.Item>
            <Form.Item name="countryCode" label="国家/地区"><Input placeholder="US" /></Form.Item>
            <Form.Item name="brandId" label="品牌"><Select allowClear showSearch optionFilterProp="label" options={brands} /></Form.Item>
            <Form.Item name="platformId" label="平台"><Select allowClear showSearch optionFilterProp="label" options={platforms} /></Form.Item>
            <Form.Item name="storeId" label="店铺"><Select allowClear showSearch optionFilterProp="label" options={stores} /></Form.Item>
            <Form.Item name="channelId" label="渠道"><Select allowClear showSearch optionFilterProp="label" options={channels} /></Form.Item>
            <Form.Item name="content" label="客户需求" className="md:col-span-2"><Input.TextArea rows={4} placeholder="记录客户要什么产品、数量、目标价、交期、物流要求等" /></Form.Item>
          </div>
        </Form>
      </Modal>

      <Modal title={editingQuote ? `维护报价 ${editingQuote.quoteNo}` : "新增报价"} open={quoteModalOpen} width={1060} confirmLoading={saving} onCancel={() => setQuoteModalOpen(false)} onOk={saveQuote} destroyOnHidden>
        <Form form={quoteForm} layout="vertical">
          <div className="grid grid-cols-1 gap-x-4 md:grid-cols-4">
            <Form.Item name="inquiryId" label="关联询盘"><Select allowClear showSearch optionFilterProp="label" options={inquiries.map((item) => ({ label: `${item.inquiryNo} / ${item.title}`, value: item.id }))} /></Form.Item>
            <Form.Item name="customerId" label="客户"><Select allowClear showSearch optionFilterProp="label" options={customers} /></Form.Item>
            <Form.Item name="currency" label="币种"><Select options={currencyOptions} /></Form.Item>
            <Form.Item name="status" label="状态"><Select options={quoteStatusOptions} /></Form.Item>
            <Form.Item name="brandId" label="品牌"><Select allowClear showSearch optionFilterProp="label" options={brands} /></Form.Item>
            <Form.Item name="platformId" label="平台"><Select allowClear showSearch optionFilterProp="label" options={platforms} /></Form.Item>
            <Form.Item name="storeId" label="店铺"><Select allowClear showSearch optionFilterProp="label" options={stores} /></Form.Item>
            <Form.Item name="channelId" label="渠道"><Select allowClear showSearch optionFilterProp="label" options={channels} /></Form.Item>
          </div>

          <Typography.Title level={5}>商品明细</Typography.Title>
          <Form.List name="items">
            {(fields, { add, remove }) => (
              <div className="space-y-3">
                {fields.map((field, index) => (
                  <div key={field.key} className="grid grid-cols-1 gap-x-3 rounded-xl border border-[var(--border)] p-3 md:grid-cols-[150px_1fr_100px_130px_130px_90px]">
                    <Form.Item {...field} name={[field.name, "sku"]} label="SKU"><Input /></Form.Item>
                    <Form.Item {...field} name={[field.name, "productName"]} label="商品名称" rules={[{ required: true, message: "请输入商品名称" }]}><Input /></Form.Item>
                    <Form.Item {...field} name={[field.name, "quantity"]} label="数量" rules={[{ required: true, message: "请输入数量" }]}><InputNumber min={1} precision={0} className="!w-full" /></Form.Item>
                    <Form.Item {...field} name={[field.name, "unitPrice"]} label="销售单价" rules={[{ required: true, message: "请输入单价" }]}><InputNumber min={0} precision={2} className="!w-full" /></Form.Item>
                    <Form.Item noStyle shouldUpdate>
                      {() => {
                        const item = quoteForm.getFieldValue(["items", index]) as QuoteItem | undefined;
                        return <Form.Item label="小计"><Input disabled value={moneyText(rowTotal(item), quoteForm.getFieldValue("currency") || "USD")} /></Form.Item>;
                      }}
                    </Form.Item>
                    <Form.Item label="操作">
                      <Button danger disabled={fields.length <= 1} onClick={() => remove(field.name)}>删除</Button>
                    </Form.Item>
                  </div>
                ))}
                <Button type="dashed" block onClick={() => add({ quantity: 1, unitPrice: 0 })}>增加商品行</Button>
              </div>
            )}
          </Form.List>

          <Typography.Title level={5} className="!mt-5">费用与备注</Typography.Title>
          <div className="grid grid-cols-1 gap-x-4 md:grid-cols-5">
            <Form.Item name="shippingFee" label="运费"><InputNumber min={0} precision={2} className="!w-full" /></Form.Item>
            <Form.Item name="discountAmount" label="折扣"><InputNumber min={0} precision={2} className="!w-full" /></Form.Item>
            <Form.Item name="taxAmount" label="税费"><InputNumber min={0} precision={2} className="!w-full" /></Form.Item>
            <Form.Item name="otherFee" label="其他费用"><InputNumber min={0} precision={2} className="!w-full" /></Form.Item>
            <Form.Item name="countryCode" label="国家/地区"><Input placeholder="US" /></Form.Item>
            <Form.Item name="remark" label="报价备注" className="md:col-span-5"><Input.TextArea rows={3} placeholder="例如：报价有效期、付款条件、交期、物流方式等" /></Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
