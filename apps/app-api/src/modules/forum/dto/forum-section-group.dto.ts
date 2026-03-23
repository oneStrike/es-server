import { BaseForumSectionGroupDto } from '@libs/forum/section-group'
import { ArrayProperty } from '@libs/platform/decorators'
import { PickType } from '@nestjs/swagger'
import { AppForumSectionListItemDto } from './forum-section.dto'

export class AppForumSectionGroupListItemDto extends PickType(
  BaseForumSectionGroupDto,
  ['id', 'name', 'description', 'sortOrder', 'isEnabled'] as const,
) {
  @ArrayProperty({
    description: '分组下的板块列表',
    itemClass: AppForumSectionListItemDto,
    itemType: 'object',
    required: true,
    validation: false,
  })
  sections!: AppForumSectionListItemDto[]
}
