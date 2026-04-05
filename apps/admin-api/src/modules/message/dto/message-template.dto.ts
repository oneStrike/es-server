import {
  BaseMessageNotificationTemplateDto,
  getMessageNotificationTypeLabel,
  MessageNotificationTypeEnum,
} from '@libs/message/notification'
import { StringProperty } from '@libs/platform/decorators'

export class AdminMessageNotificationTemplateDto extends BaseMessageNotificationTemplateDto {
  @StringProperty({
    description: '通知类型中文标签',
    example: getMessageNotificationTypeLabel(
      MessageNotificationTypeEnum.COMMENT_REPLY,
    ),
  })
  notificationTypeLabel!: string
}
