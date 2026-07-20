import type { SessionClientContext } from '@libs/platform/modules/auth/types'
import type { LoginResponseDto, UserLoginDto } from './dto/admin-auth.dto'
import { AuthService as BaseAuthService } from '@libs/platform/modules/auth/auth.service'
import { RefreshTokenDto, TokenDto } from '@libs/platform/modules/auth/dto'
import {
  AuthConstants,
  AuthErrorMessages,
} from '@libs/platform/modules/auth/helpers'
import { LoginGuardService } from '@libs/platform/modules/auth/login-guard.service'
import { AuthSessionService } from '@libs/platform/modules/auth/session.service'

import { CaptchaService } from '@libs/platform/modules/captcha/captcha.service'
import { RsaService } from '@libs/platform/modules/crypto/rsa.service'
import { ScryptService } from '@libs/platform/modules/crypto/scrypt.service'

import { isProduction } from '@libs/platform/utils'
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { AdminRbacService } from '../rbac/admin-rbac.service'
import { AdminAuthAccountService } from './admin-auth-account.service'
import { AdminAuthCacheKeys, AdminAuthRedisKeys } from './admin-auth.constant'

/**
 * 管理端认证服务。
 * 负责管理员登录、登出与令牌刷新。
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly adminAuthAccountService: AdminAuthAccountService,
    private readonly rsaService: RsaService,
    private readonly scryptService: ScryptService,
    private readonly baseJwtService: BaseAuthService,
    private readonly authSessionService: AuthSessionService,
    private readonly captchaService: CaptchaService,
    private readonly loginGuardService: LoginGuardService,
    private readonly rbacService: AdminRbacService,
  ) {}

  // 生成 SVG 验证码供管理端登录使用。
  async getCaptcha() {
    return this.captchaService.generateSvgCaptcha(AdminAuthCacheKeys.CAPTCHA)
  }

  // 管理员登录：验证码校验 → 查找用户 → 密码解密与验证 → 登录保护 → 签发令牌。
  async login(
    body: UserLoginDto,
    clientContext: SessionClientContext,
  ): Promise<LoginResponseDto> {
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
    const user = await this.adminAuthAccountService.findLoginUserByUsername(
      body.username,
    )
    if (!user) {
      throw new UnauthorizedException('账号或密码错误')
    }

    if (!user.isEnabled) {
      throw new ForbiddenException('账号已被禁用，请联系管理员。')
    }

    // 检查账户是否被锁定
    await this.loginGuardService.checkLock(
      AdminAuthRedisKeys.LOGIN_LOCK(user.id),
    )

    // 解密密码
    let password = body.password
    try {
      password = this.rsaService.decryptWith(body.password)
    } catch (error) {
      if (!(error instanceof BadRequestException)) {
        throw error
      }
      await this.loginGuardService.recordFail(
        AdminAuthRedisKeys.LOGIN_FAIL_COUNT(user.id),
        AdminAuthRedisKeys.LOGIN_LOCK(user.id),
        {
          maxAttempts: AuthConstants.LOGIN_MAX_ATTEMPTS,
          failTtl: AuthConstants.LOGIN_FAIL_TTL,
          lockTtl: AuthConstants.ACCOUNT_LOCK_TTL,
        },
      )
      throw new UnauthorizedException('账号或密码错误')
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
      throw new UnauthorizedException('账号或密码错误')
    }

    const lastLoginAt = new Date()
    const lastLoginIp = clientContext.ip || 'unknown'

    // 更新登录信息
    await this.adminAuthAccountService.updateLoginInfo(
      user.id,
      lastLoginAt,
      lastLoginIp,
    )
    const [roles, snapshot] = await Promise.all([
      this.rbacService.getUserRoleSummaries(user.id),
      this.rbacService.getSubjectSnapshot(user.id),
    ])

    // 生成令牌
    const tokens = await this.baseJwtService.generateTokens({
      sub: String(user.id),
      username: user.username,
    })

    await this.authSessionService.persistTokens(user.id, tokens, clientContext)

    return {
      user: {
        id: user.id,
        username: user.username,
        mobile: user.mobile ?? null,
        avatar: user.avatar ?? null,
        isEnabled: user.isEnabled,
        lastLoginAt,
        lastLoginIp,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        roleIds: roles.map((role) => role.id),
        roles,
        accessCodes: snapshot.permissionCodes,
        isSuperAdmin: snapshot.isSuperAdmin,
      },
      tokens,
    }
  }

  // 管理员退出登录，撤销数据库令牌。
  async logout(body: TokenDto) {
    return this.authSessionService.logout(body, { revokeDbTokens: true })
  }

  // 刷新访问令牌，校验用户状态后返回新令牌对。
  async refreshToken(
    body: RefreshTokenDto,
    clientContext: SessionClientContext,
  ) {
    const tokens = await this.authSessionService.refreshAndPersist(
      body.refreshToken,
      clientContext,
    )
    const payload = await this.baseJwtService.decodeToken(tokens.accessToken)
    const userId = Number(payload.sub)

    if (!Number.isFinite(userId) || userId <= 0) {
      await this.authSessionService.logout(tokens, { revokeDbTokens: true })
      throw new UnauthorizedException(AuthErrorMessages.LOGIN_INVALID)
    }

    const user = await this.adminAuthAccountService.findAdminUserStatus(userId)

    if (!user) {
      await this.authSessionService.logout(tokens, { revokeDbTokens: true })
      throw new UnauthorizedException(AuthErrorMessages.LOGIN_INVALID)
    }

    if (!user.isEnabled) {
      await this.authSessionService.logout(tokens, { revokeDbTokens: true })
      throw new ForbiddenException('账号已被禁用，请联系管理员。')
    }

    return tokens
  }
}
