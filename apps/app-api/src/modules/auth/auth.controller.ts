import type { FastifyRequest } from 'fastify'
import { ApiDoc, Public } from '@libs/base/decorators'
import { RsaService } from '@libs/base/modules'
import { Body, Controller, Get, Post, Req } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { AuthService } from './auth.service'
import {
  ForgotPasswordDto,
  ForgotPasswordResponseDto,
  LoginDto,
  LoginResponseDto,
  RefreshTokenDto,
  RegisterDto,
  RegisterResponseDto,
  ResetPasswordDto,
  RsaPublicKeyDto,
  TokenDto,
} from './dto/auth.dto'

@ApiTags('认证模块')
@Controller('app/auth')
export class AuthController {
  constructor(
    private readonly rsaService: RsaService,
    private readonly authService: AuthService,
  ) {}

  @Post('register')
  @ApiDoc({
    summary: '用户注册',
    model: RegisterResponseDto,
  })
  @Public()
  async register(@Body() body: RegisterDto, @Req() req: FastifyRequest) {
    return this.authService.register(body, req)
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
    summary: '用户登出',
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
    model: ForgotPasswordResponseDto,
  })
  @Public()
  async forgotPassword(@Body() body: ForgotPasswordDto) {
    return this.authService.forgotPassword(body)
  }

  @Post('reset-password')
  @ApiDoc({
    summary: '重置密码',
    model: {
      type: 'boolean',
    },
  })
  @Public()
  async resetPassword(@Body() body: ResetPasswordDto) {
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
}
