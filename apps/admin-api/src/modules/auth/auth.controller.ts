import type { FastifyRequest } from 'fastify/fastify'
import { ApiDoc, Public } from '@libs/base/decorators'
import { CaptchaDto, RsaService } from '@libs/base/modules'
import { ActionTypeEnum } from '@libs/base/types'
import { Body, Controller, Get, Post, Req } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { Audit } from '../../common/decorators/audit.decorator'
import { AuthService } from './auth.service'
import {
  LoginResponseDto,
  RefreshTokenDto,
  RsaPublicKeyDto,
  TokenDto,
  UserLoginDto,
} from './dto/auth.dto'

/**
 * 管理端认证控制器
 * 提供登录、登出、令牌刷新、验证码等认证相关接口
 */
@ApiTags('管理端认证模块')
@Controller('admin/auth')
export class AuthController {
  constructor(
    private readonly rsaService: RsaService,
    private readonly authService: AuthService,
  ) {}

  /**
   * 获取验证码接口
   */
  @Get('captcha')
  @ApiDoc({
    summary: '获取验证码',
    model: CaptchaDto,
  })
  @Public()
  async getCaptcha() {
    return this.authService.getCaptcha()
  }

  /**
   * 用户登录接口
   */
  @Post('login')
  @ApiDoc({
    summary: '管理员登录',
    model: LoginResponseDto,
  })
  @Public()
  @Audit({
    actionType: ActionTypeEnum.LOGIN,
    content: '用户登录',
  })
  async login(@Body() body: UserLoginDto, @Req() req: FastifyRequest) {
    return this.authService.login(body, req)
  }

  /**
   * 管理员登出接口
   */
  @Post('logout')
  @ApiDoc({
    summary: '管理员登出',
    model: {
      type: 'boolean',
    },
  })
  async logout(@Body() body: TokenDto) {
    return this.authService.logout(body)
  }

  /**
   * 刷新访问令牌接口
   * 使用刷新令牌获取新的访问令牌
   * @param body 包含刷新令牌的请求体
   * @returns 新的访问令牌及有效期
   */
  @Post('refresh-token')
  @ApiDoc({
    summary: '刷新访问令牌',
    model: TokenDto,
  })
  @Public()
  async refreshToken(@Body() body: RefreshTokenDto) {
    return this.authService.refreshToken(body)
  }

  /**
   * 获取Admin专用RSA公钥
   * 前端可以使用此公钥对管理员敏感数据进行加密
   * @returns Admin RSA公钥
   */
  @Get('public-key')
  @ApiDoc({
    summary: '获取Admin专用RSA公钥',
    model: RsaPublicKeyDto,
  })
  @Public()
  getAdminPublicKey() {
    return {
      publicKey: this.rsaService.getPublicKey(),
    }
  }
}
