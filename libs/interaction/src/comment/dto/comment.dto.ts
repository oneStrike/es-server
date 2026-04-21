import type { JsonValue } from '@libs/platform/utils/jsonParse'
import {
  AuditRoleEnum,
  AuditStatusEnum,
} from '@libs/platform/constant/audit.constant'
import { ArrayProperty } from '@libs/platform/decorators/validate/array-property'
import { BooleanProperty } from '@libs/platform/decorators/validate/boolean-property'
import { DateProperty } from '@libs/platform/decorators/validate/date-property'
import { EnumProperty } from '@libs/platform/decorators/validate/enum-property'
import { JsonProperty } from '@libs/platform/decorators/validate/json-property'
import { NestedProperty } from '@libs/platform/decorators/validate/nested-property'
import { NumberProperty } from '@libs/platform/decorators/validate/number-property'
import { StringProperty } from '@libs/platform/decorators/validate/string-property'
import { BaseDto, IdDto } from '@libs/platform/dto/base.dto'
import { PageDto } from '@libs/platform/dto/page.dto'
import { BaseSensitiveWordHitDto } from '@libs/sensitive-word/dto/sensitive-word.dto'
import { BaseAppUserDto } from '@libs/user/dto/base-app-user.dto'
import { IntersectionType, PartialType, PickType } from '@nestjs/swagger'
import {
  MentionDraftDto,
  RequiredMentionDraftListDto,
} from '../../mention/dto/mention.dto'
import { CommentSortTypeEnum, CommentTargetTypeEnum } from '../comment.constant'

export class BaseCommentDto extends BaseDto {
  @EnumProperty({
    description:
      '目标类型（1=漫画作品；2=小说作品；3=漫画章节；4=小说章节；5=论坛主题）',
    enum: CommentTargetTypeEnum,
    example: CommentTargetTypeEnum.COMIC,
    required: true,
  })
  targetType!: CommentTargetTypeEnum

  @NumberProperty({
    description: '目标 ID',
    example: 1,
    required: true,
    min: 1,
  })
  targetId!: number

  @NumberProperty({
    description: '评论用户 ID',
    example: 1,
    required: true,
    min: 1,
  })
  userId!: number

  @StringProperty({
    description: '评论内容',
    example: '写得很棒',
    required: true,
    minLength: 1,
    maxLength: 2000,
  })
  content!: string

  @JsonProperty({
    description: '评论正文解析 token（表情与提及混合输出）',
    required: false,
    validation: false,
    example: [
      { type: 'text', text: 'hello ' },
      {
        type: 'mentionUser',
        userId: 9,
        nickname: '测试用户',
        text: '@测试用户',
      },
      {
        type: 'emojiCustom',
        emojiAssetId: 1001,
        shortcode: 'smile',
        packCode: 'default',
        imageUrl: 'https://cdn.example.com/emoji/smile.gif',
        isAnimated: true,
      },
    ],
  })
  bodyTokens?: JsonValue | null

  @ArrayProperty({
    description: '结构化提及列表，仅写入时使用',
    required: false,
    itemClass: MentionDraftDto,
    contract: false,
  })
  mentions?: MentionDraftDto[]

  @NumberProperty({
    description: '楼层号',
    example: 1,
    required: false,
    min: 1,
  })
  floor?: number | null

  @NumberProperty({
    description: '回复的评论 ID',
    example: 1,
    required: false,
    min: 1,
  })
  replyToId?: number | null

  @NumberProperty({
    description: '实际回复的根评论 ID',
    example: 1,
    required: false,
    min: 1,
  })
  actualReplyToId?: number | null

  @BooleanProperty({
    description: '是否隐藏',
    example: false,
    required: true,
    default: false,
  })
  isHidden!: boolean

  @EnumProperty({
    description: '审核状态（0=待审核；1=已通过；2=已拒绝）',
    enum: AuditStatusEnum,
    example: AuditStatusEnum.APPROVED,
    required: true,
    default: AuditStatusEnum.APPROVED,
  })
  auditStatus!: AuditStatusEnum

  @NumberProperty({
    description: '审核人 ID',
    example: 1,
    required: false,
    min: 1,
  })
  auditById?: number | null

