import {
  ValidateArray,
  ValidateBoolean,
  ValidateDate,
  ValidateEnum,
  ValidateJson,
  ValidateNumber,
  ValidateString,
} from '@libs/base/decorators'
import { BaseDto, IdDto, PageDto } from '@libs/base/dto'
import {
  ApiProperty,
  IntersectionType,
  PartialType,
  PickType,
} from '@nestjs/swagger'
import {
  ComicChapterCommentAuditRoleEnum,
  ComicChapterCommentAuditStatusEnum,
  ComicChapterCommentReportReasonEnum,
  ComicChapterCommentReportStatusEnum,
  ComicChapterCommentSortFieldEnum,
  ComicChapterCommentSortOrderEnum,
} from '../comic-chapter-comment.constant'

/**
 * 漫画章节评论基础DTO
 * 包含评论的核心字段与审核状态信息
 */
export class BaseComicChapterCommentDto extends BaseDto {
  @ValidateString({
    description: '评论内容',
    example: '这章太精彩了！',
    required: true,
  })
  content!: string

  @ValidateNumber({
    description: '关联的章节ID',
    example: 1,
    required: true,
    min: 1,
  })
  chapterId!: number

  @ValidateNumber({
    description: '评论用户ID',
    example: 1,
    required: true,
    min: 1,
  })
  userId!: number

  @ValidateNumber({
    description: '被回复评论ID（楼中楼）',
    example: 2,
    required: false,
  })
  replyToId?: number

  @ValidateNumber({
    description: '实际回复根评论ID（追溯链路）',
    example: 2,
    required: false,
  })
  actualReplyToId?: number

  @ValidateNumber({
    description: '楼层号（一级评论编号）',
    example: 1,
    required: false,
    min: 1,
  })
  floor?: number

  @ValidateBoolean({
    description: '是否隐藏',
    example: false,
    required: true,
    default: false,
  })
  isHidden!: boolean

  @ValidateEnum({
    description: '审核状态（0=待审核, 1=已通过, 2=已拒绝）',
    example: ComicChapterCommentAuditStatusEnum.APPROVED,
    required: true,
    enum: ComicChapterCommentAuditStatusEnum,
    default: ComicChapterCommentAuditStatusEnum.PENDING,
  })
  auditStatus!: ComicChapterCommentAuditStatusEnum

  @ValidateString({
    description: '审核拒绝原因',
    example: '内容包含敏感信息',
    required: false,
    maxLength: 500,
  })
  auditReason?: string

  @ValidateDate({
    description: '审核时间',
    example: '2024-01-01T00:00:00.000Z',
    required: false,
  })
  auditAt?: Date

  @ValidateNumber({
    description: '审核人ID',
    example: 1,
    required: false,
    min: 1,
  })
  auditById?: number

  @ValidateEnum({
    description: '审核角色（0=版主, 1=管理员）',
    example: ComicChapterCommentAuditRoleEnum.ADMIN,
    required: false,
    enum: ComicChapterCommentAuditRoleEnum,
  })
  auditRole?: ComicChapterCommentAuditRoleEnum

  @ValidateJson({
    description: '敏感词命中明细（JSON字符串）',
    example: '[{"word":"违规","level":"severe"}]',
    required: false,
  })
  sensitiveWordHits?: string
}

/**
 * 创建漫画章节评论DTO
 * 仅包含用户提交的必要字段
 */
export class CreateComicChapterCommentDto extends PickType(
  BaseComicChapterCommentDto,
  ['content', 'chapterId', 'replyToId'],
) {}

/**
 * 查询漫画章节评论DTO
 * 支持分页、筛选与排序
 */
export class QueryComicChapterCommentDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseComicChapterCommentDto, [
      'chapterId',
      'userId',
      'auditStatus',
      'isHidden',
      'floor',
    ]),
  ),
) {
  @ValidateString({
    description: '评论内容关键词',
    example: '精彩',
    required: false,
  })
  content?: string

  @ValidateEnum({
    description: '排序字段（floor=楼层号, createdAt=创建时间）',
    example: ComicChapterCommentSortFieldEnum.FLOOR,
    required: false,
    enum: ComicChapterCommentSortFieldEnum,
  })
  sortBy?: ComicChapterCommentSortFieldEnum

  @ValidateEnum({
    description: '排序方式（asc=升序, desc=降序）',
    example: ComicChapterCommentSortOrderEnum.DESC,
    required: false,
    enum: ComicChapterCommentSortOrderEnum,
  })
  sortOrder?: ComicChapterCommentSortOrderEnum
}

/**
 * 更新漫画章节评论审核DTO
 * 用于管理员审核评论内容
 */
export class UpdateComicChapterCommentAuditDto extends IntersectionType(
  IdDto,
  PickType(BaseComicChapterCommentDto, ['auditStatus', 'auditReason']),
) {}

/**
 * 更新漫画章节评论隐藏状态DTO
 * 用于管理员隐藏或展示评论
 */
export class UpdateComicChapterCommentHiddenDto extends IntersectionType(
  IdDto,
  PickType(BaseComicChapterCommentDto, ['isHidden']),
) {}

/**
 * 删除漫画章节评论DTO
 * 用户侧删除自己的评论
 */
