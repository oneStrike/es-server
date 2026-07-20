import type { FastifyRequest } from 'fastify'
import { ApiDoc, CurrentUser, Public } from '@libs/platform/decorators'

import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  RefreshTokenDto,
  RsaPublicKeyDto,
  TokenDto,
} from '@libs/platform/modules/auth/dto'
import { RsaService } from '@libs/platform/modules/crypto/rsa.service'
import { GeoService } from '@libs/platform/modules/geo/geo.service'
import { SendVerifyCodeDto } from '@libs/platform/modules/sms/dto'
import { extractIpAddress } from '@libs/platform/utils'
import { Body, Controller, Get, Post, Req } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { AuthService } from './auth.service'
import { AppLoginResponseDto } from './dto/app-auth.dto'
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
    private readonly geoService: GeoService,
  ) {}

  @Post('verify-code/send')
  @ApiDoc({
    summary: '发送验证码',
    model: {
      type: 'boolean',
    },
  })
  @Public()
  // 公开发送验证码入口，记录请求 IP 供短信服务做风控与频控。
  async sendVerifyCode(
    @Body() body: SendVerifyCodeDto,
    @Req() req: FastifyRequest,
  ) {
    return this.smsService.sendVerifyCode(body, extractIpAddress(req))
  }

  @Get('key/public')
  @ApiDoc({
    summary: '获取RSA公钥',
    model: RsaPublicKeyDto,
  })
  @Public()
  // 向客户端暴露当前 RSA 公钥，用于登录等敏感字段加密。
  getPublicKey() {
    return {
      publicKey: this.rsaService.getPublicKey(),
    }
  }

  @Post('login')
  @ApiDoc({
    summary: '用户登录',
    model: AppLoginResponseDto,
  })
  @Public()
  // APP 登录入口，补齐客户端请求环境后交给认证服务签发会话。
  async login(@Body() body: LoginDto, @Req() req: FastifyRequest) {
    return this.authService.login(
      body,
      await this.geoService.buildClientRequestContext(req),
    )
  }

  @Post('logout')
  @ApiDoc({
    summary: '用户退出登录',
    model: {
      type: 'boolean',
    },
  })
  // 注销指定 token，会撤销会话并让后续校验命中无效状态。
  async logout(@Body() body: TokenDto) {
    return this.authService.logout(body)
  }

  @Post('token/refresh')
  @ApiDoc({
    summary: '刷新访问令牌',
    model: TokenDto,
  })
  @Public()
  // 使用 refresh token 换发新会话，客户端环境用于记录新 token 来源。
  async refreshToken(
    @Body() body: RefreshTokenDto,
    @Req() req: FastifyRequest,
  ) {
    return this.authService.refreshToken(
      body,
      await this.geoService.buildClientRequestContext(req),
    )
  }

  @Post('password/forgot')
  @ApiDoc({
    summary: '找回密码',
    model: Boolean,
  })
  @Public()
  // 找回密码入口，校验/重置后撤销旧会话，并对不存在手机号统一返回成功以防枚举。
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
  // 已登录用户修改自身密码，用户身份只取当前访问令牌主体。
  async changePassword(
    @Body() body: ChangePasswordDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.passwordService.changePassword(userId, body)
  }
}
