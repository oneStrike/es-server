import {
  BooleanProperty,
  DateProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { PageDto } from '@libs/platform/dto'
import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'
import { BaseAppUserCountDto } from './base-app-user-count.dto'
import { BaseAppUserDto } from './base-app-user.dto'

/** app 端提及候选检索字段。 */
class UserMentionQueryFilterDto {
  @StringProperty({
    description: '昵称关键字',
    example: '测试',
    required: false,
    maxLength: 100,
  })
  q?: string
}

/** app 端提及候选分页查询。 */
export class QueryUserMentionPageDto extends IntersectionType(
  PageDto,
  UserMentionQueryFilterDto,
) {}

/** 提及候选用户。 */
export class UserMentionCandidateDto extends PickType(BaseAppUserDto, [
  'id',
  'nickname',
  'avatarUrl',
] as const) {}

/** 更新本人资料。 */
export class UpdateMyProfileDto extends PartialType(
  PickType(BaseAppUserDto, [
    'nickname',
    'avatarUrl',
    'profileBackgroundImageUrl',
    'emailAddress',
    'genderType',
    'birthDate',
    'signature',
    'bio',
  ] as const),
) {}

/** 换绑手机号。 */
export class ChangeMyPhoneDto {
  @StringProperty({
    description: '当前已绑定手机号',
    example: '13800138000',
    required: true,
    maxLength: 20,
  })
  currentPhone!: string

  @StringProperty({
    description: '当前已绑定手机号验证码',
    example: '123456',
    required: true,
  })
  currentCode!: string

  @StringProperty({
    description: '新的手机号',
    example: '13900139000',
    required: true,
    maxLength: 20,
  })
  newPhone!: string

  @StringProperty({
    description: '新手机号验证码',
    example: '123456',
    required: true,
  })
  newCode!: string
}

/** 用户计数。 */
export class UserCountDto extends OmitType(BaseAppUserCountDto, [
  'userId',
  'createdAt',
  'updatedAt',
] as const) {}

/** 用户状态摘要。 */
export class UserStatusSummaryDto extends PickType(BaseAppUserDto, [
  'isEnabled',
  'status',
] as const) {
  @BooleanProperty({
    description: '账号是否可以登录',
    example: true,
    validation: false,
  })
  canLogin!: boolean

  @BooleanProperty({
    description: '用户是否可以发布主题',
    example: true,
    validation: false,
  })
  canPost!: boolean

  @BooleanProperty({
    description: '用户是否可以回复',
    example: true,
    validation: false,
  })
  canReply!: boolean

  @BooleanProperty({
    description: '用户是否可以点赞',
    example: true,
    validation: false,
  })
  canLike!: boolean

  @BooleanProperty({
    description: '用户是否可以收藏',
    example: true,
    validation: false,
  })
  canFavorite!: boolean

  @BooleanProperty({
    description: '用户是否可以关注',
    example: true,
    validation: false,
  })
  canFollow!: boolean

  @StringProperty({
    description: '限制原因',
    example: '违反平台规则。',
    nullable: true,
    validation: false,
  })
  reason!: string | null

  @DateProperty({
    description: '限制到期时间',
    example: '2026-03-08T10:00:00.000Z',
    nullable: true,
    validation: false,
  })
  until!: Date | null
}
