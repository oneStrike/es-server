import { BaseForumTagDto } from '@libs/forum'
import {
  ArrayProperty,
  DateProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'

export class ForumTagTopicSummaryDto {
  @NumberProperty({
    description: '主题ID',
    example: 1,
    required: true,
    validation: false,
  })
  id!: number

  @StringProperty({
    description: '主题标题',
    example: '如何统一 controller 路由规范',
    required: true,
    validation: false,
  })
  title!: string

  @DateProperty({
    description: '主题创建时间',
    example: '2026-03-19T00:00:00.000Z',
    required: true,
    validation: false,
  })
  createdAt!: Date
}

export class ForumTagDetailResponseDto extends BaseForumTagDto {
  @ArrayProperty({
    description: '最近使用该标签的主题列表',
    itemClass: ForumTagTopicSummaryDto,
    itemType: 'object',
    required: true,
    validation: false,
  })
  topics!: ForumTagTopicSummaryDto[]
}
