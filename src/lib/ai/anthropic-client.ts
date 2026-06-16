import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { aiSystemPrompt, buildBusinessBlocksAnalysisPrompt, buildChannelAnalysisPrompt, buildCompanyReviewPrompt, companyReviewSchemaHint, type AiAnalysisResult, type BusinessBlockAnalysisPromptInput, type ChannelAnalysisPromptInput, type CompanyReviewPromptInput, type CompanyReviewResult } from "./prompts";

export type AiConfigStatus = {
  enabled: boolean;
  provider: string;
  baseUrlConfigured: boolean;
  tokenConfigured: boolean;
  apiKeyConfigured: boolean;
  modelConfigured: boolean;
  authMode: string;
  apiEndpoint: string;
};

export type CallClaudeJsonInput = {
  systemPrompt: string;
  userPrompt: string;
  schemaHint?: string;
  maxTokens?: number;
};

// 当前生效的模型名,供路由记录到分析结果(可追溯哪条结论由哪个模型产出)
export function getAiModelName() {
  return envValue("ANTHROPIC_MODEL");
}

type ClaudeCompatibleResponse = {
  content?: Array<{ type?: string; text?: string }>;
  choices?: Array<{ message?: { content?: string }; text?: string }>;
  error?: { message?: string };
  message?: string;
};

export class AiConfigError extends Error {
  status = 400;
}

export class AiParseError extends Error {
  status = 502;
}

function envValue(key: string) {
  return process.env[key]?.trim() || "";
}

export function getAiStatus(): AiConfigStatus {
  const authToken = envValue("ANTHROPIC_AUTH_TOKEN");
  const apiKey = envValue("ANTHROPIC_API_KEY");
  const apiEndpoint = envValue("AI_API_ENDPOINT") || "/v1/messages";
  return {
    enabled: envValue("AI_ANALYSIS_ENABLED") === "true",
    provider: envValue("AI_PROVIDER") || "anthropic_compatible",
    baseUrlConfigured: Boolean(envValue("ANTHROPIC_BASE_URL")),
    tokenConfigured: Boolean(authToken),
    apiKeyConfigured: Boolean(apiKey),
    modelConfigured: Boolean(envValue("ANTHROPIC_MODEL")),
    authMode: envValue("AI_AUTH_MODE") || (authToken ? "auth_token" : "x_api_key"),
    apiEndpoint,
  };
}

function requireAiConfig() {
  const status = getAiStatus();
  if (!status.enabled) throw new AiConfigError("AI 分析未开启，请设置 AI_ANALYSIS_ENABLED=true");
  const model = envValue("ANTHROPIC_MODEL");
  if (!model) throw new AiConfigError("AI 模型未配置，请设置 ANTHROPIC_MODEL");
  const baseUrl = envValue("ANTHROPIC_BASE_URL");
  const authToken = envValue("ANTHROPIC_AUTH_TOKEN");
  const apiKey = envValue("ANTHROPIC_API_KEY");
  if (!authToken && !apiKey) throw new AiConfigError("AI Key 未配置，请设置 ANTHROPIC_AUTH_TOKEN 或 ANTHROPIC_API_KEY");
  if (authToken && !baseUrl) throw new AiConfigError("Anthropic-compatible 中转站未配置 baseURL，请设置 ANTHROPIC_BASE_URL");
  return {
    baseUrl,
    authToken,
    apiKey,
    authMode: status.authMode,
    apiEndpoint: status.apiEndpoint,
    model,
  };
}

function joinUrl(baseUrl: string, endpoint: string) {
  const normalizedBase = baseUrl.replace(/\/+$/, "");
  const normalizedEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return `${normalizedBase}${normalizedEndpoint}`;
}

function isOpenAiChatEndpoint(endpoint: string) {
  return endpoint.includes("/chat/completions");
}

function buildHeaders(config: ReturnType<typeof requireAiConfig>) {
  const token = config.authToken || config.apiKey;
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (!isOpenAiChatEndpoint(config.apiEndpoint)) headers["anthropic-version"] = "2023-06-01";

  if (config.authMode === "bearer") headers.Authorization = `Bearer ${token}`;
  else if (config.authMode === "x_api_key") headers["x-api-key"] = token;
  else headers.Authorization = `Bearer ${token}`;

  return headers;
}

