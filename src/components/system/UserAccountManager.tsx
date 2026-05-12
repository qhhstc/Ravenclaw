"use client";

import { EditOutlined, PlusOutlined, ReloadOutlined, SearchOutlined, StopOutlined, CheckCircleOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Empty, Form, Input, Modal, Popconfirm, Select, Space, Table, Tag, Typography, message } from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import { useCallback, useEffect, useState } from "react";

type UserRecord = {
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type ListResponse<T> = { items: T[]; total: number; page: number; pageSize: number; message?: string };
type Filters = { keyword?: string; role?: string; status?: string };

const roleOptions = [
  { label: "管理员", value: "admin", color: "red" },
  { label: "业务员", value: "sales", color: "blue" },
  { label: "财务", value: "finance", color: "cyan" },
  { label: "只读", value: "viewer", color: "default" },
];

const statusOptions = [
  { label: "启用", value: "active", color: "green" },
  { label: "停用", value: "inactive", color: "default" },
];

function optionLabel(options: Array<{ label: string; value: string; color: string }>, value: string) {
  return options.find((item) => item.value === value)?.label ?? value;
}

function optionColor(options: Array<{ label: string; value: string; color: string }>, value: string) {
  return options.find((item) => item.value === value)?.color ?? "default";
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

function toQuery(filters: Filters, page: number, pageSize: number) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  });
  return params.toString();
}

