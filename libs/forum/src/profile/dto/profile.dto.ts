import { IdDto, PageDto } from '@libs/platform/dto'
import { BaseAppUserDto } from '@libs/user/dto/base-app-user.dto'
import { IntersectionType, PartialType, PickType } from '@nestjs/swagger'

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
    PickType(BaseAppUserDto, ['nickname', 'levelId', 'status'] as const),
  ),
) {}

export class UpdateUserStatusDto extends IntersectionType(
  IdDto,
  IntersectionType(
    PickType(BaseAppUserDto, ['status'] as const),
    PartialType(PickType(BaseAppUserDto, ['banReason', 'banUntil'] as const)),
  ),
) {}