  @EnumProperty({
    description: '审核角色（0=版主；1=管理员）',
    enum: AuditRoleEnum,
    example: AuditRoleEnum.ADMIN,
    required: false,
  })
  auditRole?: AuditRoleEnum | null

  @StringProperty({
    description: '审核原因',
    example: '违反社区规范',
    required: false,
    maxLength: 500,
  })
  auditReason?: string | null

  @DateProperty({
    description: '审核时间',
    example: '2024-01-01T00:00:00.000Z',
    required: false,
  })
  auditAt?: Date | null

  @NumberProperty({
    description: '点赞数',
    example: 0,
    required: true,
    default: 0,
  })
  likeCount!: number

  @ArrayProperty({
    description: '敏感词命中记录',
    itemClass: BaseSensitiveWordHitDto,
    required: false,
  })
  sensitiveWordHits?: BaseSensitiveWordHitDto[] | null

  @StringProperty({
    description: '评论提交时解析到的国家/地区',
    example: '中国',
    required: false,
    maxLength: 100,
    validation: false,
  })
  geoCountry?: string

  @StringProperty({
    description: '评论提交时解析到的省份/州',
    example: '广东省',
    required: false,
    maxLength: 100,
    validation: false,
  })
  geoProvince?: string

  @StringProperty({
    description: '评论提交时解析到的城市',
    example: '深圳市',
    required: false,
    maxLength: 100,
    validation: false,
  })
  geoCity?: string

  @StringProperty({
    description: '评论提交时解析到的网络运营商',
    example: '电信',
    required: false,
    maxLength: 100,
    validation: false,
  })
  geoIsp?: string

  @StringProperty({
    description: '属地解析来源',
    example: 'ip2region',
    required: false,
    maxLength: 50,
    validation: false,
    contract: false,
  })
  geoSource?: string

  @DateProperty({
    description: '删除时间',
    example: '2026-03-27T00:00:00.000Z',
    required: false,
    validation: false,
    contract: false,
  })
  deletedAt?: Date | null
}

export class CommentIdDto {
  @NumberProperty({
    description: '评论 ID',
    example: 1,
    required: true,
    min: 1,
  })
  commentId!: number
}

export class CommentTargetDto {
  @NumberProperty({
    description: '目标 ID',
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
}

export class ReplyTargetDto {
  @NumberProperty({
    description: '回复的评论 ID',
    example: 1,
    required: true,
    min: 1,
  })
  replyToId!: number
}

export class CommentWritableFieldsDto extends IntersectionType(
  PickType(BaseCommentDto, ['content'] as const),
  RequiredMentionDraftListDto,
) {}

export class CreateCommentBodyDto extends IntersectionType(
  CommentTargetDto,
  CommentWritableFieldsDto,
) {}

export class ReplyCommentBodyDto extends IntersectionType(
  ReplyTargetDto,
  CommentWritableFieldsDto,
) {}

export class CommentSortDto {
  @EnumProperty({
    description: '排序类型（latest=最新，hot=最热）',
    enum: CommentSortTypeEnum,
    example: CommentSortTypeEnum.LATEST,
    required: false,
  })
  sort?: CommentSortTypeEnum
}

export class CommentOnlyAuthorDto {
  @BooleanProperty({
    description: '是否仅查看主题作者的评论；仅论坛主题评论场景生效',
    example: false,
    required: false,
  })
  onlyAuthor?: boolean
}

export class QueryMyCommentPageDto extends IntersectionType(
  PageDto,
  PartialType(CommentSortDto),
  PartialType(CommentTargetDto),
  PickType(PartialType(BaseCommentDto), ['auditStatus'] as const),
) {}

export class QueryCommentRepliesDto extends IntersectionType(
  PageDto,
  CommentIdDto,
  PartialType(CommentSortDto),
  PartialType(CommentOnlyAuthorDto),
) {}

export class QueryTargetCommentsDto extends IntersectionType(
  PageDto,
  CommentTargetDto,
  PartialType(CommentSortDto),
  PartialType(CommentOnlyAuthorDto),
) {
  @NumberProperty({
    description: '预览回复数量上限',
    example: 3,
    required: false,
    min: 0,
    contract: false,
    validation: false,
  })
  previewReplyLimit?: number

  @NumberProperty({
    description: '当前用户ID；为空表示匿名访问，仅用于补充点赞状态。',
    example: 1,
    required: false,
    min: 1,
    contract: false,
    validation: false,
  })
  userId?: number
}

export class QueryAdminCommentPageDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseCommentDto, [
      'id',
      'userId',
      'targetType',
      'targetId',
      'replyToId',
      'actualReplyToId',
      'auditStatus',
      'isHidden',
    ] as const),
  ),
) {
  @StringProperty({
    description: '关键词搜索（评论内容）',
    example: '写得很棒',
    required: false,
    maxLength: 200,
  })
  keyword?: string
}

