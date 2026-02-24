import { ValidateBoolean, ValidateDate, ValidateEnum, ValidateNumber, ValidateString } from '@libs/base/decorators'
import { BaseDto, IdDto, OMIT_BASE_FIELDS, PageDto } from '@libs/base/dto'
import { IntersectionType, OmitType, PartialType, PickType } from '@nestjs/swagger'
import {
  WorkCommentAuditStatusEnum,
  WorkCommentReportStatusEnum,
  WorkCommentSortFieldEnum,
  WorkCommentSortOrderEnum,
} from '../work-comment.constant'

/// 评论基础DTO
export class BaseWorkCommentDto extends BaseDto {
  @ValidateNumber({
    description: '作品ID',
    example: 1,
    required: true,
  })
  workId!: number

  @ValidateNumber({
    description: '作品类型（1=漫画, 2=小说）',
    example: 1,
    required: true,
  })
  workType!: number

  @ValidateNumber({
    description: '章节ID（为空表示作品评论）',
    example: 1,
    required: false,
  })
  chapterId?: number

  @ValidateNumber({
    description: '评论用户ID',
    example: 1,
    required: true,
  })
  userId!: number

  @ValidateString({
    description: '评论内容',
    example: '这是一条评论',
    required: true,
  })
  content!: string

  @ValidateNumber({
    description: '被回复评论ID',
    example: 1,
    required: false,
  })
  replyToId?: number

  @ValidateNumber({
    description: '实际回复根评论ID',
    example: 1,
    required: false,
  })
  actualReplyToId?: number

  @ValidateNumber({
    description: '楼层号',
    example: 1,
    required: false,
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
    description: '审核状态',
    example: WorkCommentAuditStatusEnum.APPROVED,
    required: true,
    enum: WorkCommentAuditStatusEnum,
    default: WorkCommentAuditStatusEnum.APPROVED,
  })
  auditStatus!: WorkCommentAuditStatusEnum

  @ValidateString({
    description: '审核原因',
    example: '内容违规',
    required: false,
    maxLength: 500,
  })
  auditReason?: string

  @ValidateDate({
    description: '审核时间',
    example: '2024-01-01',
    required: false,
  })
  auditAt?: Date

  @ValidateNumber({
    description: '审核人ID',
    example: 1,
    required: false,
  })
  auditById?: number

  @ValidateNumber({
    description: '审核角色',
    example: 1,
    required: false,
  })
  auditRole?: number
}

/// 创建评论DTO
export class CreateWorkCommentDto extends OmitType(BaseWorkCommentDto, [
  ...OMIT_BASE_FIELDS,
  'userId',
  'floor',
  'isHidden',
  'auditStatus',
  'auditReason',
  'auditAt',
  'auditById',
  'auditRole',
]) {}

/// 查询评论DTO
export class QueryWorkCommentDto extends IntersectionType(
  PageDto,
  PickType(PartialType(BaseWorkCommentDto), [
    'workId',
    'workType',
    'chapterId',
    'userId',
    'auditStatus',
    'isHidden',
    'floor',
  ]),
) {
  @ValidateString({
    description: '评论内容',
    example: '评论',
    required: false,
  })
  content?: string

  @ValidateEnum({
    description: '排序字段',
    example: WorkCommentSortFieldEnum.CREATED_AT,
    required: false,
    enum: WorkCommentSortFieldEnum,
    default: WorkCommentSortFieldEnum.CREATED_AT,
  })
  sortBy?: WorkCommentSortFieldEnum

  @ValidateEnum({
    description: '排序顺序',
    example: WorkCommentSortOrderEnum.DESC,
    required: false,
    enum: WorkCommentSortOrderEnum,
    default: WorkCommentSortOrderEnum.DESC,
  })
  sortOrder?: WorkCommentSortOrderEnum
}

/// 更新评论审核DTO
export class UpdateWorkCommentAuditDto extends IntersectionType(
  IdDto,
  PickType(BaseWorkCommentDto, ['auditStatus', 'auditReason']),
) {}

/// 更新评论隐藏状态DTO
export class UpdateWorkCommentHiddenDto extends IntersectionType(
  IdDto,
  PickType(BaseWorkCommentDto, ['isHidden']),
) {}

/// 创建评论举报DTO
export class CreateWorkCommentReportDto {
  @ValidateNumber({
    description: '评论ID',
    example: 1,
    required: true,
  })
  commentId!: number

  @ValidateString({
    description: '举报原因',
    example: 'spam',
    required: true,
    maxLength: 50,
  })
  reason!: string

  @ValidateString({
    description: '举报说明',
    example: '这是一条垃圾评论',
    required: false,
    maxLength: 500,
  })
  description?: string

  @ValidateString({
    description: '证据截图URL',
    example: 'https://example.com/evidence.jpg',
    required: false,
    maxLength: 500,
  })
  evidenceUrl?: string
}

/// 查询评论举报DTO
export class QueryWorkCommentReportDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(CreateWorkCommentReportDto, ['commentId', 'reason']),
  ),
) {
  @ValidateNumber({
    description: '举报人ID',
    example: 1,
    required: false,
  })
  reporterId?: number

  @ValidateEnum({
    description: '处理状态',
    example: WorkCommentReportStatusEnum.PENDING,
    required: false,
    enum: WorkCommentReportStatusEnum,
  })
  status?: WorkCommentReportStatusEnum
}

/// 处理评论举报DTO
export class HandleWorkCommentReportDto extends IdDto {
  @ValidateEnum({
    description: '处理状态',
    example: WorkCommentReportStatusEnum.RESOLVED,
    required: false,
    enum: WorkCommentReportStatusEnum,
  })
  status?: WorkCommentReportStatusEnum

  @ValidateString({
    description: '处理备注',
    example: '已处理',
    required: false,
    maxLength: 500,
  })
  handlingNote?: string
}
