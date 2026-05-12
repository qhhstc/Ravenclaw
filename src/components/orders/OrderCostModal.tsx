"use client";

import { Form, Modal } from "antd";
import OrderCostEditor, { buildCostRows } from "./OrderCostEditor";
import type { OrderRecord } from "./orderOptions";

type Props = {
  open: boolean;
  saving: boolean;
  order: OrderRecord;
  onCancel: () => void;
  onSubmit: (values: { costs: Record<string, unknown>[] }) => Promise<void> | void;
};

export default function OrderCostModal({ open, saving, order, onCancel, onSubmit }: Props) {
  const [form] = Form.useForm();
  return (
    <Modal
      title={`编辑成本分项 ${order.orderNo}`}
      open={open}
      width={980}
      okText="保存成本"
      cancelText="取消"
      confirmLoading={saving}
      onCancel={onCancel}
      destroyOnHidden
      afterOpenChange={(visible) => {
        if (visible) form.setFieldsValue({ items: order.items ?? [], costs: order.costs ?? [] });
      }}
      onOk={async () => {
        const values = await form.validateFields();
        await onSubmit({ ...values, costs: buildCostRows(form, order.currency) });
      }}
    >
      <Form form={form} layout="vertical" initialValues={{ items: order.items ?? [], costs: order.costs ?? [] }}>
        <OrderCostEditor form={form} currency={order.currency} />
      </Form>
    </Modal>
  );
}
