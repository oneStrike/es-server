import type { FastifyReply } from 'fastify'
import type { AgreementHtmlView } from './agreement.type'

/** 协议 HTML 页面 CSP：禁止脚本和外部连接，仅允许受限媒体资源。 */
export const AGREEMENT_HTML_CSP =
  "default-src 'none'; script-src 'none'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; img-src https: data:; media-src https: data:; style-src 'unsafe-inline'"

// 发送协议 HTML 页面，并保持 admin/app 两侧的安全响应头一致。
export function sendAgreementHtml(
  reply: FastifyReply,
  agreement: AgreementHtmlView,
) {
  return reply
    .header('Content-Security-Policy', AGREEMENT_HTML_CSP)
    .header('X-Content-Type-Options', 'nosniff')
    .header('Referrer-Policy', 'no-referrer')
    .header('Cache-Control', 'no-store')
    .header('X-Robots-Tag', 'noindex, nofollow, noarchive')
    .type('text/html; charset=utf-8')
    .send(renderAgreementHtml(agreement))
}

// 渲染协议 HTML 壳，正文保持后台维护内容直出。
function renderAgreementHtml(agreement: AgreementHtmlView) {
  const title = escapeHtml(agreement.title)
  const version = escapeHtml(agreement.version)

  return [
    '<!doctype html>',
    '<html lang="zh-CN">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${title}</title>`,
    '<style>',
    'body{margin:0;background:#f7f8fa;color:#1f2933;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.7;}',
    'main{max-width:760px;margin:0 auto;padding:28px 18px 48px;background:#fff;min-height:100vh;}',
    'h1{font-size:24px;line-height:1.35;margin:0 0 8px;}',
    '.meta{color:#6b7280;font-size:13px;margin:0 0 24px;}',
    '.content{font-size:16px;overflow-wrap:anywhere;}',
    '.content img,.content video{max-width:100%;height:auto;}',
    '</style>',
    '</head>',
    '<body>',
    '<main>',
    `<h1>${title}</h1>`,
    `<p class="meta">版本：${version}</p>`,
    `<article class="content">${agreement.content}</article>`,
    '</main>',
    '</body>',
    '</html>',
  ].join('')
}

// 转义页面壳字段，避免标题和版本号破坏 HTML 结构。
function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
