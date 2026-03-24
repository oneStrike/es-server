import { AuditRoleEnum, AuditStatusEnum } from '@libs/platform/constant'
import {
  ArrayProperty,
  BooleanProperty,
  DateProperty,
  EnumProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { BaseDto } from '@libs/platform/dto'
import { BaseSensitiveWordHitDto } from '@libs/sensitive-word'

/**
 * 论坛主题基础 DTO。
 * 当前供 admin/app 控制器按字段组合复用。
 */
export class BaseForumTopicDto extends BaseDto {
  @StringProperty({
    description: '主题标题',
    example: '如何学习TypeScript？',
    required: true,
    maxLength: 200,
  })
  title!: string

  @StringProperty({
    description: '主题内容',
    example: '我想学习TypeScript，有什么好的学习资源推荐吗？',
    required: true,
  })
  content!: string

  @NumberProperty({
    description: '关联的板块ID',
    example: 1,
    required: true,
    min: 1,
  })
  sectionId!: number

  @NumberProperty({
    description: '用户ID',
    example: 1,
    required: true,
    min: 1,
  })
  userId!: number

  @BooleanProperty({
    description: '是否置顶',
    example: false,
    required: true,
    default: false,
  })
  isPinned!: boolean

  @BooleanProperty({
    description: '是否精华',
    example: false,
    required: true,
    default: false,
  })
  isFeatured!: boolean

  @BooleanProperty({
    description: '是否锁定',
    example: false,
    required: true,
    default: false,
  })
  isLocked!: boolean

  @BooleanProperty({
    description: '是否隐藏',
    example: false,
    required: true,
    default: false,
  })
  isHidden!: boolean

  @EnumProperty({
    description: '审核角色（0=版主, 1=管理员）',
    example: AuditRoleEnum.MODERATOR,
    required: false,
    enum: AuditRoleEnum,
    default: AuditRoleEnum.MODERATOR,
  })
  auditRole?: AuditRoleEnum

  @NumberProperty({
    description: '关联的审核用户ID',
    example: 1,
    required: false,
    min: 1,
  })
  auditById?: number

  @EnumProperty({
    description: '审核状态（0=待审核, 1=已通过, 2=已拒绝）',
    example: AuditStatusEnum.APPROVED,
    required: true,
    enum: AuditStatusEnum,
    default: AuditStatusEnum.APPROVED,
  })
  auditStatus!: AuditStatusEnum

  @StringProperty({
    description: '审核拒绝原因',
    example: '内容包含敏感信息',
    required: false,
    maxLength: 500,
  })
  auditReason?: string

  @DateProperty({
    description: '审核时间',
    example: '2024-01-01T00:00:00.000Z',
    required: false,
    validation: false,
  })
  auditAt?: Date

  @NumberProperty({
    description: '浏览次数',
    example: 100,
    required: true,
    default: 0,
    validation: false,
  })
  viewCount!: number

  @NumberProperty({
    description: '点赞次数',
    example: 5,
    required: true,
    default: 0,
    validation: false,
  })
  likeCount!: number

  @NumberProperty({
    description: '评论次数',
    example: 10,
    required: true,
    default: 0,
    validation: false,
  })
  commentCount!: number

  @NumberProperty({
    description: '收藏次数',
    example: 5,
    required: true,
    default: 0,
    validation: false,
  })
  favoriteCount!: number

  @NumberProperty({
    description: '乐观锁版本号',
    example: 0,
    required: true,
    default: 0,
    validation: false,
  })
  version!: number

  @ArrayProperty({
    description: '敏感词命中记录',
    itemClass: BaseSensitiveWordHitDto,
    itemType: 'object',
    required: false,
    validation: false,
  })
  sensitiveWordHits?: BaseSensitiveWordHitDto[]

  @DateProperty({
    description: '最后评论时间',
    example: '2024-01-01T00:00:00.000Z',
    required: false,
    validation: false,
  })
  lastCommentAt?: Date

  @NumberProperty({
    description: '最后评论用户ID',
    example: 2,
    required: false,
  })
  lastCommentUserId?: number

  @DateProperty({
    description: '删除时间',
    example: '2024-01-01T00:00:00.000Z',
    required: false,
    validation: false,
  })
  deletedAt?: Date | null
}
