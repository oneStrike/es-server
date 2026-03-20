import { BaseForumTagDto, BaseForumTopicDto } from '@libs/forum'
import { ArrayProperty } from '@libs/platform/decorators'
import { PickType } from '@nestjs/swagger'

export class ForumTagTopicSummaryDto extends PickType(BaseForumTopicDto, [
  'id',
  'title',
  'createdAt',
] as const) {}

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
