import { InteractionTargetTypeEnum } from '@libs/platform/constant'
import { EnumProperty, NumberProperty } from '@libs/platform/decorators'
import { ReportTargetTypeEnum } from '../report/report.constant'

/**
 * 仅包含目标 ID 的基础请求体。
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
 * 通用交互目标请求体。
 */
export class InteractionTargetBodyDto extends TargetIdBodyDto {
  @EnumProperty({
    description: '交互目标类型',
    enum: InteractionTargetTypeEnum,
    example: InteractionTargetTypeEnum.COMIC,
    required: true,
  })
  targetType!: InteractionTargetTypeEnum
}

/**
 * 点赞目标请求体（兼容旧命名）。
 */
export class LikeTargetBodyDto extends InteractionTargetBodyDto {}

/**
 * 举报目标请求体。
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
