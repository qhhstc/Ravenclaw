"use client";

import { DownloadOutlined, FileExcelOutlined, ReloadOutlined, SaveOutlined, SearchOutlined, UploadOutlined } from "@ant-design/icons";
import { Button, Card, DatePicker, Form, Select, Space } from "antd";
import dayjs from "dayjs";
import { businessLineOptions, channelTypeOptions } from "@/lib/basic-options";
import type { ChannelDataFilters, ChannelDataOptionState } from "./channelDataTypes";

type ChannelFiltersProps = {
  filters: ChannelDataFilters;
  options: ChannelDataOptionState;
  loading: boolean;
  saving: boolean;
  onSearch: (filters: ChannelDataFilters) => void;
  onReset: () => void;
  onSave: () => void;
  onDownloadTemplate: () => void;
  onImport: () => void;
  onExport: () => void;
};

type FormValues = {
  month: dayjs.Dayjs;
  brandId?: number;
  platformId?: number;
  storeId?: number;
  businessLine?: string;
  channelType?: string;
};

export default function ChannelFilters({
  filters,
  options,
  loading,
  saving,
  onSearch,
  onReset,
  onSave,
  onDownloadTemplate,
  onImport,
  onExport,
}: ChannelFiltersProps) {
  const [form] = Form.useForm<FormValues>();

  function submit(values: FormValues) {
    onSearch({
      year: values.month.year(),
      month: values.month.month() + 1,
      brandId: values.brandId,
      platformId: values.platformId,
      storeId: values.storeId,
      businessLine: values.businessLine,
      channelType: values.channelType,
    });
  }

  return (
    <Card className="mb-4" styles={{ body: { padding: 16 } }}>
      <Form
        form={form}
        layout="inline"
        initialValues={{
          month: dayjs(`${filters.year}-${String(filters.month).padStart(2, "0")}-01`),
          brandId: filters.brandId,
          platformId: filters.platformId,
          storeId: filters.storeId,
          businessLine: filters.businessLine,
          channelType: filters.channelType,
        }}
        onFinish={submit}
        className="gap-y-3"
      >
        <Form.Item name="month" label="月份">
          <DatePicker picker="month" allowClear={false} format="YYYY年M月" style={{ width: 140 }} />
        </Form.Item>
        <Form.Item name="brandId" label="品牌">
          <Select allowClear showSearch optionFilterProp="label" placeholder="全部品牌" options={options.brands} style={{ width: 150 }} />
        </Form.Item>
        <Form.Item name="platformId" label="平台">
          <Select allowClear showSearch optionFilterProp="label" placeholder="全部平台" options={options.platforms} style={{ width: 150 }} />
        </Form.Item>
        <Form.Item name="storeId" label="店铺/站点">
          <Select allowClear showSearch optionFilterProp="label" placeholder="全部店铺" options={options.stores} style={{ width: 170 }} />
        </Form.Item>
        <Form.Item name="businessLine" label="业务线">
          <Select allowClear showSearch optionFilterProp="label" placeholder="全部业务线" options={businessLineOptions} style={{ width: 160 }} />
        </Form.Item>
        <Form.Item name="channelType" label="渠道类型">
          <Select allowClear showSearch optionFilterProp="label" placeholder="全部类型" options={channelTypeOptions} style={{ width: 150 }} />
        </Form.Item>
        <Form.Item>
          <Space wrap>
            <Button type="primary" htmlType="submit" icon={<SearchOutlined />} loading={loading}>
              查询
            </Button>
            <Button icon={<ReloadOutlined />} onClick={() => { form.resetFields(); onReset(); }}>
              重置
            </Button>
            <Button type="primary" ghost icon={<SaveOutlined />} loading={saving} onClick={onSave}>
              保存本月数据
            </Button>
            <Button icon={<FileExcelOutlined />} onClick={onDownloadTemplate}>
              下载导入模板
            </Button>
            <Button icon={<UploadOutlined />} onClick={onImport}>
              导入 Excel
            </Button>
            <Button icon={<DownloadOutlined />} onClick={onExport}>
              导出 Excel
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Card>
  );
}
