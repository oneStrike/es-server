import {
  BaseAppUserDto,
} from '@libs/user/core'
import { PickType } from '@nestjs/swagger'

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
