import { BadRequestException } from '@nestjs/common'

/**
 * 校验开始/结束时间范围的合法性
 * - 允许任意一端为 undefined
 * - 当两端均存在时，要求 start < end
 */
export function assertValidTimeRange(
  start?: Date | null,
  end?: Date | null,
  message = '开始时间不能大于或等于结束时间',
) {
  if (start && end && start >= end) {
    throw new BadRequestException(message)
  }
}
