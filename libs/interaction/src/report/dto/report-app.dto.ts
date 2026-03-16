import {
  EnumProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { IntersectionType } from '@nestjs/swagger'
import { ReportReasonEnum, ReportTargetTypeEnum } from '../report.constant'

/**
 * 举报原因请求体。
 *
 * 说明：
 * - 举报原因统一使用数字枚举，不再使用字符串
 * - `description` 仅用于补充上下文，不承担原因类型职责
 */

/**
 * 点赞目标 DTO
 */
export class ReportTargetDto {
  @NumberProperty({
    description: '点赞的目标id',
    example: 1,
    required: true,
  })
  targetId!: number

  @EnumProperty({
    description:
      '举报目标类型（1=漫画，2=小说，3=漫画章节，4=小说章节，5=论坛主题，6=评论，7=用户）',
    enum: ReportTargetTypeEnum,
    example: ReportTargetTypeEnum.COMIC,
    required: true,
  })
  targetType!: ReportTargetTypeEnum
}
export class ReportReasonBodyDto {
  @EnumProperty({
    description: '举报原因类型',
    enum: ReportReasonEnum,
    example: ReportReasonEnum.INAPPROPRIATE_CONTENT,
    required: true,
  })
  reasonType!: ReportReasonEnum

  @StringProperty({
    description: '举报补充说明',
    example: '该内容存在明显违规信息',
    required: false,
    maxLength: 500,
  })
  description?: string

  @StringProperty({
    description: '证据链接',
    example: 'https://example.com/evidence.png',
    required: false,
    maxLength: 500,
  })
  evidenceUrl?: string
}

/**
 * 创建举报请求体。
 *
 * 说明：
 * - 举报入口统一使用该 DTO
 * - 不再保留作品、章节、评论、主题、回复等拆分 DTO
 */
export class CreateReportBodyDto extends IntersectionType(
  ReportTargetDto,
  ReportReasonBodyDto,
) {}
