import * as process from 'node:process'
import { RsaService } from '@libs/crypto'
import { AdminUser, RepositoryService } from '@libs/database'
import { extractIpAddress } from '@libs/utils'
import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { FastifyRequest } from 'fastify'
import { ScryptService } from '../../../../../../libs/crypto/src/scrypt.service'
import { ADMIN_LOGIN_POLICY } from '../../../config/auth.config'
import { CaptchaService } from '../../../service/captcha/captcha.service'
import { RequestLogService } from '../../foundation/request-log'

import { AdminJwtService } from './admin-jwt.service'
import { CacheKey } from './auth.constant'
import { RefreshTokenDto, TokenDto } from './dto/token.dto'
import { UserLoginDto } from './dto/user-login.dto'

/**
 * 管理端认证服务
 * 负责登录、登出、令牌刷新、验证码生成等认证相关业务逻辑
 */
@Injectable()
export class AdminAuthService extends RepositoryService {
  get adminUser() {
    return this.prisma.adminUser
  }

  constructor(
    private readonly rsaService: RsaService,
    private readonly scryptService: ScryptService,
    private readonly adminJwtService: AdminJwtService,
    private readonly requestLogService: RequestLogService,
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

    if (process.env.NODE_ENV === 'production') {
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
        isEnabled: true, // 只查找启用的用户
      },
    })
    if (!user) {
      throw new BadRequestException('账号或密码错误')
    }

    const requestIp = extractIpAddress(req)

    // 检查账户是否被锁定
    if (user.isLocked) {
      const failAt = user.loginFailAt ? new Date(user.loginFailAt).getTime() : 0
      const now = Date.now()
      const lockExpired =
        !!failAt && now - failAt >= ADMIN_LOGIN_POLICY.lockDurationMs

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
        await this.requestLogService.createLoginFailureRequestLog(
          {
            content: `【${body.username}】登录失败，账户被锁定`,
            username: body.username,
            userId: user.id,
          },
          req,
        )
        await this.updateLoginFailInfo(user, requestIp)
        throw new UnauthorizedException('失败次数过多，请稍后再试')
      }
    }

    // 解密密码
    let password = body.password
    try {
      password = this.rsaService.decryptWithAdmin(body.password)
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
    const tokens = await this.adminJwtService.generateTokens({
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
    await this.requestLogService.createLoginSuccessRequestLog(
      {
        content: `【${body.username}】登录成功`,
        username: body.username,
        userId: user.id,
      },
      req,
    )

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
        isLocked: user.loginFailCount + 1 >= ADMIN_LOGIN_POLICY.maxFailCount, // 达到阈值后锁定账户
      },
    })
  }

  /**
   * 退出登录
   */
  async logout(body: TokenDto) {
    const { accessToken, refreshToken } = body
    // 将令牌添加到黑名单
    return this.adminJwtService.logout(accessToken, refreshToken)
  }

  /**
   * 刷新访问令牌
   */
  async refreshToken(body: RefreshTokenDto) {
    return this.adminJwtService.refreshAccessToken(body.refreshToken)
  }
}
