import { NestedProperty } from '@libs/platform/decorators/validate/nested-property';
import { StringProperty } from '@libs/platform/decorators/validate/string-property';
import { TokenDto } from '@libs/platform/modules/auth/dto/auth-scene.dto'
import { CaptchaDto } from '@libs/platform/modules/captcha/dto/captcha.dto';
import { AdminUserResponseDto } from './admin-user.dto'

/**
 * 管理端登录入参 DTO。
 */
export class UserLoginDto extends CaptchaDto {
  @StringProperty({
    description: '用户名',
    example: 'admin001',
    required: true,
    maxLength: 20,
    minLength: 5,
  })
  username!: string

  @StringProperty({
    description: '密码',
    example: 'Aa@123456',
    required: true,
    password: true,
  })
  password!: string
}

/**
 * 管理端登录响应 DTO。
 */
export class LoginResponseDto {
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
    required: true,
    type: AdminUserResponseDto,
    validation: false,
    nullable: false,
  })
  user!: AdminUserResponseDto
}
