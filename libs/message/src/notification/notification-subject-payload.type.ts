import type { StructuredValue } from '@libs/platform/utils/jsonParse'

export type NotificationPayloadSubjectKind =
  | 'work'
  | 'chapter'
  | 'topic'
  | 'announcement'
  | 'task'

/** 稳定内部类型：通知主体快照。 */
export interface NotificationPayloadSubject {
  kind: NotificationPayloadSubjectKind
  id: number
  title?: string
  subtitle?: string
  cover?: string
  extra?: Record<string, StructuredValue>
}

/** 稳定内部类型：规范化后的通知 payload。 */
export type NotificationPayloadRecord = Record<
  string,
  StructuredValue | NotificationPayloadSubject | undefined
> & {
  subject?: NotificationPayloadSubject
  parentSubject?: NotificationPayloadSubject
}

/** 稳定内部类型：payload 归一结果，供 repair/backfill 统计复用。 */
export interface NotificationPayloadNormalizationResult {
  payload?: NotificationPayloadRecord
  unresolved: boolean
}
