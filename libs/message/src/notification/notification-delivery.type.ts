import type { NotificationDeliverySelect } from '@db/schema'
import type { MessageNotificationDispatchStatusEnum } from './notification.constant'

/** 稳定领域类型 `NotificationDeliveryPageItem`。仅供内部领域/服务链路复用，避免重复定义。 */
export interface NotificationDeliveryPageItem
  extends Omit<NotificationDeliverySelect, 'eventId' | 'dispatchId' | 'status'> {
  eventId: string
  dispatchId: string
  status: MessageNotificationDispatchStatusEnum
  categoryLabel?: string
  statusLabel: string
}
