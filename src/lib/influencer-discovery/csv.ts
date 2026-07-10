// 候选红人 CSV 解析与校验 —— preview 与 confirm 两阶段共用同一套函数
// 支持:UTF-8 BOM 剥离、空行跳过、双引号包裹字段、字段内逗号。
// 不支持:字段内换行(跨行引号)——遇到时给出明确行号错误提示。

import { CANDIDATE_PLATFORMS } from "./types";

// 归一化后的候选红人数据(写库前的中间结构,数值已转 number)
export type ParsedCandidate = {
  platform: string | null;
  handle: string | null;
  displayName: string | null;
  profileUrl: string | null;
  email: string | null;
  country: string | null;
  followers: number | null;
  avgViews: number | null;
  engagementRate: number | null;
  nicheTags: string[];
};

export type CandidateCsvRow = {
  rowNumber: number; // 对应 CSV 数据行号(表头为第 1 行,首条数据为第 2 行)
  valid: boolean;
  errors: string[];
  summary: string; // 原始数据摘要(供前端错误展示)
  data: ParsedCandidate | null;
};

export type CandidateCsvResult = {
  totalRows: number;
  successRows: number;
  failedRows: number;
  rows: CandidateCsvRow[];
};

// 支持的表头(大小写不敏感,可用中文或英文列名)
const HEADER_MAP: Record<string, keyof ParsedCandidate> = {
  platform: "platform",
  平台: "platform",
  handle: "handle",
  账号: "handle",
  displayname: "displayName",
  display_name: "displayName",
  名称: "displayName",
  昵称: "displayName",
  profileurl: "profileUrl",
  profile_url: "profileUrl",
  url: "profileUrl",
  主页: "profileUrl",
  主页链接: "profileUrl",
  email: "email",
  邮箱: "email",
  country: "country",
  国家: "country",
  followers: "followers",
  粉丝: "followers",
  粉丝数: "followers",
  avgviews: "avgViews",
  avg_views: "avgViews",
  均播: "avgViews",
  平均播放: "avgViews",
  engagementrate: "engagementRate",
  engagement_rate: "engagementRate",
  互动率: "engagementRate",
  nichetags: "nicheTags",
  niche_tags: "nicheTags",
  标签: "nicheTags",
};

const PLATFORM_LOOKUP = new Map(CANDIDATE_PLATFORMS.map((p) => [p.toLowerCase(), p]));

function stripBom(text: string) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

// 解析单行 CSV(处理双引号包裹与字段内逗号)。
// 返回 null 表示遇到不支持的字段内换行(未闭合引号)。
function parseCsvLine(line: string): string[] | null {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"'; // 转义的双引号 ""
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  if (inQuotes) return null; // 引号未闭合 —— 字段内换行,不支持
  fields.push(current);
  return fields.map((f) => f.trim());
}

function toOptionalInt(value: string): number | null {
  if (!value) return null;
  const numeric = Number(value.replace(/,/g, ""));
  return Number.isFinite(numeric) && numeric >= 0 ? Math.floor(numeric) : null;
}

// 互动率:接受 "3.5%" 或 "3.5" 或 "0.035",统一归一化为百分数值(3.5 表示 3.5%)
function toEngagementRate(value: string): number | null {
  if (!value) return null;
  const hasPercent = value.includes("%");
  const numeric = Number(value.replace(/%/g, "").trim());
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  // 无百分号且 <=1 视为小数比例(0.035 → 3.5)
  const rate = !hasPercent && numeric <= 1 ? numeric * 100 : numeric;
  return Number(rate.toFixed(4));
}

function normalizePlatform(value: string): string | null {
  if (!value) return null;
  return PLATFORM_LOOKUP.get(value.toLowerCase()) ?? value;
}

/**
 * 解析并校验候选红人 CSV。preview 与 confirm 都调用此函数,
 * confirm 端据此重新解析原始文本、绝不信任前端回传的行。
 */
export function parseCandidateCsv(rawText: string): CandidateCsvResult {
  const text = stripBom(rawText).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const allLines = text.split("\n");

  // 找到第一条非空行作为表头
  const headerLineIndex = allLines.findIndex((line) => line.trim() !== "");
  if (headerLineIndex < 0) {
    return { totalRows: 0, successRows: 0, failedRows: 0, rows: [] };
  }

  const headerFields = parseCsvLine(allLines[headerLineIndex]);
  if (!headerFields) {
    throw new Error("CSV 表头解析失败:检测到未闭合的双引号(暂不支持字段内换行)");
  }
  const columns = headerFields.map((h) => HEADER_MAP[h.toLowerCase().replace(/\s+/g, "")] ?? null);
  if (!columns.some((c) => c === "platform" || c === "handle" || c === "profileUrl")) {
    throw new Error("CSV 缺少必要列:至少需要 platform、handle 或 profileUrl 之一(支持中英文列名)");
  }

  const rows: CandidateCsvRow[] = [];
  let dataRowNumber = 1; // 数据行序号(不含表头)

  for (let i = headerLineIndex + 1; i < allLines.length; i += 1) {
    const line = allLines[i];
    if (line.trim() === "") continue; // 跳过空行

    dataRowNumber += 1;
    const rowNumber = dataRowNumber;
    const errors: string[] = [];
    const fields = parseCsvLine(line);

    if (!fields) {
      rows.push({
        rowNumber,
        valid: false,
        errors: [`第 ${rowNumber} 行存在未闭合的双引号(字段内换行暂不支持),请修正后重试`],
        summary: line.slice(0, 120),
        data: null,
      });
      continue;
    }

    const raw: Record<keyof ParsedCandidate, string> = {
      platform: "",
      handle: "",
      displayName: "",
      profileUrl: "",
      email: "",
      country: "",
      followers: "",
      avgViews: "",
      engagementRate: "",
      nicheTags: "",
    };
    columns.forEach((col, index) => {
      if (col) raw[col] = fields[index] ?? "";
    });

    const platform = normalizePlatform(raw.platform);
    const handle = raw.handle || null;
    const profileUrl = raw.profileUrl || null;
    const email = raw.email || null;

    // 校验:必须有能定位到具体红人的标识(账号/主页/名称),仅有平台名不足以定位
    if (!handle && !profileUrl && !raw.displayName) {
      errors.push("handle、profileUrl、displayName 至少填写一项(仅有平台无法定位红人)");
    }
    if (profileUrl && !/^https?:\/\//i.test(profileUrl)) {
      errors.push("profileUrl 必须以 http:// 或 https:// 开头");
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push("email 格式不正确");
    }

    const data: ParsedCandidate = {
      platform,
      handle,
      displayName: raw.displayName || null,
      profileUrl,
      email,
      country: raw.country ? raw.country.toUpperCase() : null,
      followers: toOptionalInt(raw.followers),
      avgViews: toOptionalInt(raw.avgViews),
      engagementRate: toEngagementRate(raw.engagementRate),
      nicheTags: raw.nicheTags
        ? raw.nicheTags
            .split(/[;、|]/)
            .map((t) => t.trim())
            .filter(Boolean)
        : [],
    };

    rows.push({
      rowNumber,
      valid: errors.length === 0,
      errors,
      summary: [platform, handle || profileUrl, raw.followers ? `${raw.followers}粉` : ""].filter(Boolean).join(" / "),
      data: errors.length === 0 ? data : null,
    });
  }

  return {
    totalRows: rows.length,
    successRows: rows.filter((r) => r.valid).length,
    failedRows: rows.filter((r) => !r.valid).length,
    rows,
  };
}
