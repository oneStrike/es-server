/**
 * Fastify 静态文件响应头设置接口。
 */
export interface StaticHeadersResponse {
  setHeader: (name: string, value: string) => void
}
