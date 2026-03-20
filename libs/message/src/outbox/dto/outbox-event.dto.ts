/**
 * 通知发件箱载荷接口
 * 定义通知事件的数据结构
 */
export type {
  CreateMessageOutboxEventInput as CreateMessageOutboxEventDto,
  CreateNotificationOutboxEventInput as CreateNotificationOutboxEventDto,
  NotificationOutboxPayload,
} from '../outbox.type'
