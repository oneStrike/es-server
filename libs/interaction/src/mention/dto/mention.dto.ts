import {
  ArrayProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { Type } from 'class-transformer'
import { IsArray, IsDefined, ValidateNested } from 'class-validator'

/**
 * 单条提及草稿 DTO。
 * 前端需要传入稳定 userId 和正文中的精确偏移区间。
 */
export class MentionDraftDto {
  @NumberProperty({
    description: '被提及用户 ID',
    example: 1,
    required: true,
    min: 1,
  })
  userId!: number

  @StringProperty({
    description: '被提及用户昵称快照，不含 @ 前缀',
    example: '测试用户',
    required: true,
    maxLength: 100,
  })
  nickname!: string

  @NumberProperty({
    description: '提及片段开始偏移（含）',
    example: 3,
    required: true,
    min: 0,
  })
  start!: number

  @NumberProperty({
    description: '提及片段结束偏移（不含）',
    example: 8,
    required: true,
    min: 1,
  })
  end!: number
}

/**
 * 提及列表写入 DTO。
 * 仅用于正文写路径，不会进入读取侧响应结构。
 */
export class MentionDraftListDto {
  @ArrayProperty({
    description: '正文中的结构化提及列表',
    required: false,
    itemClass: MentionDraftDto,
  })
  mentions?: MentionDraftDto[]
}

/**
 * 必填提及列表写入 DTO。
 * 用于正文写接口强制要求显式传入 mentions，空数组表示无提及。
 */
export class RequiredMentionDraftListDto {
  @IsDefined({ message: 'mentions 不能为空' })
  @IsArray({ message: 'mentions 必须是数组类型' })
  @ValidateNested({ each: true })
  @Type(() => MentionDraftDto)
  @ArrayProperty({
    description: '正文中的结构化提及列表；无提及时传空数组',
    required: true,
    itemClass: MentionDraftDto,
    validation: false,
    default: [],
  })
  mentions!: MentionDraftDto[]
}
