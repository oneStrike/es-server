import type { BaseUserAssetsSummaryDto } from '@libs/interaction/user-assets/dto/user-assets.dto'
import type { UserCenterTaskDto, UserCountDto } from '@libs/user/dto/user-self.dto'

/** 用户中心计数部分字段，用于读模型到 DTO 的兜底映射。 */
export type UserCountPartial = Partial<UserCountDto>

/** 用户资产摘要部分字段，用于读模型到 DTO 的兜底映射。 */
export type UserAssetsSummaryPartial = Partial<BaseUserAssetsSummaryDto>

/** 用户中心任务摘要部分字段，用于读模型到 DTO 的兜底映射。 */
export type UserCenterTaskPartial = Partial<UserCenterTaskDto>
