import type { UserFavoriteSelect } from '@db/schema'

/** 收藏操作返回结果，仅承载新记录 ID。 */
export type FavoriteCreateResult = Pick<UserFavoriteSelect, 'id'>
