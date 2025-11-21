import { ValidateString } from '@libs/decorators'
import { ApiProperty, PickType } from '@nestjs/swagger'
import { TokenDto } from './token.dto'

/**
 * 用户基础 DTO（仅用于登录）
 */
export class UserBaseDto {
  @ValidateString({
    description: '用户名',
    example: 'admin001',
    required: true,
    maxLength: 20,
    minLength: 5,
  })
  username!: string
}

/**
 * 用户登录 DTO
 */
export class UserLoginDto extends PickType(UserBaseDto, ['username']) {
  @ValidateString({
    description: '密码',
    example: 'Aa@123456',
    required: true,
  })
  password!: string

  @ValidateString({
    description: '验证码',
    example: '1234',
    required: true,
  })
  captcha!: string

  @ValidateString({
    description: '验证码ID',
    example: 'a1b2c3d4',
    required: true,
  })
  captchaId!: string
}

/**
 * 登录响应 DTO
 */
export class LoginResponseDto {
  @ApiProperty({
    description: '令牌信息',
    type: TokenDto,
    required: true,
  })
  tokens: TokenDto

  @ApiProperty({
    description: '用户信息',
    required: true,
  })
  user: any
}
