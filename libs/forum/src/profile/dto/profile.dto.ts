import {
  DateProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { BaseDto } from '@libs/platform/dto'
import { BaseAppUserDto } from '@libs/user'
import { PickType } from '@nestjs/swagger'

/**
 * 论坛场景下复用的 app_user 简要信息 DTO。
 */
export class ForumAppUserInfoDto extends PickType(BaseAppUserDto, [
  'id',
  'account',
  'nickname',
  'avatarUrl',
  'phoneNumber',
  'emailAddress',
  'isEnabled',
  'genderType',
  'birthDate',
  'lastLoginAt',
  'lastLoginIp',
  'createdAt',
  'updatedAt',
] as const) {}

/**
 * 论坛用户画像基础 DTO。
 * 严格对应 forum_profile 表字段。
 */
export class BaseForumProfileDto extends BaseDto {
  @NumberProperty({
    description: '用户ID',
    example: 1,
    required: true,
  })
  userId!: number

  @StringProperty({
    description: '签名',
    example: '这是我的签名',
    required: false,
    maxLength: 200,
  })
  signature?: string

  @StringProperty({
    description: '个人简介',
    example: '这是我的个人简介',
    required: false,
    maxLength: 500,
  })
  bio?: string

  @NumberProperty({
    description: '主题数',
    default: 0,
    example: 10,
    validation: false,
  })
  topicCount!: number

  @NumberProperty({
    description: '回复数',
    default: 0,
    example: 100,
    validation: false,
  })
  replyCount!: number

  @NumberProperty({
    description: '点赞数',
    default: 0,
    example: 5,
    validation: false,
  })
  likeCount!: number

  @NumberProperty({
    description: '收藏数',
    default: 0,
    example: 5,
    validation: false,
  })
  favoriteCount!: number

  @DateProperty({
    description: '删除时间',
    example: '2024-01-01T00:00:00.000Z',
    required: false,
    validation: false,
  })
  deletedAt?: Date | null
}