export class UpdateAdminCommentAuditStatusDto extends IntersectionType(
  IdDto,
  PickType(BaseCommentDto, ['auditStatus', 'auditReason'] as const),
) {
  @NumberProperty({
    description: '审核人ID；由后台上下文注入。',
    example: 1,
    required: false,
    min: 1,
    contract: false,
    validation: false,
  })
  auditById?: number
}

export class UpdateAdminCommentHiddenDto extends IntersectionType(
  IdDto,
  PickType(BaseCommentDto, ['isHidden'] as const),
) {}

/**
 * 评论用户精简信息 DTO。
 */
export class CommentUserDto extends PickType(BaseAppUserDto, [
  'id',
  'nickname',
  'avatarUrl',
] as const) {}

/**
 * 用户侧评论被回复目标 DTO。
 */
export class CommentReplyTargetDto extends PickType(BaseCommentDto, [
  'id',
  'userId',
] as const) {
  @NestedProperty({
    description: '被回复用户',
    required: false,
    nullable: false,
    type: CommentUserDto,
    validation: false,
  })
  user!: CommentUserDto
}

/**
 * 评论回复分页项 DTO。
 */
export class CommentReplyItemDto extends PickType(BaseCommentDto, [
  'id',
  'targetType',
  'targetId',
  'userId',
  'content',
  'bodyTokens',
  'floor',
  'replyToId',
  'likeCount',
  'geoCountry',
  'geoProvince',
  'geoCity',
  'geoIsp',
  'createdAt',
] as const) {
  @BooleanProperty({
    description: '当前用户是否已点赞该回复',
    example: false,
    required: true,
    validation: false,
  })
  liked!: boolean

  @BooleanProperty({
    description: '当前回复是否为主题作者发表；非论坛主题场景固定为 false',
    example: false,
    required: true,
    validation: false,
  })
  isAuthorComment!: boolean

  @NestedProperty({
    description: '回复用户',
    required: false,
    nullable: false,
    type: CommentUserDto,
    validation: false,
  })
  user!: CommentUserDto

  @NestedProperty({
    description: '被回复目标简要信息',
    required: false,
    nullable: false,
    type: CommentReplyTargetDto,
    validation: false,
  })
  replyTo?: CommentReplyTargetDto
}

class BaseCommentReplyViewDto extends PickType(CommentReplyItemDto, [
  'liked',
  'isAuthorComment',
  'user',
  'replyTo',
] as const) {}

/**
 * 一级评论下的回复预览 DTO。
 */
export class CommentPreviewReplyDto extends IntersectionType(
  PickType(BaseCommentDto, [
    'id',
    'userId',
    'content',
    'bodyTokens',
    'replyToId',
    'likeCount',
    'geoCountry',
    'geoProvince',
    'geoCity',
    'geoIsp',
    'createdAt',
  ] as const),
  BaseCommentReplyViewDto,
) {}

/**
 * 目标评论分页项 DTO。
 */
