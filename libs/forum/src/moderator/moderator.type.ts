import type { Db } from '@db/core'
import type {
  ForumModeratorApplicationSelect,
  ForumModeratorSectionSelect,
  ForumModeratorSelect,
  ForumSectionSelect,
} from '@db/schema'
import type { ForumModeratorLifecycleEventTypeEnum } from './moderator-lifecycle-log.constant'
import type {
  ForumModeratorPermissionEnum,
  ForumModeratorRoleTypeEnum,
} from './moderator.constant'

/**
 * 版主板块关联的最小行结构。
 * 仅用于写路径同步版主-板块作用域。
 */
export type ForumModeratorSectionScope = Pick<
  ForumModeratorSectionSelect,
  'sectionId' | 'permissions'
>

/**
 * 角色作用域归一化结果。
 * 供 create/update 路径共享最终落库参数，避免不同入口重复拼装角色约束。
 */
export interface NormalizedModeratorScope {
  roleType: ForumModeratorRoleTypeEnum
  groupId: number | null
  permissions: ForumModeratorPermissionEnum[]
  sectionIds: number[]
}

/**
 * 版主角色归一化所需的上下文。
 * 统一收口 create/update 场景的当前记录、事务客户端与板块作用域快照。
 */
export interface NormalizeModeratorScopeOptions {
  current?: Pick<
    ForumModeratorSelect,
    'id' | 'roleType' | 'groupId' | 'permissions' | 'isEnabled'
  >
  currentSectionIds?: number[]
  client?: Db
  isCreate?: boolean
}

/**
 * 分组版主数量上限校验参数。
 * 用于控制是否计入当前版主自身，以及禁用路径是否跳过上限检查。
 */
export interface ForumModeratorGroupLimitOptions {
  client?: Db
  excludeModeratorId?: number
  nextIsEnabled: boolean
}

/**
 * 版主治理 actor 类型。
 * admin 代表后台管理员，moderator 代表论坛版主。
 */
export type ForumModeratorGovernanceActorType = 'admin' | 'moderator'

/**
 * moderator governance 链路的调用人上下文。
 * 统一收口管理员与版主两类治理来源。
 */
export interface ForumModeratorGovernanceActor {
  actorType: ForumModeratorGovernanceActorType
  actorUserId: number
}

/**
 * 版主权限校验通过后的最小上下文。
 * 供治理服务复用 moderatorId、作用域板块和最终权限集。
 */
export interface ForumModeratorPermissionGrant {
  moderatorId: number
  moderatorUserId: number
  roleType: ForumModeratorRoleTypeEnum
  sectionId: number
  grantedPermissions: ForumModeratorPermissionEnum[]
}

/**
 * 版主操作日志写入载荷。
 * 统一约束 topic/comment 治理动作的日志字段来源。
 */
export interface ForumModeratorActionLogInput {
  moderatorId: number | null
  actorType?: ForumModeratorGovernanceActorType
  actorUserId?: number
  targetId: number
  actionType: number
  targetType: number
  actionDescription: string
  beforeData?: unknown
  afterData?: unknown
}

/** 版主任期生命周期日志写入入参，统一约束申请、任命、变更和移除日志字段。 */
export interface CreateForumModeratorLifecycleLogInput {
  eventType: ForumModeratorLifecycleEventTypeEnum
  moderatorId?: number | null
  applicationId?: number | null
  actorAdminUserId: number
  reason?: string | null
  beforeData?: unknown | null
  afterData?: unknown | null
}

/** 版主生命周期快照入参，承载生命周期日志所需的最小字段子集。 */
export type ModeratorLifecycleSnapshotInput = Pick<
  ForumModeratorSelect,
  | 'id'
  | 'userId'
  | 'groupId'
  | 'roleType'
  | 'permissions'
  | 'isEnabled'
  | 'remark'
  | 'deletedAt'
>

/** 版主板块视图入参，仅承载展示所需的板块 ID 和名称。 */
export type ModeratorSectionViewInput = Pick<
  ForumSectionSelect,
  'id' | 'name'
>

/** 版主申请快照入参，承载申请审核日志所需的最小字段子集。 */
export type ModeratorApplicationSnapshotInput = Pick<
  ForumModeratorApplicationSelect,
  | 'id'
  | 'applicantId'
  | 'sectionId'
  | 'status'
  | 'permissions'
  | 'reason'
  | 'auditReason'
  | 'remark'
  | 'auditById'
  | 'auditAt'
>
