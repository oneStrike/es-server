import type { AppUserGrowthSnapshot } from '@libs/growth/app-user-growth-profile/app-user-growth-profile.type'
import type { AppLoginUserSource } from '@libs/identity/app-user-credential.type'
import type { SessionClientContext } from '@libs/identity/session.type'
import type { LoginVerifyCodeInput, RegisterOptions } from './auth.type'
import { env } from 'node:process'
import { AppUserGrowthProfileService } from '@libs/growth/app-user-growth-profile/app-user-growth-profile.service'
import { AppUserCredentialService } from '@libs/identity/app-user-credential.service'
import { AuthSessionService } from '@libs/identity/session.service'
import { BusinessErrorCode, GenderEnum } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { AuthService as BaseAuthService } from '@libs/platform/modules/auth/auth.service'
import {
  LoginDto,
  RefreshTokenDto,
  TokenDto,
} from '@libs/platform/modules/auth/dto'
import {
  AuthConstants,
  AuthErrorMessages,
} from '@libs/platform/modules/auth/helpers'
import { LoginGuardService } from '@libs/platform/modules/auth/login-guard.service'
import { RsaService } from '@libs/platform/modules/crypto/rsa.service'
import { ScryptService } from '@libs/platform/modules/crypto/scrypt.service'
import { SmsTemplateCodeEnum } from '@libs/platform/modules/sms/sms.constant'
import { UserStatusEnum } from '@libs/user/app-user.constant'
import { UserService as UserCoreService } from '@libs/user/user.service'
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { AppAuthErrorMessages, AppAuthRedisKeys } from './auth.constant'
import { PasswordService } from './password.service'
import { SmsService } from './sms.service'

const APP_LOGIN_ALIYUN_VERIFY_DISABLED =
  env.APP_LOGIN_ALIYUN_VERIFY_DISABLED === 'true'

