import {
  BooleanProperty,
  DateProperty,
  EnumProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { IdDto, PageDto } from '@libs/platform/dto'
import { IntersectionType, PartialType, PickType } from '@nestjs/swagger'
import {
  getMessageNotificationTypeLabel,
  MessageNotificationTypeEnum,
} from '../notification.constant'

/**
 * 通知模板基础 DTO
 * 直接映射 notification_template 表的对外字段，用于管理端复用
 */
export class BaseMessageNotificationTemplateDto {
  @NumberProperty({
    description: '模板 ID',
    example: 1,
  })
  id!: number

  @EnumProperty({
    description: '通知类型',
    example: MessageNotificationTypeEnum.COMMENT_REPLY,
    enum: MessageNotificationTypeEnum,
  })
  notificationType!: MessageNotificationTypeEnum

  @StringProperty({
    description: '模板唯一键',
    example: 'notification.comment-reply',
    maxLength: 80,
  })
  templateKey!: string

  @StringProperty({
    description: '标题模板',
    example: '收到新的评论回复',
    maxLength: 200,
  })
  titleTemplate!: string

  @StringProperty({
    description: '正文模板',
    example: '你收到了一条新的评论回复',
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
    example: '默认评论回复通知模板',
    required: false,
    maxLength: 500,
  })
  remark?: string

  @DateProperty({
    description: '创建时间',
    example: '2026-03-28T12:00:00.000Z',
  })
  createdAt!: Date

  @DateProperty({
    description: '更新时间',
    example: '2026-03-28T12:30:00.000Z',
  })
  updatedAt!: Date
}

class MessageNotificationTemplateMutableDto extends PickType(
  BaseMessageNotificationTemplateDto,
  ['notificationType', 'titleTemplate', 'contentTemplate'] as const,
) {}

class MessageNotificationTemplateOptionalConfigDto extends PartialType(
  PickType(BaseMessageNotificationTemplateDto, ['isEnabled', 'remark'] as const),
) {}

export class QueryNotificationTemplatePageDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseMessageNotificationTemplateDto, [
      'notificationType',
      'templateKey',
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
    description: '通知类型中文标签',
    example: getMessageNotificationTypeLabel(
      MessageNotificationTypeEnum.COMMENT_REPLY,
    ),
  })
  notificationTypeLabel!: string
}
