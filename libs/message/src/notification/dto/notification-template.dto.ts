import { BooleanProperty, StringProperty } from '@libs/platform/decorators'
import { BaseDto, IdDto, PageDto } from '@libs/platform/dto'
import { IntersectionType, PartialType, PickType } from '@nestjs/swagger'
import {
  getMessageNotificationCategoryLabel,
  MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM,
  MessageNotificationCategoryKey,
} from '../notification.constant'

const NOTIFICATION_TEMPLATE_CATEGORY_KEY_DESCRIPTION =
  '通知分类键，用于标识评论互动、主题互动、用户关注、系统公告或任务提醒等模板场景'

export class BaseMessageNotificationTemplateDto extends BaseDto {
  @StringProperty({
    description: NOTIFICATION_TEMPLATE_CATEGORY_KEY_DESCRIPTION,
    example: MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.COMMENT_REPLY,
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