export default function UserAccountManager() {
  const [form] = Form.useForm();
  const [filters, setFilters] = useState<Filters>({});
  const [items, setItems] = useState<UserRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<UserRecord | null>(null);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/system/users?${toQuery(filters, page, pageSize)}`);
      const data = (await response.json()) as ListResponse<UserRecord>;
      if (!response.ok) throw new Error(data.message || "账号列表加载失败");
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "账号列表加载失败");
    } finally {
      setLoading(false);
    }
  }, [filters, page, pageSize]);

  useEffect(() => {
    queueMicrotask(loadUsers);
  }, [loadUsers]);

  useEffect(() => {
    queueMicrotask(async () => {
      try {
        const response = await fetch("/api/auth/me");
        const data = (await response.json()) as { user?: { userId: number } };
        setCurrentUserId(data.user?.userId ?? null);
      } catch {
        setCurrentUserId(null);
      }
    });
  }, []);

  function updateFilter(patch: Filters) {
    setPage(1);
    setFilters((current) => ({ ...current, ...patch }));
  }

  function openCreateModal() {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ role: "sales", status: "active" });
    setModalOpen(true);
  }

  function openEditModal(record: UserRecord) {
    setEditing(record);
    form.resetFields();
    form.setFieldsValue({ ...record, password: "" });
    setModalOpen(true);
  }

  async function saveUser() {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const response = await fetch(editing ? `/api/system/users/${editing.id}` : "/api/system/users", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message || "保存失败");
      message.success(editing ? "账号已更新" : "账号已创建");
      setModalOpen(false);
      setEditing(null);
      form.resetFields();
      await loadUsers();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function setUserStatus(record: UserRecord, status: "active" | "inactive") {
    try {
      const response = await fetch(`/api/system/users/${record.id}`, {
        method: status === "inactive" ? "DELETE" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: status === "inactive" ? undefined : JSON.stringify({ ...record, status: "active", password: "" }),
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message || "操作失败");
      message.success(status === "active" ? "账号已启用" : "账号已停用");
      await loadUsers();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "操作失败");
    }
  }

  const columns: ColumnsType<UserRecord> = [
    { title: "姓名", dataIndex: "name", fixed: "left", width: 150, render: (value) => <span className="font-medium">{value}</span> },
    { title: "邮箱", dataIndex: "email", width: 240 },
    {
      title: "角色",
      dataIndex: "role",
      width: 130,
      render: (value) => <Tag color={optionColor(roleOptions, value)}>{optionLabel(roleOptions, value)}</Tag>,
    },
    {
      title: "状态",
      dataIndex: "status",
      width: 100,
      render: (value) => <Tag color={optionColor(statusOptions, value)}>{optionLabel(statusOptions, value)}</Tag>,
    },
    { title: "创建时间", dataIndex: "createdAt", width: 180, render: formatDateTime },
    { title: "更新时间", dataIndex: "updatedAt", width: 180, render: formatDateTime },
    {
      title: "操作",
      key: "actions",
      fixed: "right",
      width: 210,
      render: (_, record) => (
        <Space size={0} className="whitespace-nowrap">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEditModal(record)}>
            编辑
          </Button>
          {record.id === currentUserId ? (
            <Typography.Text type="secondary" className="px-2 text-xs">
              当前账号
            </Typography.Text>
          ) : record.status === "active" ? (
            <Popconfirm title="确认停用该账号？" description="停用后该账号将无法登录。" onConfirm={() => setUserStatus(record, "inactive")}>
              <Button danger type="link" size="small" icon={<StopOutlined />}>
                停用
              </Button>
            </Popconfirm>
          ) : (
            <Popconfirm title="确认启用该账号？" onConfirm={() => setUserStatus(record, "active")}>
              <Button type="link" size="small" icon={<CheckCircleOutlined />}>
                启用
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const pagination: TablePaginationConfig = {
    current: page,
    pageSize,
    total,
    showSizeChanger: true,
    showTotal: (value) => `共 ${value} 个账号`,
    onChange: (nextPage, nextPageSize) => {
      setPage(nextPage);
      setPageSize(nextPageSize);
    },
  };

  return (
    <div className="space-y-4">
      <Card styles={{ body: { padding: 20 } }}>
        <div className="mb-1 flex flex-wrap items-start justify-between gap-4">
          <div>
            <Typography.Title level={4} className="!mb-1">
              账号管理
            </Typography.Title>
            <Typography.Text type="secondary">维护管理员、业务员、财务和只读账号；停用账号后将无法登录。</Typography.Text>
          </div>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
            新增账号
          </Button>
        </div>
      </Card>

      <Card styles={{ body: { padding: 16 } }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Space wrap>
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="搜索姓名 / 邮箱"
              value={filters.keyword}
              style={{ width: 260 }}
              onChange={(event) => updateFilter({ keyword: event.target.value || undefined })}
            />
            <Select allowClear placeholder="角色" value={filters.role} style={{ width: 150 }} options={roleOptions.map(({ label, value }) => ({ label, value }))} onChange={(value) => updateFilter({ role: value })} />
            <Select allowClear placeholder="状态" value={filters.status} style={{ width: 120 }} options={statusOptions.map(({ label, value }) => ({ label, value }))} onChange={(value) => updateFilter({ status: value })} />
            <Button icon={<ReloadOutlined />} onClick={() => { setFilters({}); setPage(1); }}>
              重置
            </Button>
          </Space>
        </div>
      </Card>

      <Card styles={{ body: { padding: 0 } }}>
        <Table<UserRecord>
          rowKey="id"
          size="middle"
          loading={loading}
          columns={columns}
          dataSource={items}
          pagination={pagination}
          scroll={{ x: 1190 }}
          locale={{ emptyText: <Empty description="暂无账号" /> }}
        />
      </Card>

      <Alert
        type="info"
        showIcon
        message="权限说明"
        description="管理员可管理账号；业务员只能查看和录入自己的订单；财务可查看利润并维护成本；只读账号只能查看数据。账号权限同时由后端接口校验。"
      />

      <Modal
        title={editing ? "编辑账号" : "新增账号"}
        open={modalOpen}
        width={680}
        confirmLoading={saving}
        onCancel={() => setModalOpen(false)}
        onOk={saveUser}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" initialValues={{ role: "sales", status: "active" }}>
          <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
            <Form.Item name="name" label="姓名" rules={[{ required: true, message: "请输入姓名" }]}>
              <Input allowClear placeholder="如 Sales 1" />
            </Form.Item>
            <Form.Item name="email" label="邮箱" rules={[{ required: true, message: "请输入邮箱" }, { type: "email", message: "邮箱格式不正确" }]}>
              <Input allowClear placeholder="name@example.com" />
            </Form.Item>
            <Form.Item name="role" label="角色" rules={[{ required: true, message: "请选择角色" }]}>
              <Select disabled={editing?.id === currentUserId} options={roleOptions.map(({ label, value }) => ({ label, value }))} />
            </Form.Item>
            <Form.Item name="status" label="状态" rules={[{ required: true, message: "请选择状态" }]}>
              <Select disabled={editing?.id === currentUserId} options={statusOptions.map(({ label, value }) => ({ label, value }))} />
            </Form.Item>
            <Form.Item
              name="password"
              label={editing ? "重置密码" : "初始密码"}
              className="md:col-span-2"
              extra={editing ? "编辑账号时留空表示不修改密码。" : undefined}
              rules={editing ? [{ min: 6, message: "密码至少 6 位" }] : [{ required: true, message: "请输入初始密码" }, { min: 6, message: "密码至少 6 位" }]}
            >
              <Input.Password allowClear placeholder={editing ? "留空则不修改" : "至少 6 位"} autoComplete="new-password" />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
