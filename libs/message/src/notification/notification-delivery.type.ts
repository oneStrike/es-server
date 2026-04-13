import type { NotificationDeliverySelect } from '@db/schema'
import type { MessageNotificationDispatchStatusEnum } from './notification.constant'

export interface NotificationDeliveryPageItem
  extends Omit<NotificationDeliverySelect, 'eventId' | 'dispatchId' | 'status'> {
  eventId: string
  dispatchId: string
  status: MessageNotificationDispatchStatusEnum
  categoryLabel?: string
  statusLabel: string
}
