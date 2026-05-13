"use client";

import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import {
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Table,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { useCallback, useEffect, useMemo, useState } from "react";
import { statusOptions } from "@/lib/basic-options";
import type { BasicFieldConfig, BasicManagerConfig, BasicRecord } from "./types";

type ListResponse<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

type BasicResourceManagerProps<T extends BasicRecord> = {
  config: BasicManagerConfig<T>;
};

function serializeValues(values: Record<string, unknown>, fields: BasicFieldConfig[]) {
  return fields.reduce<Record<string, unknown>>((result, field) => {
    const value = values[field.name];
    if (field.type === "date" && value && typeof value === "object" && "format" in value) {
      result[field.name] = (value as dayjs.Dayjs).format("YYYY-MM-DD");
    } else {
      result[field.name] = value === undefined ? null : value;
    }
    return result;
  }, {});
}

function normalizeEditValues(record: BasicRecord, fields: BasicFieldConfig[]) {
  return fields.reduce<Record<string, unknown>>((result, field) => {
    const value = record[field.name];
    result[field.name] = field.type === "date" && value ? dayjs(String(value)) : value;
    return result;
  }, {});
}

function renderFormItem(field: BasicFieldConfig) {
  const commonProps = {
    placeholder: field.placeholder ?? `请输入${field.label}`,
    allowClear: true,
  };

  if (field.type === "textarea") {
    return <Input.TextArea rows={3} {...commonProps} />;
  }

  if (field.type === "select") {
    return <Select showSearch optionFilterProp="label" options={field.options} {...commonProps} />;
  }

  if (field.type === "number") {
    return <InputNumber className="w-full" min={0} precision={field.name === "rate" ? 6 : 0} />;
  }

  if (field.type === "date") {
    return <DatePicker className="w-full" />;
  }

  return <Input {...commonProps} />;
}

export default function BasicResourceManager<T extends BasicRecord>({ config }: BasicResourceManagerProps<T>) {
  const [form] = Form.useForm();
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState<string | undefined>();
  const [extraFilterValues, setExtraFilterValues] = useState<Record<string, string | number | undefined>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<T | null>(null);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (keyword.trim()) params.set("keyword", keyword.trim());
      if (status) params.set("status", status);
      Object.entries(extraFilterValues).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          params.set(key, String(value));
        }
      });

      const response = await fetch(`${config.resourcePath}?${params.toString()}`);
      const data = (await response.json()) as ListResponse<T> & { message?: string };
      if (!response.ok) {
        throw new Error(data.message || "获取数据失败");
      }
      setItems(data.items);
      setTotal(data.total);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "获取数据失败");
    } finally {
      setLoading(false);
    }
  }, [config.resourcePath, extraFilterValues, keyword, page, pageSize, status]);

  useEffect(() => {
    queueMicrotask(fetchList);
  }, [fetchList]);

  const columns = useMemo<ColumnsType<T>>(
    () => [
      ...config.columns,
      {
        title: "操作",
        key: "actions",
        fixed: "right",
        width: 190,
        render: (_, record) => {
          const nextStatus = record.status === "active" ? "inactive" : "active";
          return (
            <Space size={8}>
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                onClick={() => {
                  setEditingRecord(record);
                  form.setFieldsValue(normalizeEditValues(record, config.fields));
                  setModalOpen(true);
                }}
              >
                编辑
              </Button>
              {record.status ? (
                <Button
                  type="link"
                  size="small"
                  onClick={async () => {
                    try {
                      const response = await fetch(`${config.resourcePath}/${record.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ status: nextStatus }),
                      });
                      const data = await response.json();
                      if (!response.ok) throw new Error(data.message || "状态更新失败");
                      message.success(nextStatus === "active" ? "已启用" : "已停用");
                      fetchList();
                    } catch (error) {
                      message.error(error instanceof Error ? error.message : "状态更新失败");
                    }
                  }}
                >
                  {nextStatus === "active" ? "启用" : "停用"}
                </Button>
              ) : null}
              <Popconfirm
                title="确认删除这条数据？"
                description="删除后不可恢复。"
                okText="删除"
                cancelText="取消"
                onConfirm={async () => {
                  try {
                    const response = await fetch(`${config.resourcePath}/${record.id}`, { method: "DELETE" });
                    const data = await response.json();
                    if (!response.ok) throw new Error(data.message || "删除失败");
                    message.success("删除成功");
                    fetchList();
                  } catch (error) {
                    message.error(error instanceof Error ? error.message : "删除失败");
                  }
                }}
              >
                <Button danger type="link" size="small" icon={<DeleteOutlined />}>
                  删除
                </Button>
              </Popconfirm>
            </Space>
          );
        },
      },
    ],
    [config.columns, config.fields, config.resourcePath, fetchList, form],
  );

  async function handleSubmit() {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const payload = {
        ...config.initialValues,
        ...serializeValues(values, config.fields),
      };
      const response = await fetch(
        editingRecord ? `${config.resourcePath}/${editingRecord.id}` : config.resourcePath,
        {
          method: editingRecord ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "保存失败");
      message.success(editingRecord ? "编辑成功" : "新增成功");
      setModalOpen(false);
      setEditingRecord(null);
      form.resetFields();
      fetchList();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Typography.Title level={4} className="!mb-1">
            {config.title}
          </Typography.Title>
          <Typography.Text type="secondary">{config.description}</Typography.Text>
        </div>
        <Space wrap>
          {config.extraActions?.({ refresh: fetchList, loading })}
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingRecord(null);
              form.resetFields();
              form.setFieldsValue(config.initialValues ?? { status: "active" });
              setModalOpen(true);
            }}
          >
            新增
          </Button>
        </Space>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Input.Search
          allowClear
          placeholder={config.searchPlaceholder ?? "搜索名称/code"}
          style={{ width: 260 }}
          onSearch={(value) => {
            setKeyword(value);
            setPage(1);
          }}
        />
        <Select
          allowClear
          placeholder="状态"
          style={{ width: 140 }}
          options={statusOptions}
          value={status}
          onChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
        />
        {config.extraFilters?.map((filter) => (
          <Select
            key={filter.name}
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder={filter.placeholder}
            style={{ width: 160 }}
            options={filter.options}
            value={extraFilterValues[filter.name]}
            onChange={(value) => {
              setExtraFilterValues((current) => ({ ...current, [filter.name]: value }));
              setPage(1);
            }}
          />
        ))}
        <Button icon={<ReloadOutlined />} loading={loading} onClick={fetchList}>
          刷新
        </Button>
      </div>

      <Table<T>
        rowKey={(record) => String(record[config.rowKey ?? "id"])}
        columns={columns}
        dataSource={items}
        loading={loading}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" /> }}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showTotal: (value) => `共 ${value} 条`,
          onChange: (nextPage, nextPageSize) => {
            setPage(nextPage);
            setPageSize(nextPageSize);
          },
        }}
        scroll={{ x: "max-content" }}
      />

      <Modal
        title={editingRecord ? `编辑${config.title}` : `新增${config.title}`}
        open={modalOpen}
        width={720}
        onCancel={() => {
          setModalOpen(false);
          setEditingRecord(null);
        }}
        onOk={handleSubmit}
        confirmLoading={saving}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" initialValues={config.initialValues ?? { status: "active" }}>
          <Row gutter={16}>
            {config.fields.map((field) => (
              <Col span={field.span === 2 ? 24 : 12} key={field.name}>
                <Form.Item
                  name={field.name}
                  label={field.label}
                  rules={field.required ? [{ required: true, message: `请填写${field.label}` }] : undefined}
                >
                  {renderFormItem(field)}
                </Form.Item>
              </Col>
            ))}
          </Row>
        </Form>
      </Modal>
    </Card>
  );
}
