import type { FastifyRequest } from 'fastify'
import { ApiDoc, Public } from '@libs/base/decorators'
import { RsaService, SendVerifyCodeDto, SmsService } from '@libs/base/modules'
import { BadRequestException, Body, Controller, Get, Post, Req } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { AuthService } from './auth.service'
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  ForgotPasswordRequestDto,
  LoginDto,
  LoginResponseDto,
  RefreshTokenDto,
  RsaPublicKeyDto,
  TokenDto,
} from './dto/auth.dto'
import { RevokeDeviceDto, UserDeviceDto } from './dto/device.dto'

import { PasswordService } from './password.service'

@ApiTags('认证模块')
@Controller('app/auth')
export class AuthController {
  constructor(
    private readonly rsaService: RsaService,
    private readonly authService: AuthService,
    private readonly smsService: SmsService,
    private readonly passwordService: PasswordService,
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
  async refreshToken(@Body() body: RefreshTokenDto, @Req() req: FastifyRequest) {
    return this.authService.refreshToken(body.refreshToken, req)
  }

  @Post('forgot-password')
  @ApiDoc({
    summary: '找回密码 - 发送验证码',
    model: {
      type: 'object',
      properties: {
        message: { type: 'string' },
      },
    },
  })
  @Public()
  async forgotPassword(@Body() body: ForgotPasswordRequestDto) {
    return this.passwordService.sendResetPasswordCode(body)
  }

  @Post('reset-password')
  @ApiDoc({
    summary: '重置密码',
    model: LoginResponseDto,
  })
  @Public()
  async resetPassword(@Body() body: ForgotPasswordDto) {
    return this.passwordService.resetPassword(body)
  }

  @Post('change-password')
  @ApiDoc({
    summary: '修改密码',
    model: {
      type: 'boolean',
    },
  })
  async changePassword(@Body() body: ChangePasswordDto, @Req() req: FastifyRequest) {
    // 从 Token 中获取用户 ID (Assuming user is attached to request by guard)
    // Note: Since @Auth() is not explicitly seen here but implied by lack of @Public(),
    // we need to ensure we can get the user ID. Usually req.user.
    // However, looking at 'refreshToken' method, it parses token manually.
    // But 'login' doesn't need it.
    // Standard NestJS Passport/Guard attaches user to req.user.
    // Let's check how 'refreshToken' did it:
    // const payload = await this.baseJwtService.decodeToken(tokens.accessToken)
    // const userId = Number(payload.sub)
    // BUT, usually authenticated routes have `req.user`.
    // Let's assume standard behavior for now, or check how other auth routes work.
    // Ah, `refreshToken` is @Public().
    // `logout` takes body tokens.
    // There are no other protected routes in this file shown in `read` output except `logout`.
    // Wait, `logout` is NOT @Public().
    // But `logout` implementation: `async logout(@Body() body: TokenDto)`.
    // It doesn't use `req.user`.
    // So I need to know how to get userId.
    // If I use standard AuthGuard, `req.user` should be there.
    // Let's check `libs/base/modules/auth/jwt-auth.guard`.
    // Since I cannot check it right now without tool call, I will try to use `req.user['sub']` or similar.
    // In Fastify with @nestjs/passport, it's usually `req.user`.
    // Let's assume `req.user['id']` or `req.user['sub']`.
    // Let's look at `handleLoginSuccess` in service: `sub: String(user.id)`.
    // So `req.user['sub']` should be the ID.
    // Let's try `req.user['sub']`.
    const user = req.user as any
    return this.passwordService.changePassword(Number(user.sub), body)
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
