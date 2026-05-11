import type { ColumnsType } from "antd/es/table";

export type BasicRecord = {
  id: number;
  status?: "active" | "inactive";
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
};

export type SelectOption = {
  label: string;
  value: string | number;
};

export type BasicOptionState = {
  brands: SelectOption[];
  platforms: SelectOption[];
  stores: SelectOption[];
  countries: SelectOption[];
  currencies: SelectOption[];
};

export type BasicFieldConfig = {
  name: string;
  label: string;
  type?: "input" | "textarea" | "select" | "number" | "date";
  required?: boolean;
  options?: SelectOption[];
  placeholder?: string;
  span?: 1 | 2;
};

export type ExtraFilterConfig = {
  name: string;
  placeholder: string;
  options: SelectOption[];
};

export type BasicManagerConfig<T extends BasicRecord = BasicRecord> = {
  title: string;
  description: string;
  resourcePath: string;
  rowKey?: string;
  searchPlaceholder?: string;
  columns: ColumnsType<T>;
  fields: BasicFieldConfig[];
  extraFilters?: ExtraFilterConfig[];
  initialValues?: Record<string, unknown>;
};