export class DeleteComicChapterCommentDto extends IdDto {}

/**
 * 漫画章节评论用户信息DTO
 * 用于返回评论作者的基础信息
 */
export class ComicChapterCommentUserDto {
  @ValidateNumber({
    description: '用户ID',
    example: 1,
    required: true,
  })
  id!: number

  @ValidateString({
    description: '用户昵称',
    example: '张三',
    required: true,
  })
  nickname!: string

  @ValidateString({
    description: '用户头像',
    example: 'https://example.com/avatar.jpg',
    required: false,
  })
  avatar?: string
}

/**
 * 漫画章节评论被回复对象DTO
 * 用于展示楼中楼的被回复信息
 */
export class ComicChapterCommentReplyToDto {
  @ValidateNumber({
    description: '评论ID',
    example: 1,
    required: true,
  })
  id!: number

  @ValidateNumber({
    description: '被回复用户ID',
    example: 2,
    required: true,
  })
  userId!: number

  @ValidateString({
    description: '被回复用户昵称',
    example: '李四',
    required: true,
  })
  nickname!: string

  @ValidateString({
    description: '被回复用户头像',
    example: 'https://example.com/avatar.jpg',
    required: false,
  })
  avatar?: string
}

/**
 * 漫画章节评论子回复DTO
 * 用于楼中楼的子级展示
 */
export class ComicChapterCommentChildDto extends BaseComicChapterCommentDto {
  @ApiProperty({
    description: '评论用户信息',
    type: ComicChapterCommentUserDto,
  })
  user!: ComicChapterCommentUserDto

  @ApiProperty({
    description: '被回复对象信息',
    type: ComicChapterCommentReplyToDto,
    required: false,
  })
  replyTo?: ComicChapterCommentReplyToDto
}

/**
 * 漫画章节评论响应DTO
 * 包含评论作者与子评论信息
 */
export class ComicChapterCommentDto extends BaseComicChapterCommentDto {
  @ApiProperty({
    description: '评论用户信息',
    type: ComicChapterCommentUserDto,
  })
  user!: ComicChapterCommentUserDto

  @ApiProperty({
    description: '被回复对象信息',
    type: ComicChapterCommentReplyToDto,
    required: false,
  })
  replyTo?: ComicChapterCommentReplyToDto

  @ValidateArray({
    description: '子评论列表',
    required: false,
    itemType: 'object',
    example: [],
  })
  children?: ComicChapterCommentChildDto[]
}

/**
 * 漫画章节评论举报基础DTO
 * 包含举报的核心字段定义
 */
export class BaseComicChapterCommentReportDto extends BaseDto {
  @ValidateNumber({
    description: '举报人用户ID',
    example: 1,
    required: true,
    min: 1,
  })
  reporterId!: number

  @ValidateNumber({
    description: '被举报评论ID',
    example: 1,
    required: true,
    min: 1,
  })
  commentId!: number

  @ValidateEnum({
    description: '举报原因',
    example: ComicChapterCommentReportReasonEnum.INAPPROPRIATE_CONTENT,
    required: true,
    enum: ComicChapterCommentReportReasonEnum,
  })
  reason!: ComicChapterCommentReportReasonEnum

  @ValidateString({
    description: '举报详细说明',
    example: '该评论包含不当言论',
    required: false,
  })
  description?: string

  @ValidateString({
    description: '证据截图URL',
    example: 'https://example.com/evidence.png',
    required: false,
  })
  evidenceUrl?: string

  @ValidateEnum({
    description: '处理状态',
    example: ComicChapterCommentReportStatusEnum.PENDING,
    required: false,
    enum: ComicChapterCommentReportStatusEnum,
  })
  status?: ComicChapterCommentReportStatusEnum

  @ValidateNumber({
    description: '处理人ID',
    example: 1,
    required: false,
    min: 1,
  })
  handlerId?: number

  @ValidateString({
    description: '处理结果说明',
    example: '已删除违规评论',
    required: false,
  })
  handlingNote?: string

  @ValidateDate({
    description: '处理时间',
    example: '2025-01-01T12:00:00.000Z',
    required: false,
  })
  handledAt?: Date
}

/**
 * 创建漫画章节评论举报DTO
 */
export class CreateComicChapterCommentReportDto extends PickType(
  BaseComicChapterCommentReportDto,
  ['reporterId', 'commentId', 'reason', 'description', 'evidenceUrl'],
) {}

/**
 * 查询漫画章节评论举报DTO
 */
export class QueryComicChapterCommentReportDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseComicChapterCommentReportDto, [
      'commentId',
      'reason',
      'status',
      'reporterId',
    ]),
  ),
) {}

/**
 * 更新漫画章节评论举报状态DTO
 */
export class UpdateComicChapterCommentReportStatusDto extends PickType(
  BaseComicChapterCommentReportDto,
  ['id', 'status', 'handlerId', 'handlingNote'],
) {}

/**
 * 处理漫画章节评论举报DTO
 */
export class HandleComicChapterCommentReportDto extends IntersectionType(
  PickType(BaseComicChapterCommentReportDto, ['id']),
  PartialType(
    PickType(BaseComicChapterCommentReportDto, [
      'status',
      'handlerId',
      'handlingNote',
    ]),
  ),
) {}