function extractJsonText(response: ClaudeCompatibleResponse) {
  const text = response.content?.find((item) => item.type === "text" || item.text)?.text
    || response.choices?.[0]?.message?.content
    || response.choices?.[0]?.text
    || response.message
    || "";
  let trimmed = text.trim();
  if (trimmed.startsWith("```")) {
    trimmed = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  }
  // 从第一个 { 或 [ 开始,用括号配平扫描出第一个完整 JSON,剥掉前缀和尾随说明文字
  const firstBrace = trimmed.indexOf("{");
  const firstBracket = trimmed.indexOf("[");
  const candidates = [firstBrace, firstBracket].filter((index) => index >= 0).sort((a, b) => a - b);
  const start = candidates[0] ?? -1;
  if (start < 0) return trimmed;
  const open = trimmed[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < trimmed.length; i += 1) {
    const char = trimmed[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === open) depth += 1;
    else if (char === close) {
      depth -= 1;
      if (depth === 0) return trimmed.slice(start, i + 1);
    }
  }
  return trimmed.slice(start); // 未配平(可能被截断),返回剩余部分让上层解析报错
}

function normalizeConfidence(value: unknown): "high" | "medium" | "low" {
  return value === "high" || value === "medium" || value === "low" ? value : "medium";
}

function normalizeAnalysisResult(value: unknown): AiAnalysisResult {
  const input = (value && typeof value === "object" ? value : {}) as Partial<AiAnalysisResult>;
  const rating = input.rating === "S" || input.rating === "A" || input.rating === "B" || input.rating === "C" ? input.rating : null;
  const riskNotes = Array.isArray(input.riskNotes) ? input.riskNotes.filter((item): item is string => typeof item === "string").slice(0, 3) : [];
  const budget = input.budgetSuggestion && typeof input.budgetSuggestion === "object" ? input.budgetSuggestion : null;
  return {
    rating,
    ratingReason: typeof input.ratingReason === "string" && input.ratingReason.trim() ? input.ratingReason.trim() : "",
    confidence: normalizeConfidence(input.confidence),
    summary: typeof input.summary === "string" && input.summary.trim() ? input.summary.trim() : "数据不足，建议补充销售、广告和成本数据",
    riskNotes,
    actionSuggestion: typeof input.actionSuggestion === "string" && input.actionSuggestion.trim() ? input.actionSuggestion.trim() : "请先完善 W1-W5 销售、广告、产品成本和其他成本",
    budgetSuggestion: budget && Number.isFinite(Number(budget.nextBudget)) ? { nextBudget: Number(budget.nextBudget), reason: String(budget.reason || "待补充预算调整原因") } : null,
  };
}

export async function callClaudeJson<T = unknown>({ systemPrompt, userPrompt, schemaHint, maxTokens }: CallClaudeJsonInput): Promise<T> {
  const config = requireAiConfig();
  const startedAt = performance.now();
  console.info(`[AI] Claude request start provider=${getAiStatus().provider} model=${config.model} baseUrlConfigured=${Boolean(config.baseUrl)} endpoint=${config.apiEndpoint}`);

  try {
    const userContent = `${userPrompt}\n\n请严格按以下 JSON 结构输出，不要输出 Markdown：\n${schemaHint || "{}"}`;
    const tokenLimit = maxTokens && maxTokens > 0 ? maxTokens : 1200;
    const anthropicBody = {
      model: config.model,
      max_tokens: tokenLimit,
      temperature: 0.2,
      system: systemPrompt,
      messages: [{ role: "user" as const, content: userContent }],
    };
    const compatibleBody = isOpenAiChatEndpoint(config.apiEndpoint)
      ? {
          model: config.model,
          max_tokens: tokenLimit,
          temperature: 0.2,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
          ],
        }
      : anthropicBody;

    let json: ClaudeCompatibleResponse;
    if (!config.baseUrl && config.apiKey && config.authMode === "x_api_key") {
      const client = new Anthropic({ apiKey: config.apiKey, timeout: 60_000, maxRetries: 1 });
      json = (await client.messages.create(anthropicBody)) as ClaudeCompatibleResponse;
    } else {
      const response = await fetch(joinUrl(config.baseUrl, config.apiEndpoint), {
        method: "POST",
        headers: buildHeaders(config),
        body: JSON.stringify(compatibleBody),
        signal: AbortSignal.timeout(60_000),
      });
      json = (await response.json().catch(() => ({}))) as ClaudeCompatibleResponse;
      if (!response.ok) {
        // 上游/中转站原始错误只记日志,不透传给前端(可能含 endpoint、限流、key 片段等内部信息)
        console.error(`[AI] upstream error status=${response.status}`, json.error?.message || json.message || "");
        throw new Error("AI 服务暂时不可用，请稍后重试");
      }
    }

    const text = extractJsonText(json);
    try {
      const parsed = JSON.parse(text) as T;
      console.info(`[AI] Claude request completed duration=${Math.round(performance.now() - startedAt)}ms parse=ok`);
      return parsed;
    } catch (parseError) {
      console.error(`[AI] Claude JSON parse failed duration=${Math.round(performance.now() - startedAt)}ms`, parseError instanceof Error ? parseError.message : parseError);
      throw new AiParseError("Claude 返回内容不是有效 JSON，请稍后重试");
    }
  } catch (error) {
    if (error instanceof AiConfigError || error instanceof AiParseError) throw error;
    console.error(`[AI] Claude request failed duration=${Math.round(performance.now() - startedAt)}ms`, error instanceof Error ? error.message : error);
    throw error;
  }
}

