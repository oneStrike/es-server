import { NestedProperty, NumberProperty } from '@libs/platform/decorators'
import { TokenDto } from '@libs/platform/modules/auth/dto'
import { BaseAppUserDto } from '@libs/user/dto/base-app-user.dto'
import { PickType } from '@nestjs/swagger'

/** 应用登录后用于客户端初始化的身份快照。 */
export class AppAuthUserDto extends PickType(BaseAppUserDto, [
  'id',
  'account',
  'phoneNumber',
  'nickname',
  'avatarUrl',
  'profileBackgroundImageUrl',
  'emailAddress',
  'genderType',
  'birthDate',
  'signature',
  'bio',
  'status',
  'isEnabled',
] as const) {
  @NumberProperty({ description: '当前积分', example: 120, validation: false })
  points!: number

  @NumberProperty({
    description: '当前经验值',
    example: 350,
    validation: false,
  })
  experience!: number
}

/** 应用登录响应。 */
export class AppLoginResponseDto {
  @NestedProperty({
    description: '令牌信息',
    type: TokenDto,
    required: true,
    validation: false,
    nullable: false,
  })
  tokens!: TokenDto

  @NestedProperty({
    description: '用户信息',
    type: AppAuthUserDto,
    required: true,
    validation: false,
    nullable: false,
  })
  user!: AppAuthUserDto
}
