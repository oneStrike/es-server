import type { FastifyRequest } from 'fastify'
import { LoginResponseDto, UserLoginDto } from '@libs/identity/core'
import { ApiDoc, Public } from '@libs/platform/decorators'
import { CaptchaDto, RsaService } from '@libs/platform/modules'
import { RefreshTokenDto, RsaPublicKeyDto, TokenDto } from '@libs/platform/modules/auth'
import { Body, Controller, Get, Post, Req } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { Audit } from '../../common/decorators/audit.decorator'
import { AuditActionTypeEnum } from '../system/audit/audit.constant'
import { AuthService } from './auth.service'

/**
 * 管理端认证控制器
 * 提供登录、登出、令牌刷新、验证码等认证相关接口
 */
@ApiTags('认证与账号/管理员认证')
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
    actionType: AuditActionTypeEnum.LOGIN,
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
  @Audit({
    actionType: AuditActionTypeEnum.LOGOUT,
    content: '管理员退出登录',
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
  @Post('token/refresh')
  @ApiDoc({
    summary: '刷新访问令牌',
    model: TokenDto,
  })
  @Public()
  async refreshToken(@Body() body: RefreshTokenDto, @Req() req: FastifyRequest) {
    return this.authService.refreshToken(body, req)
  }

  /**
   * 获取Admin专用RSA公钥
   * 前端可以使用此公钥对管理员敏感数据进行加密
   * @returns Admin RSA公钥
   */
  @Get('key/public')
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
