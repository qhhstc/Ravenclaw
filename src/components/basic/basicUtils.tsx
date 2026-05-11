import { Tag } from "antd";
import dayjs from "dayjs";

export function formatDateTime(value?: string | Date | null) {
  if (!value) return "-";
  return dayjs(value).format("YYYY-MM-DD HH:mm");
}

export function formatDate(value?: string | Date | null) {
  if (!value) return "-";
  return dayjs(value).format("YYYY-MM-DD");
}

export function StatusTag({ status }: { status?: string }) {
  return status === "active" ? <Tag color="green">启用</Tag> : <Tag color="default">停用</Tag>;
}