/**
 * 应用端认证服务。
 * 负责用户注册、登录、登出与令牌刷新。
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly credentialService: AppUserCredentialService,
    private readonly rsaService: RsaService,
    private readonly smsService: SmsService,
    private readonly scryptService: ScryptService,
    private readonly baseJwtService: BaseAuthService,
    private readonly authSessionService: AuthSessionService,
    private readonly passwordService: PasswordService,
    private readonly loginGuardService: LoginGuardService,
    private readonly userCoreService: UserCoreService,
    private readonly appUserGrowthProfileService: AppUserGrowthProfileService,
  ) {}

  // 校验用户是否允许建立会话，禁用或封禁态会抛出对应异常。
  private ensureSessionAllowed(user: {
    isEnabled: boolean
    status: number
    banReason: string | null
    banUntil: Date | null
  }) {
    if (!user.isEnabled) {
      throw new ForbiddenException(AppAuthErrorMessages.ACCOUNT_DISABLED)
    }

    this.userCoreService.ensureAppUserNotBanned(user)
  }

  // 用户注册：校验短信验证码后创建用户并初始化资料。
  async register(
    body: LoginDto,
    clientContext: SessionClientContext,
    options: RegisterOptions = {},
  ) {
    if (!body.phone) {
      throw new BadRequestException(
        AppAuthErrorMessages.PHONE_REQUIRED_FOR_REGISTER,
      )
    }
    if (!body.code) {
      throw new BadRequestException(AppAuthErrorMessages.VERIFY_CODE_REQUIRED)
    }

    if (!options.skipVerifyCode) {
      await this.smsService.validateVerifyCode({
        phone: body.phone,
        code: body.code,
        templateCode: SmsTemplateCodeEnum.LOGIN_REGISTER,
      })
    }

    const hashedPassword = await this.scryptService.encryptPassword(
      this.passwordService.generateSecureRandomPassword(),
    )

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const plan =
        await this.appUserGrowthProfileService.discoverNewUserDefaultLevelLockPlan()
      const registration = await this.credentialService.registerAppUser(
        body.phone,
        hashedPassword,
        async (tx, userId) =>
          this.appUserGrowthProfileService.initializeNewUser(tx, userId, plan),
      )
      if (registration.outcome === 'initialization-snapshot-drift') {
        if (attempt === 0) {
          continue
        }
        throw new BusinessException(
          BusinessErrorCode.STATE_CONFLICT,
          AppAuthErrorMessages.REGISTER_RETRY_FAILED,
        )
      }
      if (registration.outcome !== 'registered') {
        throw new BusinessException(
          BusinessErrorCode.STATE_CONFLICT,
          AppAuthErrorMessages.REGISTER_RETRY_FAILED,
        )
      }

      return this.handleLoginSuccess(registration.user, clientContext)
    }

    throw new BusinessException(
      BusinessErrorCode.STATE_CONFLICT,
      AppAuthErrorMessages.REGISTER_RETRY_FAILED,
    )
  }

  // 用户登录：支持验证码与密码两种方式，验证码登录找不到用户时自动注册。
  async login(body: LoginDto, clientContext: SessionClientContext) {
    if (!body.phone && !body.account) {
      throw new BadRequestException(
        AppAuthErrorMessages.PHONE_OR_ACCOUNT_REQUIRED,
      )
    }

    if (!body.code && !body.password) {
      throw new BadRequestException(
        AppAuthErrorMessages.PASSWORD_OR_CODE_REQUIRED,
      )
    }

    if (body.code && !body.phone) {
      throw new BadRequestException(
        AppAuthErrorMessages.PHONE_REQUIRED_FOR_CODE_LOGIN,
      )
    }
    const user = body.phone
      ? await this.credentialService.findLoginUserByPhone(body.phone)
      : await this.credentialService.findLoginUserByAccountOrPhone(
          body.account!,
        )

    if (!user) {
      if (body.code) {
        return this.register(body, clientContext, {
          skipVerifyCode: APP_LOGIN_ALIYUN_VERIFY_DISABLED,
        })
      }

      throw new UnauthorizedException(
        AppAuthErrorMessages.ACCOUNT_OR_PASSWORD_ERROR,
      )
    }
    if (body.code) {
      if (!user.phoneNumber) {
        throw new BusinessException(
          BusinessErrorCode.OPERATION_NOT_ALLOWED,
          AppAuthErrorMessages.ACCOUNT_NOT_BOUND_PHONE,
        )
      }

      if (body.phone && body.phone !== user.phoneNumber) {
        throw new BusinessException(
          BusinessErrorCode.OPERATION_NOT_ALLOWED,
          AppAuthErrorMessages.PHONE_MISMATCH,
        )
      }

      await this.validateLoginVerifyCode({
        phone: user.phoneNumber,
        code: body.code,
        templateCode: SmsTemplateCodeEnum.LOGIN_REGISTER,
      })
    } else {
      await this.loginGuardService.checkLock(
        AppAuthRedisKeys.LOGIN_LOCK(user.id),
      )

      let password = ''
      try {
        password = this.rsaService.decryptWith(body.password!)
      } catch (error) {
        if (!(error instanceof BadRequestException)) {
          throw error
        }
        await this.recordPasswordLoginFailure(user.id)
      }

      const isPasswordValid = await this.scryptService.verifyPassword(
        password,
        user.password,
      )

      if (!isPasswordValid) {
        await this.recordPasswordLoginFailure(user.id)
      }

      await this.loginGuardService.clearHistory(
        AppAuthRedisKeys.LOGIN_FAIL_COUNT(user.id),
      )
    }

    this.ensureSessionAllowed(user)

    return this.handleLoginSuccess(user, clientContext)
  }

  // 登录验证码校验，环境变量开启时跳过阿里云验证。
  private async validateLoginVerifyCode(input: LoginVerifyCodeInput) {
    if (APP_LOGIN_ALIYUN_VERIFY_DISABLED) {
      return
    }

    await this.smsService.validateVerifyCode(input)
  }

  // 更新用户最后登录时间与属地快照。
  private async updateUserLoginInfo(
    userId: number,
    clientContext: SessionClientContext,
  ) {
    await this.credentialService.updateLoginInfo(userId, clientContext)
  }

  // 用户退出登录，撤销数据库令牌。
  async logout(dto: TokenDto) {
    return this.authSessionService.logout(dto, { revokeDbTokens: true })
  }

  // 刷新令牌，校验用户状态后返回新令牌对。
  async refreshToken(
    dto: RefreshTokenDto,
    clientContext: SessionClientContext,
  ) {
    const tokens = await this.authSessionService.refreshAndPersist(
      dto.refreshToken,
      clientContext,
    )
    const payload = await this.baseJwtService.decodeToken(tokens.accessToken)
    const user = await this.userCoreService.findUserStatusSource(
      Number(payload.sub),
    )

    if (!user) {
      await this.authSessionService.logout(tokens, { revokeDbTokens: true })
      throw new UnauthorizedException(AuthErrorMessages.LOGIN_INVALID)
    }

    try {
      this.ensureSessionAllowed(user)
    } catch (error) {
      await this.authSessionService.logout(tokens, { revokeDbTokens: true })
      throw error
    }

    return tokens
  }

  // 登录成功后的统一处理：更新登录信息、签发令牌、返回脱敏用户对象。
  private async handleLoginSuccess(
    user: AppLoginUserSource,
    clientContext: SessionClientContext,
  ) {
    await this.updateUserLoginInfo(user.id, clientContext)

    const tokens = await this.baseJwtService.generateTokens({
      sub: String(user.id),
      phone: user.phoneNumber,
    })

    await this.authSessionService.persistTokens(user.id, tokens, clientContext)
    const growth = await this.appUserGrowthProfileService.getUserGrowthSnapshot(
      user.id,
    )

    return {
      user: this.sanitizeUser(user, growth),
      tokens,
    }
  }

  // 脱敏返回用户信息，只保留安全字段。
  private sanitizeUser(
    user: AppLoginUserSource,
    growth: AppUserGrowthSnapshot,
  ) {
    return {
      id: user.id,
      account: user.account,
      phoneNumber: user.phoneNumber ?? null,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl ?? null,
      profileBackgroundImageUrl: user.profileBackgroundImageUrl ?? null,
      emailAddress: user.emailAddress ?? null,
      genderType: user.genderType ?? GenderEnum.UNKNOWN,
      birthDate: user.birthDate ?? null,
      signature: user.signature ?? null,
      bio: user.bio ?? null,
      points: growth.points,
      experience: growth.experience,
      status: user.status ?? UserStatusEnum.NORMAL,
      isEnabled: user.isEnabled,
    }
  }

  // 记录密码登录失败并抛出统一错误。
  private async recordPasswordLoginFailure(userId: number): Promise<never> {
    await this.loginGuardService.recordFail(
      AppAuthRedisKeys.LOGIN_FAIL_COUNT(userId),
      AppAuthRedisKeys.LOGIN_LOCK(userId),
      {
        maxAttempts: AuthConstants.LOGIN_MAX_ATTEMPTS,
        failTtl: AuthConstants.LOGIN_FAIL_TTL,
        lockTtl: AuthConstants.ACCOUNT_LOCK_TTL,
      },
    )

    throw new UnauthorizedException(
      AppAuthErrorMessages.ACCOUNT_OR_PASSWORD_ERROR,
    )
  }
}
