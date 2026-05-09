import type { Db } from '@db/core'
import type { UserContentEntitlementInsert } from '@db/schema'
import type {
  ContentEntitlementGrantSourceEnum,
  ContentEntitlementTargetTypeEnum,
} from './content-entitlement.constant'

/**
 * 内容权益查询目标。
 * 供权限、购买、券和广告链路统一表达“哪个内容被授权”。
 */
export interface ContentEntitlementTarget {
  userId: number
  targetType: ContentEntitlementTargetTypeEnum
  targetId: number
}

/**
 * 内容权益写入命令。
 * 购买、券和广告链路通过该结构写入授权事实。
 */
export interface GrantContentEntitlementInput extends ContentEntitlementTarget {
  grantSource: ContentEntitlementGrantSourceEnum
  sourceId?: number
  sourceKey?: string
  startsAt?: Date
  expiresAt?: Date
  grantSnapshot?: UserContentEntitlementInsert['grantSnapshot']
}

/**
 * 购买权益写入命令。
 * 只服务章节购买成功后的永久授权事实写入。
 */
export interface GrantPurchaseEntitlementInput extends ContentEntitlementTarget {
  sourceId: number
  grantSnapshot?: UserContentEntitlementInsert['grantSnapshot']
}

/**
 * 内容权益事务上下文。
 * 购买、券和广告链路需要把权益写入纳入同一个业务事务。
 */
export type ContentEntitlementTx = Db
