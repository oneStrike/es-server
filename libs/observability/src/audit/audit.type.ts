import type { requestLog } from '@db/schema'

/** 后台审计日志写入结构，直接从 request_log schema 推导以避免重复维护字段镜像。 */
export type RequestLogInsert = typeof requestLog.$inferInsert
