import type { FastifyRequest } from 'fastify'
import { BaseService } from '@libs/base/database'

import { CaptchaService, RsaService, ScryptService } from '@libs/base/modules'
import {
  AuthService as BaseAuthService,
  LoginGuardService,
} from '@libs/base/modules/auth'

import {
  extractIpAddress,
  extractUserAgent,
  isProduction,
  parseDeviceInfo,
} from '@libs/base/utils'
import { BadRequestException, Injectable } from '@nestjs/common'
import { AdminTokenStorageService } from './admin-token-storage.service'
import { AuthConstants, AuthRedisKeys, CacheKey } from './auth.constant'
import { RefreshTokenDto, TokenDto, UserLoginDto } from './dto/auth.dto'

/**
 * 管理端认证服务
 */
@Injectable()
export class AuthService extends BaseService {
  get adminUser() {
    return this.prisma.adminUser
  }

  constructor(
    private readonly rsaService: RsaService,
    private readonly scryptService: ScryptService,
    private readonly baseJwtService: BaseAuthService,
    private readonly captchaService: CaptchaService,
    private readonly loginGuardService: LoginGuardService,
    private readonly adminTokenStorageService: AdminTokenStorageService,
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

    // 检查账户是否被锁定
    await this.loginGuardService.checkLock(AuthRedisKeys.LOGIN_LOCK(user.id))

    // 解密密码
    let password = body.password
    try {
      password = this.rsaService.decryptWith(body.password)
    } catch {
      await this.loginGuardService.recordFail(
        AuthRedisKeys.LOGIN_FAIL_COUNT(user.id),
        AuthRedisKeys.LOGIN_LOCK(user.id),
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
        AuthRedisKeys.LOGIN_FAIL_COUNT(user.id),
        AuthRedisKeys.LOGIN_LOCK(user.id),
        {
          maxAttempts: AuthConstants.LOGIN_MAX_ATTEMPTS,
          failTtl: AuthConstants.LOGIN_FAIL_TTL,
          lockTtl: AuthConstants.ACCOUNT_LOCK_TTL,
        },
      )
      throw new BadRequestException('账号或密码错误')
    }

    // 更新登录信息
    await this.adminUser.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: extractIpAddress(req) || 'unknown',
      },
    })
    // 生成令牌
    const tokens = await this.baseJwtService.generateTokens({
      sub: String(user.id),
      username: user.username,
    })

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
  async logout(body: TokenDto) {
    const { accessToken, refreshToken } = body
    // 将令牌添加到黑名单
    return this.baseJwtService.logout(accessToken, refreshToken)
  }

  /**
   * 刷新访问令牌
   */
  async refreshToken(body: RefreshTokenDto, req: FastifyRequest) {
    const tokens = await this.baseJwtService.refreshAccessToken(
      body.refreshToken,
    )

    // 存储新令牌
    const accessTokenPayload = await this.baseJwtService.decodeToken(
      tokens.accessToken,
    )
    const refreshTokenPayload = await this.baseJwtService.decodeToken(
      tokens.refreshToken,
    )
    const userId = Number(accessTokenPayload.sub)

    const ipAddress = extractIpAddress(req) || 'unknown'
    const userAgent = extractUserAgent(req)
    const deviceInfoStr = parseDeviceInfo(userAgent)
    const deviceInfo = deviceInfoStr ? JSON.parse(deviceInfoStr) : undefined

    await this.adminTokenStorageService.createTokens([
      {
        userId,
        jti: accessTokenPayload.jti,
        tokenType: 'ACCESS',
        expiresAt: new Date(accessTokenPayload.exp * 1000),
        deviceInfo,
        ipAddress,
        userAgent,
      },
      {
        userId,
        jti: refreshTokenPayload.jti,
        tokenType: 'REFRESH',
        expiresAt: new Date(refreshTokenPayload.exp * 1000),
        deviceInfo,
        ipAddress,
        userAgent,
      },
    ])

    return tokens
  }
}
