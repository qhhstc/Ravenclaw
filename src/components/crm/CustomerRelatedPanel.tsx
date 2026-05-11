import { Card, Col, Row, Typography } from "antd";

const items = ["询盘记录", "报价记录", "订单记录", "收款记录"];

export default function CustomerRelatedPanel() {
  return (
    <Row gutter={[16, 16]}>
      {items.map((title) => (
        <Col xs={24} md={12} key={title}>
          <Card>
            <Typography.Title level={5} className="!mb-1">{title}</Typography.Title>
            <Typography.Text type="secondary">后续接入</Typography.Text>
          </Card>
        </Col>
      ))}
    </Row>
  );
}
