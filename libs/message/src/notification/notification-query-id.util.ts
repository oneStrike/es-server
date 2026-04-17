import { BadRequestException } from '@nestjs/common'

const POSITIVE_BIGINT_QUERY_ID_REGEX = /^[1-9]\d*$/

/**
 * 解析查询参数中的 bigint ID。
 * 只接受正整数字符串，非法值统一按 400 处理，避免把输入错误伪装成空结果。
 */
export function parsePositiveBigintQueryId(value: string, fieldName: string) {
  const normalized = value.trim()
  if (!POSITIVE_BIGINT_QUERY_ID_REGEX.test(normalized)) {
    throw new BadRequestException(`${fieldName} 必须是合法的正整数字符串`)
  }

  return BigInt(normalized)
}
