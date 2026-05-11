import { BadRequestException } from '@nestjs/common'
import {
  POSITIVE_BIGINT_QUERY_ID_MESSAGE_SUFFIX,
  POSITIVE_BIGINT_QUERY_ID_REGEX,
} from './notification-query-id.constant'

/**
 * 解析查询参数中的 bigint ID。
 * 只接受正整数字符串，非法值统一按 400 处理，避免把输入错误伪装成空结果。
 */
export function parsePositiveBigintQueryId(value: string, fieldName: string) {
  const normalized = value.trim()
  if (!POSITIVE_BIGINT_QUERY_ID_REGEX.test(normalized)) {
    throw new BadRequestException(
      `${fieldName} ${POSITIVE_BIGINT_QUERY_ID_MESSAGE_SUFFIX}`,
    )
  }

  return BigInt(normalized)
}
