import type { FastifyRequest } from 'fastify'
import { ApiDoc, Public } from '@libs/base/decorators'
import { RsaService, SendVerifyCodeDto, SmsService } from '@libs/base/modules'
import { BadRequestException, Body, Controller, Get, Post, Req } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { AuthService } from './auth.service'
import {
  ForgotPasswordDto,
  LoginDto,
  LoginResponseDto,
  RefreshTokenDto,
  RsaPublicKeyDto,
  TokenDto,
} from './dto/auth.dto'
import { RevokeDeviceDto, UserDeviceDto } from './dto/device.dto'

@ApiTags('认证模块')
@Controller('app/auth')
export class AuthController {
  constructor(
    private readonly rsaService: RsaService,
    private readonly authService: AuthService,
    private readonly smsService: SmsService,
  ) { }

  @Post('send-verify-code')
  @ApiDoc({
    summary: '发送验证码',
    model: {
      type: 'boolean',
    },
  })
  @Public()
  async sendVerifyCode(@Body() body: SendVerifyCodeDto) {
    return this.smsService.sendSmsRequest(body)
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
    return this.authService.logout(body.accessToken, body.refreshToken)
  }

  @Post('refresh-token')
  @ApiDoc({
    summary: '刷新访问令牌',
    model: TokenDto,
  })
  @Public()
  async refreshToken(@Body() body: RefreshTokenDto) {
    return this.authService.refreshToken(body.refreshToken)
  }

  @Post('forgot-password')
  @ApiDoc({
    summary: '找回密码',
    model: LoginResponseDto,
  })
  @Public()
  async forgotPassword(@Body() body: ForgotPasswordDto) {
    return this.authService.forgotPassword(body)
  }

  @Post('reset-password')
  @ApiDoc({
    summary: '重置密码',
    model: LoginResponseDto,
  })
  @Public()
  async resetPassword(@Body() body: ForgotPasswordDto) {
    return this.authService.resetPassword(body)
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

  @Get('devices')
  @ApiDoc({
    summary: '获取用户登录设备列表',
    model: [UserDeviceDto],
  })
  async getDevices(@Req() req: FastifyRequest) {
    const userId = (req as any).user?.sub
    if (!userId) {
      throw new BadRequestException('用户未登录')
    }
    return this.authService.getUserDevices(Number(userId))
  }

  @Post('revoke-device')
  @ApiDoc({
    summary: '撤销特定设备的登录',
    model: {
      type: 'boolean',
    },
  })
  async revokeDevice(@Body() body: RevokeDeviceDto, @Req() req: FastifyRequest) {
    const userId = (req as any).user?.sub
    if (!userId) {
      throw new BadRequestException('用户未登录')
    }
    return this.authService.revokeDevice(Number(userId), body.tokenId)
  }
}
