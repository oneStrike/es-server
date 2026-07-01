import { NumberProperty, StringProperty } from '@libs/platform/decorators'
import { PageDto } from '@libs/platform/dto'
import { PickType } from '@nestjs/swagger'

export class QueryCheckInCalendarDetailDto {
  @StringProperty({
    description: '目标日期；服务端按该日期推导所属签到周期。',
    example: '2026-04-23',
    type: 'ISO8601',
  })
  targetDate!: string
}

export class QueryAdminUserCheckInCalendarDetailDto extends QueryCheckInCalendarDetailDto {
  @NumberProperty({
    description: '目标用户 ID。',
    example: 1,
  })
  userId!: number
}

export class QueryAdminCheckInSignedUserPageDto extends PickType(PageDto, [
  'pageIndex',
  'pageSize',
] as const) {
  @StringProperty({
    description:
      '目标日期；在已签用户分页中固定表示精确签到自然日，不再额外接收 signDate 或 periodKey。',
    example: '2026-04-23',
    type: 'ISO8601',
  })
  targetDate!: string
}
