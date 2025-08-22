import { SetMetadata } from '@nestjs/common'

export const REQUEST_LOG_META_KEY = 'request_log'

export interface RequestLogOptions {
  // 操作类型
  actionType?: string
  // 是否记录响应体，默认false
  logResponse?: boolean
  // 脱敏字段
  maskKeys?: string[]
  // 记录的日志内容
  content?: string
}

export function RequestLog(options: RequestLogOptions = {}) {
  return SetMetadata(REQUEST_LOG_META_KEY, { enabled: true, ...options })
}
