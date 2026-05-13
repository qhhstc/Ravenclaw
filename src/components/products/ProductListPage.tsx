"use client";

import { DeleteOutlined, DownloadOutlined, EditOutlined, ImportOutlined, PlusOutlined, ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import { Button, Card, Empty, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Table, Tabs, Tag, Typography, message } from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import { useCallback, useEffect, useState } from "react";
import ProductImportModal from "./ProductImportModal";
import VendorManager, { type VendorRecord } from "./VendorManager";

type ProductRecord = {
  id: number;
  sku: string;
  name: string;
  specification?: string | null;
  category?: string | null;
  defaultPurchasePrice: number;
  defaultPackagingCost: number;
  currency: string;
  weight?: number | null;
  volume?: number | null;
  defaultVendorId?: number | null;
  defaultVendor?: { id: number; name: string } | null;
  status: string;
  remark?: string | null;
};

type ListResponse<T> = { items: T[]; total: number; page: number; pageSize: number; message?: string };
type Filters = { keyword?: string; status?: string; category?: string };

function money(value: unknown, currency = "USD") {
  return `${currency} ${Number(value || 0).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function toQuery(filters: Filters, page: number, pageSize: number) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  });
  return params.toString();
}

export default function ProductListPage() {
  const [form] = Form.useForm();
  const [filters, setFilters] = useState<Filters>({});
  const [items, setItems] = useState<ProductRecord[]>([]);
  const [vendors, setVendors] = useState<VendorRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<ProductRecord | null>(null);
  const [currentRole, setCurrentRole] = useState("viewer");

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/products?${toQuery(filters, page, pageSize)}`);
      const data = (await response.json()) as ListResponse<ProductRecord>;
      if (!response.ok) throw new Error(data.message || "产品列表加载失败");
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "产品列表加载失败");
    } finally {
      setLoading(false);
    }
  }, [filters, page, pageSize]);

  const loadVendors = useCallback(async () => {
    try {
      const response = await fetch("/api/vendors?pageSize=100&status=active");
      const data = (await response.json()) as ListResponse<VendorRecord>;
      if (!response.ok) throw new Error(data.message || "供应商加载失败");
      setVendors(data.items ?? []);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "供应商加载失败");
    }
  }, []);

  useEffect(() => {
    queueMicrotask(loadProducts);
  }, [loadProducts]);

  useEffect(() => {
    queueMicrotask(loadVendors);
    queueMicrotask(async () => {
      try {
        const response = await fetch("/api/auth/me");
        const data = (await response.json()) as { user?: { role: string } };
        setCurrentRole(data.user?.role ?? "viewer");
      } catch {
        setCurrentRole("viewer");
      }
    });
  }, [loadVendors]);

  function updateFilter(patch: Filters) {
    setPage(1);
    setFilters((current) => ({ ...current, ...patch }));
  }

  async function saveProduct() {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const response = await fetch(editing ? `/api/products/${editing.id}` : "/api/products", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message || "保存失败");
      message.success(editing ? "产品已更新" : "产品已新增");
      setModalOpen(false);
      setEditing(null);
      form.resetFields();
      await loadProducts();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function deleteProduct(id: number) {
    try {
      const response = await fetch(`/api/products/${id}`, { method: "DELETE" });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message || "删除失败");
      message.success("产品已删除");
      await loadProducts();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "删除失败");
    }
  }

  function filenameFromDisposition(disposition: string | null) {
    const utf8Match = disposition?.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match?.[1]) return decodeURIComponent(utf8Match[1]);
    const fallbackMatch = disposition?.match(/filename="?([^";]+)"?/i);
    return fallbackMatch?.[1] ?? "产品列表.xlsx";
  }

  async function downloadFile(url: string, fallbackName: string) {
    setExporting(true);
    try {
      const response = await fetch(url);
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(data.message || "下载失败");
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filenameFromDisposition(response.headers.get("Content-Disposition")) || fallbackName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } finally {
      setExporting(false);
    }
  }

  async function exportProducts() {
    try {
      await downloadFile(`/api/products/export?${toQuery(filters, page, pageSize)}`, "产品列表.xlsx");
      message.success("产品 Excel 已开始下载");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "导出失败");
    }
  }

  async function downloadTemplate() {
    try {
      await downloadFile("/api/products/import-template", "产品导入模板.xlsx");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "模板下载失败");
    }
  }

  const columns: ColumnsType<ProductRecord> = [
    { title: "SKU", dataIndex: "sku", fixed: "left", width: 170, render: (value) => <span className="font-medium">{value}</span> },
    { title: "产品名称", dataIndex: "name", width: 260 },
    { title: "产品规格", dataIndex: "specification", width: 220, render: (value) => value || "-" },
    { title: "分类", dataIndex: "category", width: 120, render: (value) => value || "-" },
    { title: "默认采购单价", dataIndex: "defaultPurchasePrice", width: 140, align: "right", render: (value, row) => money(value, row.currency) },
    { title: "默认包装成本", dataIndex: "defaultPackagingCost", width: 140, align: "right", render: (value, row) => money(value, row.currency) },
    { title: "币种", dataIndex: "currency", width: 90 },
    { title: "默认供应商", dataIndex: ["defaultVendor", "name"], width: 180, render: (_, row) => row.defaultVendor?.name ?? "-" },
    { title: "重量", dataIndex: "weight", width: 100, align: "right", render: (value) => value ?? "-" },
    { title: "体积", dataIndex: "volume", width: 100, align: "right", render: (value) => value ?? "-" },
    { title: "状态", dataIndex: "status", width: 100, render: (value) => <Tag color={value === "active" ? "green" : "default"}>{value === "active" ? "启用" : "停用"}</Tag> },
    {
      title: "操作",
      key: "actions",
      fixed: "right",
      width: 150,
      render: (_, row) => (
        <Space size={0} className="whitespace-nowrap">
          {["admin", "finance"].includes(currentRole) ? <Button type="link" size="small" icon={<EditOutlined />} onClick={() => { setEditing(row); form.setFieldsValue({ ...row, defaultVendorId: row.defaultVendor?.id ?? row.defaultVendorId }); setModalOpen(true); }}>编辑</Button> : null}
          {["admin", "finance"].includes(currentRole) ? (
            <Popconfirm title="确认删除产品？" onConfirm={() => deleteProduct(row.id)}>
              <Button danger type="link" size="small" icon={<DeleteOutlined />}>删除</Button>
            </Popconfirm>
          ) : null}
        </Space>
      ),
    },
  ];

  const pagination: TablePaginationConfig = {
    current: page,
    pageSize,
    total,
    showSizeChanger: true,
    showTotal: (count) => `共 ${count} 个产品`,
    onChange: (nextPage, nextPageSize) => {
      setPage(nextPage);
      setPageSize(nextPageSize);
    },
  };

  const productList = (
    <>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Typography.Title level={3} className="!mb-1 !text-[#172033]">产品库</Typography.Title>
          <Typography.Text type="secondary">维护 SKU、规格、默认供应商、采购单价和包装成本，为订单利润核算自动带出成本。</Typography.Text>
        </div>
        <Space wrap>
          {["admin", "finance"].includes(currentRole) ? <Button loading={exporting} icon={<DownloadOutlined />} onClick={downloadTemplate}>下载导入模板</Button> : null}
          {["admin", "finance"].includes(currentRole) ? <Button icon={<ImportOutlined />} onClick={() => setImportOpen(true)}>导入 Excel</Button> : null}
          {["admin", "finance"].includes(currentRole) ? <Button loading={exporting} icon={<DownloadOutlined />} onClick={exportProducts}>导出 Excel</Button> : null}
          {["admin", "finance"].includes(currentRole) ? <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); form.setFieldsValue({ currency: "USD", status: "active", defaultPurchasePrice: 0, defaultPackagingCost: 0 }); setModalOpen(true); }}>新增产品</Button> : null}
        </Space>
      </div>

      <Card className="mb-4" styles={{ body: { padding: 16 } }}>
        <Space wrap>
          <Input allowClear prefix={<SearchOutlined />} placeholder="搜索 SKU / 名称 / 规格" value={filters.keyword} style={{ width: 260 }} onChange={(event) => updateFilter({ keyword: event.target.value })} />
          <Select allowClear placeholder="状态" value={filters.status} style={{ width: 120 }} options={[{ label: "启用", value: "active" }, { label: "停用", value: "inactive" }]} onChange={(value) => updateFilter({ status: value })} />
          <Input allowClear placeholder="分类" value={filters.category} style={{ width: 140 }} onChange={(event) => updateFilter({ category: event.target.value })} />
          <Button icon={<ReloadOutlined />} loading={loading} onClick={() => { setPage(1); setFilters({}); }}>重置</Button>
        </Space>
      </Card>

      <Card styles={{ body: { padding: 0 } }}>
        <Table<ProductRecord> rowKey="id" size="middle" loading={loading} columns={columns} dataSource={items} pagination={pagination} scroll={{ x: 1670 }} locale={{ emptyText: <Empty description="暂无产品数据" /> }} />
      </Card>
    </>
  );

  return (
    <div className="max-w-full overflow-hidden">
      <Tabs
        defaultActiveKey="products"
        items={[
          { key: "products", label: "产品列表", children: productList },
          { key: "vendors", label: "供应商管理", children: <VendorManager onChanged={loadVendors} /> },
        ]}
      />

      <Modal title={editing ? "编辑产品" : "新增产品"} open={modalOpen} width={860} confirmLoading={saving} onCancel={() => setModalOpen(false)} onOk={saveProduct} destroyOnHidden>
        <Form form={form} layout="vertical" initialValues={{ currency: "USD", status: "active", defaultPurchasePrice: 0, defaultPackagingCost: 0 }}>
          <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
            <Form.Item name="sku" label="SKU" rules={[{ required: true, message: "请输入 SKU" }]}><Input /></Form.Item>
            <Form.Item name="name" label="产品名称" rules={[{ required: true, message: "请输入产品名称" }]}><Input /></Form.Item>
            <Form.Item name="specification" label="产品规格"><Input /></Form.Item>
            <Form.Item name="category" label="分类"><Input /></Form.Item>
            <Form.Item name="defaultVendorId" label="默认供应商"><Select allowClear showSearch optionFilterProp="label" options={vendors.map((vendor) => ({ label: vendor.name, value: vendor.id }))} /></Form.Item>
            <Form.Item name="currency" label="币种"><Select options={["USD", "CNY", "JPY", "EUR", "GBP"].map((value) => ({ label: value, value }))} /></Form.Item>
            <Form.Item name="defaultPurchasePrice" label="默认采购单价"><InputNumber min={0} precision={2} className="!w-full" /></Form.Item>
            <Form.Item name="defaultPackagingCost" label="默认包装成本"><InputNumber min={0} precision={2} className="!w-full" /></Form.Item>
            <Form.Item name="weight" label="重量"><InputNumber min={0} precision={3} className="!w-full" /></Form.Item>
            <Form.Item name="volume" label="体积"><InputNumber min={0} precision={3} className="!w-full" /></Form.Item>
            <Form.Item name="status" label="状态"><Select options={[{ label: "启用", value: "active" }, { label: "停用", value: "inactive" }]} /></Form.Item>
            <Form.Item name="remark" label="备注" className="md:col-span-2"><Input.TextArea rows={3} /></Form.Item>
          </div>
        </Form>
      </Modal>

      <ProductImportModal open={importOpen} onCancel={() => setImportOpen(false)} onImported={() => { setImportOpen(false); void loadProducts(); }} />
    </div>
  );
}
