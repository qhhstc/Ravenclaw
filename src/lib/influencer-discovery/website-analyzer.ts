import "server-only";

import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import type { WebsiteContent } from "./types";

// 网站抓取 V1:仅首页 + 最多 5 个同域内部链接,轻量提取文本,严格 SSRF 防护。

const FETCH_TIMEOUT_MS = 15_000;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024; // 2MB
const MAX_INTERNAL_LINKS = 5;
const MAX_REDIRECTS = 5;
const MAX_BODY_TEXT = 8_000; // 交给 AI 的正文截断长度

export class WebsiteFetchError extends Error {}

// ——— SSRF 防护 ———

function isPrivateIpv4(ip: string) {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) return true;
  const [a, b] = parts;
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // loopback
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 169 && b === 254) return true; // link-local 169.254.0.0/16
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
  if (a >= 224) return true; // multicast / reserved
  return false;
}

function isPrivateIpv6(ip: string) {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true; // loopback / unspecified
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique local fc00::/7
  if (lower.startsWith("fe80")) return true; // link-local
  // IPv4-mapped ::ffff:a.b.c.d
  const mapped = lower.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIpv4(mapped[1]);
  return false;
}

function isBlockedHostname(hostname: string) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return true;
  const ipKind = isIP(host);
  if (ipKind === 4) return isPrivateIpv4(host);
  if (ipKind === 6) return isPrivateIpv6(host);
  return false;
}

// 校验 URL 合法性 + 主机名黑名单 + DNS 解析出的 IP 不落入内网(防 DNS rebinding)
async function assertSafeUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new WebsiteFetchError("网站地址格式不正确");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new WebsiteFetchError("仅支持 http/https 协议的网站地址");
  }
  if (isBlockedHostname(url.hostname)) {
    throw new WebsiteFetchError("禁止访问本地或内网地址");
  }
  // 若主机名是域名,解析其 IP 再次校验(防止域名指向内网)
  if (isIP(url.hostname) === 0) {
    try {
      const records = await lookup(url.hostname, { all: true });
      for (const record of records) {
        const priv = record.family === 6 ? isPrivateIpv6(record.address) : isPrivateIpv4(record.address);
        if (priv) throw new WebsiteFetchError("网站解析到内网地址,已拒绝");
      }
    } catch (error) {
      if (error instanceof WebsiteFetchError) throw error;
      throw new WebsiteFetchError("网站域名无法解析");
    }
  }
  return url;
}

// 手动跟随重定向,每一跳都重新做 SSRF 校验
async function safeFetch(rawUrl: string, signal: AbortSignal): Promise<Response> {
  let currentUrl = rawUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const url = await assertSafeUrl(currentUrl);
    const response = await fetch(url, {
      redirect: "manual",
      signal,
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; RavenclawDiscoveryBot/1.0)",
        accept: "text/html,application/xhtml+xml",
      },
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) return response;
      currentUrl = new URL(location, url).toString(); // 解析相对跳转
      continue;
    }
    return response;
  }
  throw new WebsiteFetchError("网站重定向次数过多");
}

// 读取响应体,限制最大字节数(超出即中止)
async function readLimitedText(response: Response): Promise<string> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType && !contentType.includes("text/html") && !contentType.includes("text/plain") && !contentType.includes("application/xhtml")) {
    throw new WebsiteFetchError("目标地址不是 HTML 页面");
  }
  const reader = response.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let received = 0;
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > MAX_RESPONSE_BYTES) {
      text += decoder.decode(value.slice(0, MAX_RESPONSE_BYTES - (received - value.byteLength)));
      await reader.cancel();
      break;
    }
    text += decoder.decode(value, { stream: true });
  }
  return text;
}

// ——— HTML 轻量提取(正则,不引第三方 DOM 库) ———

function stripTags(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#\d+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchAll(html: string, regex: RegExp, group = 1): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(html)) !== null) {
    const text = stripTags(m[group]);
    if (text) out.push(text);
  }
  return out;
}

function extractTitle(html: string) {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  return m ? stripTags(m[1]) : "";
}

