import { DateProperty, EnumProperty, StringProperty } from '@libs/platform/decorators';

import { IdDto, PageDto } from '@libs/platform/dto';

import { UserStatusEnum } from '@libs/user/app-user.constant'
import { BaseAppUserDto } from '@libs/user/dto/base-app-user.dto';
import {
  IntersectionType,
  PartialType,
  PickType,
} from '@nestjs/swagger'

/**
 * 论坛场景下复用的 app_user 简要信息 DTO。
 */
export class ForumAppUserInfoDto extends PickType(BaseAppUserDto, [
  'id',
  'account',
  'nickname',
  'avatarUrl',
  'signature',
  'bio',
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

export class QueryUserProfileListDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseAppUserDto, ['nickname', 'levelId'] as const),
  ),
) {
  @EnumProperty({
    description: '用户状态（1=正常；2=禁言；3=永久禁言；4=封禁；5=永久封禁）',
    enum: UserStatusEnum,
    example: UserStatusEnum.NORMAL,
    required: false,
  })
  status?: UserStatusEnum
}

export class UpdateUserStatusDto extends IdDto {
  @EnumProperty({
    description: '用户状态（1=正常；2=禁言；3=永久禁言；4=封禁；5=永久封禁）',
    enum: UserStatusEnum,
    example: UserStatusEnum.BANNED,
  })
  status!: UserStatusEnum

  @StringProperty({
    description: '封禁原因',
    example: '违反社区规则',
    required: false,
    maxLength: 500,
  })
  banReason?: string

  @DateProperty({
    description: '封禁到期时间',
    example: '2026-05-01T00:00:00.000Z',
    required: false,
  })
  banUntil?: Date
}
