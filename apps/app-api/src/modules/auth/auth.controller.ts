import type { FastifyRequest } from 'fastify'
import { ApiDoc, CurrentUser, Public } from '@libs/platform/decorators'
import { RsaService, SendVerifyCodeDto } from '@libs/platform/modules'
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  LoginResponseDto,
  RefreshTokenDto,
  RsaPublicKeyDto,
  TokenDto,
} from '@libs/platform/modules/auth'
import { Body, Controller, Get, Post, Req } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { AuthService } from './auth.service'
import { PasswordService } from './password.service'
import { SmsService } from './sms.service'

@ApiTags('认证')
@Controller('app/auth')
export class AuthController {
  constructor(
    private readonly rsaService: RsaService,
    private readonly authService: AuthService,
    private readonly smsService: SmsService,
    private readonly passwordService: PasswordService,
  ) {}

  @Post('verify-code/send')
  @ApiDoc({
    summary: '发送验证码',
    model: {
      type: 'boolean',
    },
  })
  @Public()
  async sendVerifyCode(@Body() body: SendVerifyCodeDto) {
    return this.smsService.sendVerifyCode(body)
  }

  @Get('key/public')
  @ApiDoc({
    summary: '获取RSA公钥',
    model: RsaPublicKeyDto,
  })
  @Public()
  getPublicKey() {
    return {
      publicKey: this.rsaService.getPublicKey(),
    }
  }

  @Post('login')
  @ApiDoc({
    summary: '用户登录',
    model: LoginResponseDto,
  })
  @Public()
  async login(@Body() body: LoginDto, @Req() req: FastifyRequest) {
    return this.authService.login(body, req)
  }

  @Post('logout')
  @ApiDoc({
    summary: '用户退出登录',
    model: {
      type: 'boolean',
    },
  })
  async logout(@Body() body: TokenDto) {
    return this.authService.logout(body)
  }

  @Post('token/refresh')
  @ApiDoc({
    summary: '刷新访问令牌',
    model: TokenDto,
  })
  @Public()
  async refreshToken(
    @Body() body: RefreshTokenDto,
    @Req() req: FastifyRequest,
  ) {
    return this.authService.refreshToken(body, req)
  }

  @Post('password/forgot')
  @ApiDoc({
    summary: '找回密码',
    model: LoginResponseDto,
  })
  @Public()
  async forgotPassword(@Body() body: ForgotPasswordDto) {
    return this.passwordService.forgotPassword(body)
  }

  @Post('password/change')
  @ApiDoc({
    summary: '修改密码',
    model: {
      type: 'boolean',
    },
  })
  async changePassword(
    @Body() body: ChangePasswordDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.passwordService.changePassword(userId, body)
  }
}
