import type { ForumModeratorSectionSelect } from '@db/schema'
import type {
  ForumModeratorPermissionEnum,
  ForumModeratorRoleTypeEnum,
} from './moderator.constant'

/**
 * 版主板块关联的最小行结构。
 * 仅用于写路径同步版主-板块作用域。
 */
/** 稳定领域类型 `ForumModeratorSectionScope`。仅供内部领域/服务链路复用，避免重复定义。 */
export type ForumModeratorSectionScope = Pick<
  ForumModeratorSectionSelect,
  'sectionId' | 'permissions'
>

/**
 * 角色作用域归一化结果。
 * 供 create/update 路径共享最终落库参数，避免不同入口重复拼装角色约束。
 */
/** 稳定领域类型 `NormalizedModeratorScope`。仅供内部领域/服务链路复用，避免重复定义。 */
export interface NormalizedModeratorScope {
  roleType: ForumModeratorRoleTypeEnum
  groupId: number | null
  permissions: ForumModeratorPermissionEnum[]
  sectionIds: number[]
}
