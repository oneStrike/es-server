import { BaseAdminUserDto } from '@libs/identity/dto/admin-user.dto'
import {
  AuditStatusEnum,
  CommentLevelEnum,
  SceneTypeEnum,
} from '@libs/platform/constant'
import {
  BooleanProperty,
  DateProperty,
  EnumProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { UserStatusEnum } from '@libs/user/app-user.constant'
import { BaseAppUserDto } from '@libs/user/dto/base-app-user.dto'
import { PickType } from '@nestjs/swagger'
import { CommentTargetTypeEnum } from '../../comment/comment.constant'
import { ReportTargetTypeEnum } from '../../report/report.constant'

/**
 * 应用用户展示摘要 DTO。
 */
export class InteractionAppUserSummaryDto extends PickType(BaseAppUserDto, [
  'id',
  'nickname',
  'avatarUrl',
  'status',
  'isEnabled',
] as const) {}

/**
 * 管理/审核参与人展示摘要 DTO。
 */
export class InteractionActorSummaryDto extends PickType(BaseAdminUserDto, [
  'id',
  'username',
  'avatar',
] as const) {
  @StringProperty({
    description: '昵称；管理员默认使用用户名兜底',
    required: false,
    maxLength: 100,
  })
  nickname?: string | null

  @StringProperty({
    description: '角色名称',
    example: '普通管理员',
    required: false,
    maxLength: 20,
  })
  roleName?: string | null
}

/**
 * 评论目标展示摘要 DTO。
 */
export class InteractionCommentTargetSummaryDto {
  @NumberProperty({
    description: '评论目标 ID',
    example: 1,
    required: true,
    min: 1,
  })
  targetId!: number

  @EnumProperty({
    description:
      '评论目标类型（1=漫画作品；2=小说作品；3=漫画章节；4=小说章节；5=论坛主题）',
    enum: CommentTargetTypeEnum,
    example: CommentTargetTypeEnum.COMIC,
    required: true,
  })
  targetType!: CommentTargetTypeEnum

  @StringProperty({
    description: '评论目标类型名称',
    example: '漫画作品',
    required: true,
    maxLength: 20,
  })
  targetTypeName!: string

  @StringProperty({
    description: '目标标题',
    example: '第一话 出发',
    required: false,
    maxLength: 200,
  })
  title?: string | null

  @StringProperty({
    description: '目标名称',
    example: '进击的巨人',
    required: false,
    maxLength: 100,
  })
  name?: string | null

  @StringProperty({
    description: '章节所属作品名称',
    example: '进击的巨人',
    required: false,
    maxLength: 100,
  })
  workName?: string | null

  @StringProperty({
    description: '论坛主题所属板块名称',
    example: '综合讨论',
    required: false,
    maxLength: 100,
  })
  sectionName?: string | null

  @BooleanProperty({
    description: '目标是否隐藏',
    required: false,
  })
  isHidden?: boolean | null

  @EnumProperty({
    description: '目标审核状态（0=待审核；1=已通过；2=已拒绝）',
    enum: AuditStatusEnum,
    example: AuditStatusEnum.APPROVED,
    required: false,
  })
  auditStatus?: AuditStatusEnum | null

  @DateProperty({
    description: '目标删除时间',
    required: false,
  })
  deletedAt?: Date | null
}

/**
 * 被回复评论展示摘要 DTO。
 */
export class InteractionReplyCommentSummaryDto {
  @NumberProperty({
    description: '被回复评论 ID',
    example: 1,
    required: true,
    min: 1,
  })
  commentId!: number

  @StringProperty({
    description: '被回复评论内容摘要',
    example: '这段内容很精彩',
    required: false,
    maxLength: 50,
  })
  contentExcerpt?: string | null

  @StringProperty({
    description: '被回复评论用户昵称',
    example: '张三',
    required: false,
    maxLength: 100,
  })
  userNickname?: string | null

  @StringProperty({
    description: '被回复评论用户头像 URL',
    example: 'https://example.com/avatar.png',
    required: false,
    maxLength: 500,
  })
  userAvatarUrl?: string | null

  @EnumProperty({
    description:
      '被回复评论用户状态（1=正常；2=禁言；3=永久禁言；4=封禁；5=永久封禁）',
    enum: UserStatusEnum,
    example: UserStatusEnum.NORMAL,
    required: false,
  })
  userStatus?: UserStatusEnum | null

  @BooleanProperty({
    description: '被回复评论用户是否启用',
    required: false,
  })
  userIsEnabled?: boolean | null

  @EnumProperty({
    description: '被回复评论审核状态（0=待审核；1=已通过；2=已拒绝）',
    enum: AuditStatusEnum,
    example: AuditStatusEnum.APPROVED,
    required: true,
  })
  auditStatus!: AuditStatusEnum

  @BooleanProperty({
    description: '被回复评论是否隐藏',
    required: true,
  })
  isHidden!: boolean
}

/**
 * 举报目标展示摘要 DTO。
 */
export class InteractionReportTargetSummaryDto {
  @NumberProperty({
    description: '举报目标 ID',
    example: 1,
    required: true,
    min: 1,
  })
  targetId!: number

  @EnumProperty({
    description:
      '举报目标类型（1=漫画作品；2=小说作品；3=漫画章节；4=小说章节；5=论坛主题；6=评论；7=用户）',
    enum: ReportTargetTypeEnum,
    example: ReportTargetTypeEnum.COMIC,
    required: true,
  })
  targetType!: ReportTargetTypeEnum

  @StringProperty({
    description: '举报目标类型名称',
    example: '漫画作品',
    required: true,
    maxLength: 20,
  })
  targetTypeName!: string

  @StringProperty({
    description: '举报目标标题',
    example: '第一话 出发',
    required: false,
    maxLength: 200,
  })
  title?: string | null

  @StringProperty({
    description: '举报目标名称',
    example: '进击的巨人',
    required: false,
    maxLength: 100,
  })
  name?: string | null

  @StringProperty({
    description: '举报评论内容摘要',
    example: '这条评论包含不当内容',
    required: false,
    maxLength: 50,
  })
  contentExcerpt?: string | null

  @StringProperty({
    description: '章节所属作品名称',
    example: '进击的巨人',
    required: false,
    maxLength: 100,
  })
  workName?: string | null

  @StringProperty({
    description: '作者昵称',
    example: '张三',
    required: false,
    maxLength: 100,
  })
  authorNickname?: string | null

  @StringProperty({
    description: '作者头像 URL',
    example: 'https://example.com/avatar.png',
    required: false,
    maxLength: 500,
  })
  authorAvatarUrl?: string | null

  @BooleanProperty({
    description: '目标是否隐藏',
    required: false,
  })
  isHidden?: boolean | null

  @EnumProperty({
    description: '目标审核状态（0=待审核；1=已通过；2=已拒绝）',
    enum: AuditStatusEnum,
    example: AuditStatusEnum.APPROVED,
    required: false,
  })
  auditStatus?: AuditStatusEnum | null

  @BooleanProperty({
    description: '目标用户是否启用',
    required: false,
  })
  isEnabled?: boolean | null

  @EnumProperty({
    description:
      '目标用户状态（1=正常；2=禁言；3=永久禁言；4=封禁；5=永久封禁）',
    enum: UserStatusEnum,
    example: UserStatusEnum.NORMAL,
    required: false,
  })
  status?: UserStatusEnum | null

  @DateProperty({
    description: '目标删除时间',
    required: false,
  })
  deletedAt?: Date | null
}

/**
 * 举报业务场景展示摘要 DTO。
 */
export class InteractionSceneSummaryDto {
  @NumberProperty({
    description: '业务场景 ID',
    example: 1,
    required: true,
    min: 1,
  })
  sceneId!: number

  @EnumProperty({
    description:
      '业务场景类型（1=漫画作品；2=小说作品；3=论坛主题；10=漫画章节；11=小说章节；12=用户主页）',
    enum: SceneTypeEnum,
    example: SceneTypeEnum.COMIC_WORK,
    required: true,
  })
  sceneType!: SceneTypeEnum

  @StringProperty({
    description: '业务场景类型名称',
    example: '漫画作品',
    required: true,
    maxLength: 20,
  })
  sceneTypeName!: string

  @StringProperty({
    description: '业务场景标题',
    example: '第一话 出发',
    required: false,
    maxLength: 200,
  })
  title?: string | null

  @StringProperty({
    description: '业务场景名称',
    example: '进击的巨人',
    required: false,
    maxLength: 100,
  })
  name?: string | null

  @StringProperty({
    description: '业务场景所属上级名称',
    example: '综合讨论',
    required: false,
    maxLength: 100,
  })
  parentName?: string | null
}

/**
 * 被举报评论展示摘要 DTO。
 */
export class InteractionReportCommentSummaryDto {
  @NumberProperty({
    description: '评论 ID',
    example: 1,
    required: true,
    min: 1,
  })
  commentId!: number

  @StringProperty({
    description: '评论内容摘要',
    example: '这条评论包含不当内容',
    required: false,
    maxLength: 50,
  })
  contentExcerpt?: string | null

  @EnumProperty({
    description: '评论层级（1=根评论；2=回复评论）',
    enum: CommentLevelEnum,
    example: CommentLevelEnum.ROOT,
    required: true,
  })
  commentLevel!: CommentLevelEnum

  @BooleanProperty({
    description: '评论是否隐藏',
    required: true,
  })
  isHidden!: boolean

  @EnumProperty({
    description: '评论审核状态（0=待审核；1=已通过；2=已拒绝）',
    enum: AuditStatusEnum,
    example: AuditStatusEnum.APPROVED,
    required: true,
  })
  auditStatus!: AuditStatusEnum

  @StringProperty({
    description: '评论用户昵称',
    example: '张三',
    required: false,
    maxLength: 100,
  })
  userNickname?: string | null

  @StringProperty({
    description: '评论用户头像 URL',
    example: 'https://example.com/avatar.png',
    required: false,
    maxLength: 500,
  })
  userAvatarUrl?: string | null

  @EnumProperty({
    description:
      '评论用户状态（1=正常；2=禁言；3=永久禁言；4=封禁；5=永久封禁）',
    enum: UserStatusEnum,
    example: UserStatusEnum.NORMAL,
    required: false,
  })
  userStatus?: UserStatusEnum | null

  @BooleanProperty({
    description: '评论用户是否启用',
    required: false,
  })
  userIsEnabled?: boolean | null
}
