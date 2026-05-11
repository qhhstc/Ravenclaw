"use client";

import { DatePicker, Form, Input, Modal, Select } from "antd";
import dayjs from "dayjs";
import { channelLabel, customerLevelOptions, customerStatusOptions, customerTypeOptions, type CrmBrand, type CrmChannel, type CrmCountry, type CrmUser, type CustomerRecord } from "./crmOptions";

type Props = {
  open: boolean;
  saving: boolean;
  editing?: CustomerRecord | null;
  brands: CrmBrand[];
  countries: CrmCountry[];
  channels: CrmChannel[];
  users: CrmUser[];
  onCancel: () => void;
  onSubmit: (values: Record<string, unknown>) => Promise<void> | void;
};

export function customerToFormValues(customer?: CustomerRecord | null) {
  if (!customer) return { customerType: "company", level: "C", status: "new", tags: [] };
  return {
    ...customer,
    tags: Array.isArray(customer.tags) ? customer.tags : [],
    nextFollowupAt: customer.nextFollowupAt ? dayjs(customer.nextFollowupAt) : null,
  };
}

export function serializeCustomerForm(values: Record<string, unknown>) {
  return {
    ...values,
    nextFollowupAt: values.nextFollowupAt && typeof values.nextFollowupAt === "object" && "toISOString" in values.nextFollowupAt ? (values.nextFollowupAt as dayjs.Dayjs).toISOString() : null,
  };
}

export default function CustomerFormModal({ open, saving, editing, brands, countries, channels, users, onCancel, onSubmit }: Props) {
  const [form] = Form.useForm();

  return (
    <Modal
      title={editing ? "编辑客户" : "新增客户"}
      open={open}
      width={880}
      okText="保存"
      cancelText="取消"
      confirmLoading={saving}
      onCancel={onCancel}
      destroyOnHidden
      afterOpenChange={(visible) => {
        if (visible) form.setFieldsValue(customerToFormValues(editing));
      }}
      onOk={async () => {
        const values = await form.validateFields();
        await onSubmit(serializeCustomerForm(values));
      }}
    >
      <Form form={form} layout="vertical" initialValues={customerToFormValues(editing)}>
        <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
          <Form.Item name="name" label="客户名称" rules={[{ required: true, message: "请输入客户名称" }]}><Input allowClear /></Form.Item>
          <Form.Item name="companyName" label="公司名称"><Input allowClear /></Form.Item>
          <Form.Item name="customerType" label="客户类型" rules={[{ required: true }]}><Select options={customerTypeOptions} /></Form.Item>
          <Form.Item name="countryCode" label="国家/地区"><Select allowClear showSearch optionFilterProp="label" options={countries.map((item) => ({ label: `${item.name} (${item.code})`, value: item.code }))} /></Form.Item>
          <Form.Item name="email" label="邮箱" rules={[{ type: "email", message: "邮箱格式不正确" }]}><Input allowClear /></Form.Item>
          <Form.Item name="phone" label="电话"><Input allowClear /></Form.Item>
          <Form.Item name="whatsapp" label="WhatsApp"><Input allowClear /></Form.Item>
          <Form.Item name="website" label="网站"><Input allowClear /></Form.Item>
          <Form.Item name="brandId" label="所属品牌"><Select allowClear showSearch optionFilterProp="label" options={brands.map((item) => ({ label: item.name, value: item.id }))} /></Form.Item>
          <Form.Item name="sourceChannelId" label="来源渠道"><Select allowClear showSearch optionFilterProp="label" options={channels.map((item) => ({ label: channelLabel(item), value: item.id }))} /></Form.Item>
          <Form.Item name="ownerId" label="负责人"><Select allowClear showSearch optionFilterProp="label" options={users.map((item) => ({ label: item.name, value: item.id }))} /></Form.Item>
          <Form.Item name="level" label="客户等级" rules={[{ required: true }]}><Select options={customerLevelOptions.map(({ label, value }) => ({ label, value }))} /></Form.Item>
          <Form.Item name="status" label="客户状态" rules={[{ required: true }]}><Select options={customerStatusOptions.map(({ label, value }) => ({ label, value }))} /></Form.Item>
          <Form.Item name="nextFollowupAt" label="下次跟进时间"><DatePicker showTime className="w-full" /></Form.Item>
          <Form.Item name="tags" label="标签" className="md:col-span-2"><Select mode="tags" tokenSeparators={[",", "，"]} placeholder="输入后回车添加标签" /></Form.Item>
          <Form.Item name="remark" label="备注" className="md:col-span-2"><Input.TextArea rows={3} /></Form.Item>
        </div>
      </Form>
    </Modal>
  );
}
