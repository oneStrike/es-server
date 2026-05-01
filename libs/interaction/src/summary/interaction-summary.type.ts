import type { AuditRoleEnum, SceneTypeEnum } from '@libs/platform/constant'
import type { CommentTargetTypeEnum } from '../comment/comment.constant'
import type { ReportTargetTypeEnum } from '../report/report.constant'
import type {
  InteractionActorSummaryDto,
  InteractionAppUserSummaryDto,
  InteractionCommentTargetSummaryDto,
  InteractionReplyCommentSummaryDto,
  InteractionReportCommentSummaryDto,
  InteractionReportTargetSummaryDto,
  InteractionSceneSummaryDto,
} from './dto/interaction-summary.dto'

/** 多态目标摘要查询键，供评论与举报读模型批量去重。 */
export interface InteractionTargetSummaryKey {
  targetType: number
  targetId: number
}

/** 业务场景摘要查询键，供举报读模型批量去重。 */
export interface InteractionSceneSummaryKey {
  sceneType: SceneTypeEnum | number
  sceneId: number
}

/** 审核人摘要查询键，按审核角色区分管理员与版主来源。 */
export interface InteractionAuditorSummaryKey {
  auditById?: number | null
  auditRole?: AuditRoleEnum | null
}

/** 摘要查询选项，列表默认轻量，详情可补充更多状态字段。 */
export interface InteractionSummaryQueryOptions {
  detail?: boolean
}

/** 评论目标摘要映射，key 由 targetType 与 targetId 组成。 */
export type InteractionCommentTargetSummaryMap = Map<
  string,
  InteractionCommentTargetSummaryDto
>

/** 举报目标摘要映射，key 由 targetType 与 targetId 组成。 */
export type InteractionReportTargetSummaryMap = Map<
  string,
  InteractionReportTargetSummaryDto
>

/** 业务场景摘要映射，key 由 sceneType 与 sceneId 组成。 */
export type InteractionSceneSummaryMap = Map<string, InteractionSceneSummaryDto>

/** 应用用户摘要映射，key 为 app_user.id。 */
export type InteractionAppUserSummaryMap = Map<
  number,
  InteractionAppUserSummaryDto
>

/** 管理/审核参与人摘要映射，key 为参与人来源与 ID。 */
export type InteractionActorSummaryMap = Map<string, InteractionActorSummaryDto>

/** 被回复评论摘要映射，key 为 user_comment.id。 */
export type InteractionReplyCommentSummaryMap = Map<
  number,
  InteractionReplyCommentSummaryDto
>

/** 举报评论摘要映射，key 为 user_comment.id。 */
export type InteractionReportCommentSummaryMap = Map<
  number,
  InteractionReportCommentSummaryDto
>

/** 评论目标类型的枚举值与作品类型配对。 */
export interface CommentWorkTargetTypePair {
  targetType: CommentTargetTypeEnum
  workType: number
}

/** 举报目标类型的枚举值与作品类型配对。 */
export interface ReportWorkTargetTypePair {
  targetType: ReportTargetTypeEnum
  workType: number
}
