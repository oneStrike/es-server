import type { UserLikeSelect } from '@db/schema'
import type { LikeTargetTypeEnum } from './like.constant'

/**
 * 点赞目标入参。
 * - 统一约束目标类型与目标ID组合
 */
export type LikeTargetInput = Pick<UserLikeSelect, 'targetId'> & {
  targetType: LikeTargetTypeEnum
}

/**
 * 点赞记录入参。
 * - 在目标入参基础上补齐用户ID
 */
export type LikeRecordInput = LikeTargetInput & Pick<UserLikeSelect, 'userId'>

/**
 * 用户点赞列表查询入参。
 * - 固定包含用户与目标类型
 * - 分页参数与 PageDto 语义保持一致
 */
export type LikeListQuery = Pick<LikeRecordInput, 'userId' | 'targetType'> & {
  pageIndex?: number
  pageSize?: number
}
