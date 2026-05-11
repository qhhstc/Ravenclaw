"use client";

import { Card, Empty, Typography } from "antd";

type ModulePlaceholderProps = {
  title: string;
  description?: string;
};

export default function ModulePlaceholder({ title, description }: ModulePlaceholderProps) {
  return (
    <Card>
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <div>
            <Typography.Title level={4} className="!mb-2">
              {title}
            </Typography.Title>
            <Typography.Text type="secondary">{description ?? "模块开发中"}</Typography.Text>
          </div>
        }
      />
    </Card>
  );
}
