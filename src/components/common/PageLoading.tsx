import { Card, Skeleton } from "antd";

export default function PageLoading() {
  return (
    <div className="space-y-4">
      <div>
        <Skeleton.Input active size="large" style={{ width: 220 }} />
        <div className="mt-2">
          <Skeleton.Input active size="small" style={{ width: 360 }} />
        </div>
      </div>
      <Card>
        <Skeleton active paragraph={{ rows: 2 }} />
      </Card>
      <Card>
        <Skeleton active paragraph={{ rows: 8 }} />
      </Card>
    </div>
  );
}
