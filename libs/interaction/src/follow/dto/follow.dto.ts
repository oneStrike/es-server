import {
  DateProperty,
  EnumProperty,
  NumberProperty,
} from '@libs/platform/decorators'
import { IdDto, PageDto, UserIdDto } from '@libs/platform/dto'
import { IntersectionType, PickType } from '@nestjs/swagger'
import { FollowTargetTypeEnum } from '../follow.constant'

/**
 * 关注记录基础 DTO（全量字段）
 */
export class BaseFollowDto extends IntersectionType(IdDto, UserIdDto) {
  @EnumProperty({
    description: '关注目标类型（1=用户，2=作者，3=论坛板块）',
    enum: FollowTargetTypeEnum,
    example: FollowTargetTypeEnum.USER,
    required: true,
  })
  targetType!: FollowTargetTypeEnum

  @NumberProperty({
    description: '关注目标 ID',
    example: 1,
    required: true,
  })
  targetId!: number

  @DateProperty({
    description: '创建时间',
    example: '2024-01-01T00:00:00.000Z',
    required: true,
  })
  createdAt!: Date
}

export class FollowTargetDto extends PickType(BaseFollowDto, [
  'targetId',
  'targetType',
] as const) {}

export class FollowRecordDto extends IntersectionType(
  FollowTargetDto,
  PickType(BaseFollowDto, ['userId'] as const),
) {}

export class FollowPageQueryDto extends PageDto {}

export class FollowPageCommandDto extends IntersectionType(
  FollowPageQueryDto,
  PickType(BaseFollowDto, ['userId'] as const),
) {}
