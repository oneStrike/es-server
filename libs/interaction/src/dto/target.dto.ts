import {
  InteractionTargetTypeEnum,
  ReportTargetTypeEnum,
} from '@libs/base/constant'
import { EnumProperty, NumberProperty } from '@libs/base/decorators'

/**
 * 目标 ID 基础请求体。
 *
 * 说明：
 * - 所有多态目标请求体都复用该 DTO
 * - 仅承载目标 ID，不承担目标类型定义职责
 */
export class TargetIdBodyDto {
  @NumberProperty({
    description: '目标 ID',
    example: 1,
    required: true,
    min: 1,
  })
  targetId!: number
}

/**
 * 点赞目标请求体。
 *
 * 说明：
 * - 点赞相关接口统一复用该 DTO
 * - 目标类型沿用交互模块统一的 `InteractionTargetTypeEnum`
 */
export class LikeTargetBodyDto extends TargetIdBodyDto {
  @EnumProperty({
    description: '点赞目标类型',
    enum: InteractionTargetTypeEnum,
    example: InteractionTargetTypeEnum.COMIC,
    required: true,
  })
  targetType!: InteractionTargetTypeEnum
}

/**
 * 举报目标请求体。
 *
 * 说明：
 * - 举报相关接口统一复用该 DTO
 * - 目标类型使用举报模块重构后的 `ReportTargetTypeEnum`
 */
export class ReportTargetBodyDto extends TargetIdBodyDto {
  @EnumProperty({
    description: '举报目标类型',
    enum: ReportTargetTypeEnum,
    example: ReportTargetTypeEnum.COMIC,
    required: true,
  })
  targetType!: ReportTargetTypeEnum
}
