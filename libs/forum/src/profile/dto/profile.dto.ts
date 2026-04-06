import { UserStatusEnum } from '@libs/platform/constant/user.constant';
import { DateProperty } from '@libs/platform/decorators/validate/date-property';
import { EnumProperty } from '@libs/platform/decorators/validate/enum-property';
import { StringProperty } from '@libs/platform/decorators/validate/string-property';
import { IdDto } from '@libs/platform/dto/base.dto';
import { PageDto } from '@libs/platform/dto/page.dto';
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
    description: '用户状态',
    enum: UserStatusEnum,
    example: UserStatusEnum.NORMAL,
    required: false,
  })
  status?: UserStatusEnum
}

export class UpdateUserStatusDto extends IdDto {
  @EnumProperty({
    description: '用户状态',
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
