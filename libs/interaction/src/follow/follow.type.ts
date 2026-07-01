import type { UserFollowSelect } from '@db/schema'
import type { FollowTargetTypeContractEnum } from '@libs/platform/constant'

/** 关注目标类型，复用平台层对外契约值域。 */
export type FollowTargetTypeEnum = FollowTargetTypeContractEnum

/** 关注操作返回结果，仅承载新记录 ID。 */
export type FollowCreateResult = Pick<UserFollowSelect, 'id'>
