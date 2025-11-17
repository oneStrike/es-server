import { Body, Controller, Get, Post, Req } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { FastifyRequest } from 'fastify'
import { ApiDoc } from '@/decorators/api-doc.decorator'
import { Public } from '@/decorators/public.decorator'
import { RsaService } from '@/modules/system/crypto/rsa.service'
import { AdminAuthService } from './auth.service'
import { CaptchaDto } from './dto/captcha.dto'
import { RsaPublicKeyDto } from './dto/rsa-public-key.dto'
import { RefreshTokenDto, TokenDto } from './dto/token.dto'
import { LoginResponseDto, UserLoginDto } from './dto/user-login.dto'

/**
 * 管理端认证控制器
 * 提供登录、登出、令牌刷新、验证码等认证相关接口
 */
@ApiTags('管理端认证模块')
@Controller('admin/auth')
export class AdminAuthController {
  constructor(
    private readonly rsaService: RsaService,
    private readonly authService: AdminAuthService,
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
  getAdminPublicKey(): RsaPublicKeyDto {
    return {
      publicKey: this.rsaService.getAdminPublicKey(),
    }
  }
}
