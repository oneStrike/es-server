import type { FastifyRequest } from 'fastify'
import { AdminUser, RepositoryService } from '@libs/base/database'

import { CaptchaService, RsaService, ScryptService } from '@libs/base/modules'
import { AuthService as BaseAuthService } from '@libs/base/modules/auth'

import { extractIpAddress, isProduction } from '@libs/base/utils'
import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { CacheKey } from './auth.constant'
import { RefreshTokenDto, TokenDto, UserLoginDto } from './dto/auth.dto'

/**
 * 管理端认证服务
 */
@Injectable()
export class AuthService extends RepositoryService {
  get adminUser() {
    return this.prisma.adminUser
  }

  constructor(
    private readonly rsaService: RsaService,
    private readonly scryptService: ScryptService,
    private readonly baseJwtService: BaseAuthService,
    private readonly captchaService: CaptchaService,
  ) {
    super()
  }

  /**
   * 获取验证码
   */
  async getCaptcha() {
    return this.captchaService.generateSvgCaptcha(CacheKey.CAPTCHA)
  }

  /**
   * 登录
   */
  async login(body: UserLoginDto, req: FastifyRequest) {
    // 检查用户输入的验证码
    if (!body.captcha) {
      throw new BadRequestException('请输入验证码')
    }

    if (isProduction()) {
      // 验证验证码是否正确
      const isValid = await this.captchaService.verify(
        CacheKey.CAPTCHA,
        body.captchaId,
        body.captcha,
      )
      if (!isValid) {
        await this.captchaService.remove(CacheKey.CAPTCHA, body.captchaId)
        throw new BadRequestException('验证码错误')
      }
    }

    // 验证通过后，删除已使用的验证码
    await this.captchaService.remove(CacheKey.CAPTCHA, body.captchaId)

    // 查找用户
    const user = await this.adminUser.findFirst({
      where: {
        username: body.username,
      },
    })
    if (!user) {
      throw new BadRequestException('账号或密码错误')
    }

    if (!user.isEnabled) {
      throw new BadRequestException('账号已被禁用，请联系管理员。')
    }

    const requestIp = extractIpAddress(req)

    // 检查账户是否被锁定
    if (user.isLocked) {
      const failAt = user.loginFailAt ? new Date(user.loginFailAt).getTime() : 0
      const now = Date.now()
      const lockExpired = !!failAt && now - failAt >= 1000 * 60 * 30

      if (lockExpired) {
        // 锁定已到期，自动解锁并重置失败信息
        await this.adminUser.update({
          where: { id: user.id },
          data: {
            isLocked: false,
            loginFailIp: null,
            loginFailAt: null,
            loginFailCount: 0,
          },
        })
        // 同步本地对象，继续后续登录流程
        user.isLocked = false
        user.loginFailIp = null
        user.loginFailAt = null
        user.loginFailCount = 0
      } else {
        // 锁定未到期，记录失败并拒绝
        await this.updateLoginFailInfo(user, requestIp)
        throw new UnauthorizedException('失败次数过多，请稍后再试')
      }
    }

    // 解密密码
    let password = body.password
    try {
      password = this.rsaService.decryptWith(body.password)
    } catch {
      await this.updateLoginFailInfo(user, requestIp)
      throw new BadRequestException('账号或密码错误')
    }

    // 验证密码
    const isPasswordValid = await this.scryptService.verifyPassword(
      password,
      user.password,
    )
    if (!isPasswordValid) {
      await this.updateLoginFailInfo(user, requestIp)
      throw new BadRequestException('账号或密码错误')
    }

    // 更新登录信息
    await this.adminUser.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: extractIpAddress(req) || 'unknown',
        isLocked: false,
        loginFailIp: null,
        loginFailAt: null,
        loginFailCount: 0,
      },
    })
    // 生成令牌
    const tokens = await this.baseJwtService.generateTokens({
      sub: String(user.id),
      username: user.username,
    })

    // 去除 user 对象的 password 属性
    const {
      password: _password,
      loginFailAt,
      loginFailCount,
      loginFailIp,
      isLocked,
      ...userWithoutPassword
    } = user

    return {
      user: userWithoutPassword,
      tokens,
    }
  }

  /**
   * 更新登录失败相关的信息
   */
  async updateLoginFailInfo(user: AdminUser, requestIp?: string) {
    await this.adminUser.update({
      where: { id: user.id },
      data: {
        loginFailIp: requestIp || 'unknown',
        loginFailAt: new Date(),
        loginFailCount: user.loginFailCount + 1,
        isLocked: user.loginFailCount + 1 >= 5, // 达到阈值后锁定账户
      },
    })
  }

  /**
   * 退出登录
   */
  async logout(body: TokenDto) {
    const { accessToken, refreshToken } = body
    // 将令牌添加到黑名单
    return this.baseJwtService.logout(accessToken, refreshToken)
  }

  /**
   * 刷新访问令牌
   */
  async refreshToken(body: RefreshTokenDto) {
    return this.baseJwtService.refreshAccessToken(body.refreshToken)
  }
}
