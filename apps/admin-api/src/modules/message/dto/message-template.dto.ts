import {
  BaseMessageNotificationTemplateDto,
  getMessageNotificationTypeLabel,
  MessageNotificationTypeEnum,
} from '@libs/message/notification'
import { StringProperty } from '@libs/platform/decorators'
import {
  IdDto,
  PageDto,
} from '@libs/platform/dto'
import {
  IntersectionType,
  PartialType,
  PickType,
} from '@nestjs/swagger'

class MessageNotificationTemplateMutableDto extends PickType(
  BaseMessageNotificationTemplateDto,
  ['notificationType', 'titleTemplate', 'contentTemplate'] as const,
) {}

class MessageNotificationTemplateOptionalConfigDto extends PartialType(
  PickType(BaseMessageNotificationTemplateDto, ['isEnabled', 'remark'] as const),
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

export class QueryAdminMessageNotificationTemplateDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseMessageNotificationTemplateDto, [
      'notificationType',
      'templateKey',
      'isEnabled',
    ] as const),
  ),
) {}

export class CreateAdminMessageNotificationTemplateDto extends IntersectionType(
  MessageNotificationTemplateMutableDto,
  MessageNotificationTemplateOptionalConfigDto,
) {}

export class UpdateAdminMessageNotificationTemplateDto extends IntersectionType(
  IdDto,
  PartialType(CreateAdminMessageNotificationTemplateDto),
) {}

export class UpdateAdminMessageNotificationTemplateEnabledDto extends IntersectionType(
  IdDto,
  PickType(BaseMessageNotificationTemplateDto, ['isEnabled'] as const),
) {}
