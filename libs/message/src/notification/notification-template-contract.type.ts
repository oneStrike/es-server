import type { MessageNotificationCategoryKey } from './notification.type'

/**
 * 内置通知模板的标准契约字段。
 */
export interface CanonicalNotificationTemplateContract {
  titleTemplate: string
  contentTemplate: string
  remark: string
}

/**
 * 内置通知模板标准契约表。
 */
export type CanonicalNotificationTemplateContractMap = Record<
  MessageNotificationCategoryKey,
  CanonicalNotificationTemplateContract
>
