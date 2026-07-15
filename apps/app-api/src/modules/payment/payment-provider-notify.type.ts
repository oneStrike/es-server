import type { FastifyRequest } from 'fastify'
import type { Buffer } from 'node:buffer'

/** Provider 回调保留的原始请求体，供签名校验使用。 */
export type ProviderNotifyRawBody = Buffer | string | undefined

/** Provider 回调验签前使用的 UTF-8 原始载荷。 */
export type ProviderNotifyRawPayload = string | undefined

/** Provider 回调专属 Fastify 请求，补充 rawBody 扩展字段。 */
export type ProviderNotifyRawRequest = FastifyRequest & {
  rawBody?: ProviderNotifyRawBody
}
