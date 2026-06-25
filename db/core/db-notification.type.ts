import type { Notification } from 'pg'

/** 稳定领域类型 `DbNotificationSubscriptionOptions`。定义 LISTEN/NOTIFY 订阅参数。 */
export interface DbNotificationSubscriptionOptions {
  channel: string
  onNotification: (notification: Notification) => void
  onError?: (error: Error) => void
}

/** 稳定领域类型 `DbNotificationSubscription`。封装订阅生命周期关闭入口。 */
export interface DbNotificationSubscription {
  close(): Promise<void>
}
