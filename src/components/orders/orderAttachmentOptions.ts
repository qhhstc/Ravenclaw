export const attachmentTypeOptions = [
  { label: "提单", value: "bill_of_lading" },
  { label: "装箱单", value: "packing_list" },
  { label: "报关单", value: "customs_declaration" },
  { label: "物流单", value: "logistics_doc" },
  { label: "付款凭证", value: "payment_proof" },
  { label: "聊天记录", value: "chat_record" },
  { label: "其他", value: "other" },
];

export function attachmentTypeLabel(value?: string | null) {
  return attachmentTypeOptions.find((item) => item.value === value)?.label ?? value ?? "-";
}

export function fileSizeText(size: number) {
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  if (size >= 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${size} B`;
}

export type AttachmentRecord = {
  id: number;
  fileName: string;
  fileUrl: string;
  fileType?: string | null;
  fileSize: number;
  attachmentType: string;
  createdAt: string;
  uploader?: { id: number; name: string; email: string } | null;
};
