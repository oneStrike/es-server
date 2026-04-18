import {
  BooleanProperty,
  DateProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { IdDto, PageDto } from '@libs/platform/dto'
import { IntersectionType, PartialType, PickType } from '@nestjs/swagger'
import {
  getMessageNotificationCategoryLabel,
  MessageNotificationCategoryKey,
} from '../notification.constant'

export class BaseMessageNotificationTemplateDto {
  @NumberProperty({
    description: '模板 ID',
    example: 1,
  })
  id!: number

  @StringProperty({
    description: '通知分类键',
    example: 'comment_reply',
    maxLength: 80,
  })
  categoryKey!: MessageNotificationCategoryKey

  @StringProperty({
    description:
      '标题模板；支持 {{title}}、{{actor.nickname}}、{{data.object.title}} 等占位符',
    example: '{{actor.nickname}} 点赞了你的主题',
    maxLength: 200,
  })
  titleTemplate!: string

  @StringProperty({
    description:
      '正文模板；支持 {{content}}、{{data.object.title}}、{{data.object.snippet}} 等占位符',
    example: '{{data.object.title}}',
    maxLength: 1000,
  })
  contentTemplate!: string

  @BooleanProperty({
    description: '是否启用',
    example: true,
  })
  isEnabled!: boolean

  @StringProperty({
    description: '备注',
    example: '默认评论回复模板',
    required: false,
    maxLength: 500,
  })
  remark?: string

  @DateProperty({
    description: '创建时间',
    example: '2026-04-13T12:00:00.000Z',
  })
  createdAt!: Date

  @DateProperty({
    description: '更新时间',
    example: '2026-04-13T12:30:00.000Z',
  })
  updatedAt!: Date
}

class MessageNotificationTemplateMutableDto extends PickType(
  BaseMessageNotificationTemplateDto,
  ['categoryKey', 'titleTemplate', 'contentTemplate'] as const,
) {}

class MessageNotificationTemplateOptionalConfigDto extends PartialType(
  PickType(BaseMessageNotificationTemplateDto, [
    'isEnabled',
    'remark',
  ] as const),
) {}

export class QueryNotificationTemplatePageDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseMessageNotificationTemplateDto, [
      'categoryKey',
      'isEnabled',
    ] as const),
  ),
) {}

export class CreateNotificationTemplateDto extends IntersectionType(
  MessageNotificationTemplateMutableDto,
  MessageNotificationTemplateOptionalConfigDto,
) {}

export class UpdateNotificationTemplateDto extends IntersectionType(
  IdDto,
  PartialType(CreateNotificationTemplateDto),
) {}

export class UpdateNotificationTemplateEnabledDto extends IntersectionType(
  IdDto,
  PickType(BaseMessageNotificationTemplateDto, ['isEnabled'] as const),
) {}

export class AdminMessageNotificationTemplateDto extends BaseMessageNotificationTemplateDto {
  @StringProperty({
    description: '通知分类中文标签',
    example: getMessageNotificationCategoryLabel('comment_reply'),
  })
  categoryLabel!: string
}