function extractMetaDescription(html: string) {
  const m =
    /<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i.exec(html) ||
    /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i.exec(html) ||
    /<meta[^>]+property=["']og:description["'][^>]*content=["']([^"']*)["']/i.exec(html);
  return m ? stripTags(m[1]) : "";
}

// 提取同域内部链接,优先 /collections、/products
function extractInternalLinks(html: string, baseUrl: URL): string[] {
  const hrefs = new Set<string>();
  const regex = /<a[^>]+href=["']([^"'#]+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(html)) !== null) {
    try {
      const resolved = new URL(m[1], baseUrl);
      if (resolved.hostname !== baseUrl.hostname) continue;
      if (resolved.protocol !== "http:" && resolved.protocol !== "https:") continue;
      resolved.hash = "";
      hrefs.add(resolved.toString());
    } catch {
      // 忽略非法链接
    }
  }
  const links = [...hrefs].filter((h) => h !== baseUrl.toString());
  const priority = links.filter((h) => /\/(collections|products|shop|catalog)\b/i.test(h));
  const rest = links.filter((h) => !priority.includes(h));
  return [...priority, ...rest].slice(0, MAX_INTERNAL_LINKS);
}

/**
 * 抓取网站首页 + 最多 5 个同域内部链接,返回结构化文本。
 * 全程 SSRF 防护、15s 超时、2MB 上限、优先 text/html。
 */
export async function fetchWebsiteContent(rawUrl: string): Promise<WebsiteContent> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const homeResponse = await safeFetch(rawUrl, controller.signal);
    if (!homeResponse.ok) {
      throw new WebsiteFetchError(`网站返回异常状态码 ${homeResponse.status}`);
    }
    const finalUrl = new URL(homeResponse.url || rawUrl);
    const homeHtml = await readLimitedText(homeResponse);

    const headings = [
      ...matchAll(homeHtml, /<h1[^>]*>([\s\S]*?)<\/h1>/gi),
      ...matchAll(homeHtml, /<h2[^>]*>([\s\S]*?)<\/h2>/gi),
    ].slice(0, 30);
    const navigationTexts = matchAll(homeHtml, /<nav[^>]*>([\s\S]*?)<\/nav>/gi).slice(0, 10);
    const bodyText = stripTags(homeHtml).slice(0, MAX_BODY_TEXT);

    // 抓内部链接(串行,每个都受同一超时约束)
    const internalLinks = extractInternalLinks(homeHtml, finalUrl);
    const productTexts: string[] = [];
    const collectionTexts: string[] = [];
    for (const link of internalLinks) {
      try {
        const subResponse = await safeFetch(link, controller.signal);
        if (!subResponse.ok) continue;
        const subHtml = await readLimitedText(subResponse);
        const snippet = [extractTitle(subHtml), extractMetaDescription(subHtml), ...matchAll(subHtml, /<h1[^>]*>([\s\S]*?)<\/h1>/gi).slice(0, 3)]
          .filter(Boolean)
          .join(" · ")
          .slice(0, 500);
        if (!snippet) continue;
        if (/\/(collections|catalog)\b/i.test(link)) collectionTexts.push(snippet);
        else productTexts.push(snippet);
      } catch {
        // 单个内部链接失败不影响整体
      }
    }

    return {
      finalUrl: finalUrl.toString(),
      domain: finalUrl.hostname,
      pageTitle: extractTitle(homeHtml),
      metaDescription: extractMetaDescription(homeHtml),
      headings,
      navigationTexts,
      productTexts,
      collectionTexts,
      bodyText,
    };
  } catch (error) {
    if (error instanceof WebsiteFetchError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new WebsiteFetchError("网站抓取超时(15 秒)");
    }
    throw new WebsiteFetchError(error instanceof Error ? error.message : "网站抓取失败");
  } finally {
    clearTimeout(timer);
  }
}

export function normalizeWebsiteUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) throw new WebsiteFetchError("请输入网站地址");
  // 缺协议时补 https://
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withProtocol);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new WebsiteFetchError("仅支持 http/https 协议的网站地址");
    }
    return url.toString();
  } catch (error) {
    if (error instanceof WebsiteFetchError) throw error;
    throw new WebsiteFetchError("网站地址格式不正确");
  }
}

// 归一化域名用于复用匹配:小写、去 www. 前缀、去尾点。
// 保证 bahomu.com / www.bahomu.com / http/https / 尾斜杠 归一到同一 key。
export function canonicalDomain(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/\.$/, "").replace(/^www\./, "");
}
