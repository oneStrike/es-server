import type { AppUserSelect } from '@db/schema'

/** 通知公开映射中的 actor 字段来源，只取用户公开头像与昵称字段。 */
export type NotificationActorSource = Pick<
  AppUserSelect,
  'id' | 'nickname' | 'avatarUrl'
>