export async function analyzeChannelData(input: ChannelAnalysisPromptInput) {
  const result = await callClaudeJson<unknown>({
    systemPrompt: aiSystemPrompt,
    userPrompt: buildChannelAnalysisPrompt(input),
    schemaHint: "{\"rating\":\"S|A|B|C|null\",\"ratingReason\":\"评级依据\",\"confidence\":\"high|medium|low\",\"summary\":\"2-3句带数字总结\",\"riskNotes\":[\"风险\"],\"actionSuggestion\":\"建议动作\",\"budgetSuggestion\":{\"nextBudget\":0,\"reason\":\"原因\"}}",
    maxTokens: 1500,
  });
  return normalizeAnalysisResult(result);
}

export async function analyzeBusinessBlocks(input: BusinessBlockAnalysisPromptInput) {
  const result = await callClaudeJson<unknown>({
    systemPrompt: aiSystemPrompt,
    userPrompt: buildBusinessBlocksAnalysisPrompt(input),
    schemaHint: "[{\"businessBlock\":\"amazon\",\"rating\":\"S|A|B|C|null\",\"ratingReason\":\"评级依据\",\"confidence\":\"high|medium|low\",\"summary\":\"2-3句带数字总结\",\"riskNotes\":[\"风险\"],\"actionSuggestion\":\"建议动作\",\"budgetSuggestion\":{\"nextBudget\":0,\"reason\":\"原因\"}}]",
    maxTokens: 4096, // 四板块数组,提高 token 上限避免截断
  });
  const resultObject = result && typeof result === "object" ? result as { blockAnalyses?: unknown; results?: unknown } : {};
  const array = Array.isArray(result) ? result : Array.isArray(resultObject.blockAnalyses) ? resultObject.blockAnalyses : Array.isArray(resultObject.results) ? resultObject.results : [];
  return array.map((item) => ({ businessBlock: String((item as { businessBlock?: unknown }).businessBlock || ""), ...normalizeAnalysisResult(item) }));
}

function normalizeCompanyReview(value: unknown): CompanyReviewResult {
  const input = (value && typeof value === "object" ? value : {}) as Partial<CompanyReviewResult>;
  const overallRating = input.overallRating === "S" || input.overallRating === "A" || input.overallRating === "B" || input.overallRating === "C" ? input.overallRating : null;
  const riskNotes = Array.isArray(input.riskNotes) ? input.riskNotes.filter((item): item is string => typeof item === "string").slice(0, 3) : [];
  return {
    overallRating,
    overallSummary: typeof input.overallSummary === "string" && input.overallSummary.trim() ? input.overallSummary.trim() : "数据不足，建议先完善各板块销售、广告与成本数据",
    topPriority: typeof input.topPriority === "string" && input.topPriority.trim() ? input.topPriority.trim() : "",
    capitalShiftSuggestion: typeof input.capitalShiftSuggestion === "string" && input.capitalShiftSuggestion.trim() ? input.capitalShiftSuggestion.trim() : "",
    confidence: normalizeConfidence(input.confidence),
    riskNotes,
  };
}

export async function analyzeCompanyReview(input: CompanyReviewPromptInput) {
  const result = await callClaudeJson<unknown>({
    systemPrompt: aiSystemPrompt,
    userPrompt: buildCompanyReviewPrompt(input),
    schemaHint: companyReviewSchemaHint,
    maxTokens: 1500,
  });
  return normalizeCompanyReview(result);
}