export class TargetCommentItemDto extends PickType(BaseCommentDto, [
  'id',
  'targetType',
  'targetId',
  'userId',
  'content',
  'bodyTokens',
  'floor',
  'likeCount',
  'geoCountry',
  'geoProvince',
  'geoCity',
  'geoIsp',
  'createdAt',
] as const) {
  @NestedProperty({
    description: '评论用户',
    required: false,
    nullable: false,
    type: CommentUserDto,
    validation: false,
  })
  user!: CommentUserDto

  @BooleanProperty({
    description: '当前用户是否已点赞该评论',
    example: true,
    required: true,
    validation: false,
  })
  liked!: boolean

  @BooleanProperty({
    description: '当前评论是否为主题作者发表；非论坛主题场景固定为 false',
    example: false,
    required: true,
    validation: false,
  })
  isAuthorComment!: boolean

  @NumberProperty({
    description: '楼中楼回复总数',
    required: true,
    validation: false,
    example: 12,
  })
  replyCount!: number

  @ArrayProperty({
    description: '楼中楼预览（最多3条）',
    itemClass: CommentPreviewReplyDto,
    required: true,
    validation: false,
  })
  previewReplies!: CommentPreviewReplyDto[]

  @BooleanProperty({
    description: '是否还有更多楼中楼回复',
    required: true,
    validation: false,
    example: true,
  })
  hasMoreReplies!: boolean
}

/**
 * 我的评论分页项 DTO。
 */
export class MyCommentPageItemDto extends PickType(BaseCommentDto, [
  'id',
  'targetType',
  'targetId',
  'userId',
  'content',
  'bodyTokens',
  'floor',
  'replyToId',
  'actualReplyToId',
  'isHidden',
  'auditStatus',
  'auditById',
  'auditRole',
  'auditReason',
  'auditAt',
  'likeCount',
  'sensitiveWordHits',
  'geoCountry',
  'geoProvince',
  'geoCity',
  'geoIsp',
  'deletedAt',
  'createdAt',
  'updatedAt',
] as const) {
  @NestedProperty({
    description: '被回复目标简要信息',
    required: false,
    nullable: false,
    type: CommentReplyTargetDto,
    validation: false,
  })
  replyTo?: CommentReplyTargetDto
}

export class AdminCommentUserDto extends PickType(BaseAppUserDto, [
  'id',
  'nickname',
  'avatarUrl',
  'isEnabled',
  'status',
] as const) {}

export class AdminCommentReplyTargetDto extends PickType(BaseCommentDto, [
  'id',
  'userId',
  'content',
  'replyToId',
  'actualReplyToId',
  'auditStatus',
  'isHidden',
  'deletedAt',
  'createdAt',
] as const) {
  @NestedProperty({
    description: '被回复评论的作者信息',
    required: false,
    nullable: false,
    type: AdminCommentUserDto,
    validation: false,
  })
  user!: AdminCommentUserDto
}

export class AdminCommentPageItemDto extends PickType(BaseCommentDto, [
  'id',
  'targetType',
  'targetId',
  'userId',
  'content',
  'bodyTokens',
  'floor',
  'replyToId',
  'actualReplyToId',
  'isHidden',
  'auditStatus',
  'auditById',
  'auditRole',
  'auditReason',
  'auditAt',
  'likeCount',
  'sensitiveWordHits',
  'createdAt',
  'updatedAt',
] as const) {
  @NestedProperty({
    description: '评论作者信息',
    required: false,
    nullable: false,
    type: AdminCommentUserDto,
    validation: false,
  })
  user!: AdminCommentUserDto
}

export class AdminCommentDetailDto extends PickType(BaseCommentDto, [
  'id',
  'targetType',
  'targetId',
  'userId',
  'content',
  'bodyTokens',
  'floor',
  'replyToId',
  'actualReplyToId',
  'isHidden',
  'auditStatus',
  'auditById',
  'auditRole',
  'auditReason',
  'auditAt',
  'likeCount',
  'sensitiveWordHits',
  'createdAt',
  'updatedAt',
  'deletedAt',
] as const) {
  @NestedProperty({
    description: '评论作者信息',
    required: false,
    nullable: false,
    type: AdminCommentUserDto,
    validation: false,
  })
  user!: AdminCommentUserDto

  @NestedProperty({
    description: '被回复评论简要信息',
    required: false,
    nullable: false,
    type: AdminCommentReplyTargetDto,
    validation: false,
  })
  replyTo!: AdminCommentReplyTargetDto
}
