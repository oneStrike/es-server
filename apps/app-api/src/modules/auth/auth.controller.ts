import type { FastifyRequest } from 'fastify'
import { ApiDoc, CurrentUser, Public } from '@libs/base/decorators'
import { RsaService, SendVerifyCodeDto } from '@libs/base/modules'
import { JwtUserInfoInterface } from '@libs/base/types'
import { Body, Controller, Get, Post, Req } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { AuthService } from './auth.service'
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  LoginResponseDto,
  RefreshTokenDto,
  RsaPublicKeyDto,
  TokenDto,
} from './dto/auth.dto'

import { RevokeDeviceDto, UserDeviceDto } from './dto/device.dto'
import { PasswordService } from './password.service'
import { SmsService } from './sms.service'

@ApiTags('认证模块')
@Controller('app/auth')
export class AuthController {
  constructor(
    private readonly rsaService: RsaService,
    private readonly authService: AuthService,
    private readonly smsService: SmsService,
    private readonly passwordService: PasswordService,
  ) {}

  @Post('send-verify-code')
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

  @Get('public-key')
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

  @Post('refresh-token')
  @ApiDoc({
    summary: '刷新访问令牌',
    model: TokenDto,
  })
  @Public()
  async refreshToken(
    @Body() body: RefreshTokenDto,
    @Req() req: FastifyRequest,
  ) {
    return this.authService.refreshToken(body.refreshToken, req)
  }

  @Post('forgot-password')
  @ApiDoc({
    summary: '找回密码',
    model: LoginResponseDto,
  })
  @Public()
  async forgotPassword(@Body() body: ForgotPasswordDto) {
    return this.passwordService.forgotPassword(body)
  }

  @Post('change-password')
  @ApiDoc({
    summary: '修改密码',
    model: {
      type: 'boolean',
    },
  })
  async changePassword(
    @Body() body: ChangePasswordDto,
    @CurrentUser() user: JwtUserInfoInterface,
  ) {
    return this.passwordService.changePassword(user.sub, body)
  }

  @Get('devices')
  @ApiDoc({
    summary: '获取用户登录设备列表',
    model: UserDeviceDto,
    isArray: true,
  })
  async getDevices(@CurrentUser() user: JwtUserInfoInterface) {
    return this.authService.getUserDevices(user.sub)
  }

  @Post('revoke-device')
  @ApiDoc({
    summary: '撤销特定设备的登录',
    model: {
      type: 'boolean',
    },
  })
  async revokeDevice(
    @Body() body: RevokeDeviceDto,
    @CurrentUser() user: JwtUserInfoInterface,
  ) {
    return this.authService.revokeDevice(user.sub, body.tokenId)
  }
}
