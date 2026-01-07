import {
  ValidateBoolean,
  ValidateEnum,
  ValidateNumber,
  ValidateString,
} from '@libs/base/decorators'
import { BaseDto, IdDto, OMIT_BASE_FIELDS, PageDto } from '@libs/base/dto'
import {
  ApiProperty,
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'
import { ForumAuditStatusEnum } from '../forum.constant'

/**
 * 主题信息DTO
 */
class TopicInfoDto {
  @ApiProperty({
    description: '主题ID',
    example: 1,
    required: true,
  })
  id!: number

  @ApiProperty({
    description: '主题标题',
    example: '如何使用NestJS开发API',
    required: true,
  })
  title!: string
}

/**
 * 用户信息DTO
 */
class UserInfoDto {
  @ApiProperty({
    description: '用户ID',
    example: 1,
    required: true,
  })
  id!: number

  @ApiProperty({
    description: '用户名',
    example: 'user123',
    required: true,
  })
  username!: string

  @ApiProperty({
    description: '昵称',
    example: '张三',
    required: true,
  })
  nickname!: string

  @ApiProperty({
    description: '头像',
    example: 'https://example.com/avatar.jpg',
    required: false,
  })
  avatar?: string
}

/**
 * 论坛回复基础DTO
 */
export class BaseForumReplyDto extends BaseDto {
  @ValidateString({
    description: '回复内容',
    example: '这是一个很好的问题...',
    required: true,
  })
  content!: string

  @ApiProperty({
    description: '关联的主题',
    required: true,
    type: TopicInfoDto,
  })
  topic!: TopicInfoDto

  @ApiProperty({
    description: '关联的用户',
    required: true,
    type: UserInfoDto,
  })
  user!: UserInfoDto

  @ValidateNumber({
    description: '回复楼层（从1开始）',
    example: 1,
    required: true,
    min: 1,
  })
  floor!: number

  @ApiProperty({
    description: '回复的回复ID（楼中楼）',
    example: 2,
    required: false,
  })
  replyToId?: number

  @ApiProperty({
    description: '回复的回复',
    required: false,
    type: BaseForumReplyDto,
  })
  replyTo?: BaseForumReplyDto

  @ValidateBoolean({
    description: '是否隐藏（待审核）',
    example: false,
    required: true,
    default: false,
  })
  isHidden!: boolean

  @ValidateEnum({
    description: '审核状态（0=待审核, 1=已通过, 2=已拒绝）',
    example: ForumAuditStatusEnum.APPROVED,
    required: true,
    enum: ForumAuditStatusEnum,
    default: ForumAuditStatusEnum.APPROVED,
  })
  auditStatus!: ForumAuditStatusEnum

  @ValidateNumber({
    description: '点赞数',
    example: 5,
    required: true,
    min: 0,
    default: 0,
  })
  likeCount!: number
}

/**
 * 创建论坛回复DTO
 */
export class CreateForumReplyDto extends OmitType(BaseForumReplyDto, [
  ...OMIT_BASE_FIELDS,
  'floor',
  'isHidden',
  'auditStatus',
  'likeCount',
  'topic',
  'profile',
  'replyTo',
]) {
  @ValidateNumber({
    description: '关联的主题ID',
    example: 1,
    required: true,
    min: 1,
  })
  topicId!: number

  @ValidateNumber({
    description: '回复的回复ID（楼中楼）',
    example: 2,
    required: false,
    min: 1,
  })
  replyToId?: number
}

/**
 * 更新论坛回复DTO
 */
export class UpdateForumReplyDto extends IntersectionType(
  PartialType(CreateForumReplyDto),
  IdDto,
) {
  @ValidateBoolean({
    description: '是否隐藏',
    example: true,
    required: false,
  })
  isHidden?: boolean

  @ValidateEnum({
    description: '审核状态',
    example: ForumAuditStatusEnum.APPROVED,
    required: false,
    enum: ForumAuditStatusEnum,
  })
  auditStatus?: ForumAuditStatusEnum
}

/**
 * 查询论坛回复DTO
 */
export class QueryForumReplyDto extends IntersectionType(
  PageDto,
  IntersectionType(
    PartialType(
      PickType(BaseForumReplyDto, [
        'content',
        'floor',
        'isHidden',
        'auditStatus',
        'likeCount',
      ]),
    ),
    PartialType(PickType(CreateForumReplyDto, ['topicId', 'replyToId'])),
  ),
) {}
