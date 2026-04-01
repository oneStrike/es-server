import { AuditRoleEnum, AuditStatusEnum } from '@libs/platform/constant'
import {
  ArrayProperty,
  BooleanProperty,
  DateProperty,
  EnumProperty,
  JsonProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { BaseDto } from '@libs/platform/dto'
import { CommentTargetTypeEnum } from '../comment.constant'

export class BaseCommentDto extends BaseDto {
  @EnumProperty({
    description: '目标类型',
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
    description: '评论正文解析 token（EmojiParser 输出）',
    required: false,
    validation: false,
    example: [
      { type: 'text', text: 'hello ' },
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
  bodyTokens?: unknown | null

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
    description: '审核状态',
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
    description: '审核角色（0=版主, 1=管理员）',
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
    itemType: 'string',
    example: ['敏感词1'],
    required: false,
  })
  sensitiveWordHits?: unknown | null

  @DateProperty({
    description: '删除时间',
    example: '2024-01-01T00:00:00.000Z',
    required: false,
  })
  deletedAt?: Date | null
}
