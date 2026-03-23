import type { FastifyRequest } from 'fastify'
import type {
  AdminLoginInput,
  AdminRefreshTokenInput,
  AdminTokenPairInput,
} from './auth.type'
import { DrizzleService } from '@db/core'
import { AuthSessionService } from '@libs/identity'
import { CaptchaService, RsaService, ScryptService } from '@libs/platform/modules'
import {
  AuthConstants,
  AuthService as BaseAuthService,
  LoginGuardService,
} from '@libs/platform/modules/auth'
import {
  extractIpAddress,
  isProduction,
} from '@libs/platform/utils'
import { BadRequestException, Injectable } from '@nestjs/common'
import { eq } from 'drizzle-orm'
import { AdminAuthCacheKeys, AdminAuthRedisKeys } from './auth.constant'

/**
 * 管理端认证服务
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly rsaService: RsaService,
    private readonly scryptService: ScryptService,
    private readonly baseJwtService: BaseAuthService,
    private readonly authSessionService: AuthSessionService,
    private readonly captchaService: CaptchaService,
    private readonly loginGuardService: LoginGuardService,
  ) {}

  private get db() {
    return this.drizzle.db
  }

  private get adminUserTable() {
    return this.drizzle.schema.adminUser
  }

  /**
   * 获取验证码
   */
  async getCaptcha() {
    return this.captchaService.generateSvgCaptcha(AdminAuthCacheKeys.CAPTCHA)
  }

  /**
   * 登录
   */
  async login(body: AdminLoginInput, req: FastifyRequest) {
    // 检查用户输入的验证码
    if (!body.captcha) {
      throw new BadRequestException('请输入验证码')
    }

    if (isProduction()) {
      // 验证验证码是否正确
      const isValid = await this.captchaService.verify(
        AdminAuthCacheKeys.CAPTCHA,
        body.captchaId,
        body.captcha,
      )
      if (!isValid) {
        await this.captchaService.remove(
          AdminAuthCacheKeys.CAPTCHA,
          body.captchaId,
        )
        throw new BadRequestException('验证码错误')
      }
    }

    // 验证通过后，删除已使用的验证码
    await this.captchaService.remove(AdminAuthCacheKeys.CAPTCHA, body.captchaId)

    // 查找用户
    const [user] = await this.db
      .select()
      .from(this.adminUserTable)
      .where(eq(this.adminUserTable.username, body.username))
      .limit(1)
    if (!user) {
      throw new BadRequestException('账号或密码错误')
    }

    if (!user.isEnabled) {
      throw new BadRequestException('账号已被禁用，请联系管理员。')
    }

    // 检查账户是否被锁定
    await this.loginGuardService.checkLock(AdminAuthRedisKeys.LOGIN_LOCK(user.id))

    // 解密密码
    let password = body.password
    try {
      password = this.rsaService.decryptWith(body.password)
    } catch {
      await this.loginGuardService.recordFail(
        AdminAuthRedisKeys.LOGIN_FAIL_COUNT(user.id),
        AdminAuthRedisKeys.LOGIN_LOCK(user.id),
        {
          maxAttempts: AuthConstants.LOGIN_MAX_ATTEMPTS,
          failTtl: AuthConstants.LOGIN_FAIL_TTL,
          lockTtl: AuthConstants.ACCOUNT_LOCK_TTL,
        },
      )
      throw new BadRequestException('账号或密码错误')
    }

    // 验证密码
    const isPasswordValid = await this.scryptService.verifyPassword(
      password,
      user.password,
    )
    if (!isPasswordValid) {
      await this.loginGuardService.recordFail(
        AdminAuthRedisKeys.LOGIN_FAIL_COUNT(user.id),
        AdminAuthRedisKeys.LOGIN_LOCK(user.id),
        {
          maxAttempts: AuthConstants.LOGIN_MAX_ATTEMPTS,
          failTtl: AuthConstants.LOGIN_FAIL_TTL,
          lockTtl: AuthConstants.ACCOUNT_LOCK_TTL,
        },
      )
      throw new BadRequestException('账号或密码错误')
    }

    // 更新登录信息
    await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.adminUserTable)
        .set({
          lastLoginAt: new Date(),
          lastLoginIp: extractIpAddress(req) || 'unknown',
        })
        .where(eq(this.adminUserTable.id, user.id)),
    )
    // 生成令牌
    const tokens = await this.baseJwtService.generateTokens({
      sub: String(user.id),
      username: user.username,
    })

    await this.authSessionService.persistTokens(user.id, tokens, req)

    // 去除 user 对象的 password 属性
    const { password: _password, ...userWithoutPassword } = user

    return {
      user: userWithoutPassword,
      tokens,
    }
  }

  /**
   * 退出登录
   */
  async logout(body: AdminTokenPairInput) {
    return this.authSessionService.logout(body)
  }

  /**
   * 刷新访问令牌
   */
  async refreshToken(body: AdminRefreshTokenInput, req: FastifyRequest) {
    return this.authSessionService.refreshAndPersist(body.refreshToken, req)
  }
}
