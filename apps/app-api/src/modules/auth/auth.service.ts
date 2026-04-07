import type { Db } from '@db/core'
import type { AppUserSelect } from '@db/schema'
import type { SessionClientContext } from '@libs/identity/session.type'
import { DrizzleService } from '@db/core'
import { UserProfileService } from '@libs/forum/profile/profile.service'
import { AuthSessionService } from '@libs/identity/session.service'
import { GenderEnum } from '@libs/platform/constant/profile.constant'
import {
  AuthConstants,
  AuthDefaultValue,
} from '@libs/platform/modules/auth/auth.constant'
import { AuthService as BaseAuthService } from '@libs/platform/modules/auth/auth.service'
import {
  LoginDto,
  RefreshTokenDto,
  TokenDto,
} from '@libs/platform/modules/auth/dto/auth-scene.dto'
import { LoginGuardService } from '@libs/platform/modules/auth/login-guard.service'
import { RsaService } from '@libs/platform/modules/crypto/rsa.service'
import { ScryptService } from '@libs/platform/modules/crypto/scrypt.service'
import { UserStatusEnum } from '@libs/user/app-user.constant'
import { UserService as UserCoreService } from '@libs/user/user.service'
import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common'
import { and, eq, isNull, or } from 'drizzle-orm'
import { AppAuthErrorMessages, AppAuthRedisKeys } from './auth.constant'
import { PasswordService } from './password.service'
import { SmsService } from './sms.service'

const APP_USER_ACCOUNT_UNIQUE_CONSTRAINT = 'app_user_account_key'
const APP_USER_ACCOUNT_MAX_RETRIES = 5

/**
 * 认证服务
 * 负责应用端用户的注册、登录、登出与令牌刷新
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly rsaService: RsaService,
    private readonly smsService: SmsService,
    private readonly scryptService: ScryptService,
    private readonly baseJwtService: BaseAuthService,
    private readonly authSessionService: AuthSessionService,
    private readonly passwordService: PasswordService,
    private readonly profileService: UserProfileService,
    private readonly loginGuardService: LoginGuardService,
    private readonly userCoreService: UserCoreService,
  ) {}

  private get db() {
    return this.drizzle.db
  }

  get appUserTable() {
    return this.drizzle.schema.appUser
  }

  private ensureSessionAllowed(user: {
    isEnabled: boolean
    status: number
    banReason: string | null
    banUntil: Date | null
  }) {
    if (!user.isEnabled) {
      throw new BadRequestException(AppAuthErrorMessages.ACCOUNT_DISABLED)
    }

    this.userCoreService.ensureAppUserNotBanned(user)
  }

  /**
   * 生成唯一账号
   */
  async generateUniqueAccount(tx: Db) {
    for (let attempt = 0; attempt < APP_USER_ACCOUNT_MAX_RETRIES; attempt += 1) {
      const randomAccount = Math.floor(100000 + Math.random() * 900000)
      const [existingUser] = await tx
        .select({ id: this.appUserTable.id })
        .from(this.appUserTable)
        .where(eq(this.appUserTable.account, String(randomAccount)))
        .limit(1)

      if (!existingUser) {
        return randomAccount
      }
    }

    throw new ConflictException(AppAuthErrorMessages.REGISTER_RETRY_FAILED)
  }

  /**
   * 用户注册
   */
  async register(body: LoginDto, clientContext: SessionClientContext) {
    if (!body.phone) {
      throw new BadRequestException(
        AppAuthErrorMessages.PHONE_REQUIRED_FOR_REGISTER,
      )
    }

    if (body.code) {
      await this.smsService.validateVerifyCode({
        phone: body.phone,
        code: body.code,
      })
    }

    const hashedPassword = await this.scryptService.encryptPassword(
      this.passwordService.generateSecureRandomPassword(),
    )

    const user = await this.createRegisteredUser(body.phone, hashedPassword)

    return this.handleLoginSuccess(user, clientContext)
  }

  /**
   * 用户登录
   */
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
    let user
    if (body.phone) {
      ;[user] = await this.db
        .select()
        .from(this.appUserTable)
        .where(
          and(
            eq(this.appUserTable.phoneNumber, body.phone),
            isNull(this.appUserTable.deletedAt),
          ),
        )
        .limit(1)
    } else {
      const accountInput = body.account!
      ;[user] = await this.db
        .select()
        .from(this.appUserTable)
        .where(
          and(
            or(
              eq(this.appUserTable.phoneNumber, accountInput),
              eq(this.appUserTable.account, accountInput),
            ),
            isNull(this.appUserTable.deletedAt),
          ),
        )
        .limit(1)
    }

    if (!user) {
      if (body.code) {
        return this.register(body, clientContext)
      }

      throw new BadRequestException(
        AppAuthErrorMessages.ACCOUNT_OR_PASSWORD_ERROR,
      )
    }
    if (body.code) {
      if (!user.phoneNumber) {
        throw new BadRequestException(
          AppAuthErrorMessages.ACCOUNT_NOT_BOUND_PHONE,
        )
      }

      if (body.phone && body.phone !== user.phoneNumber) {
        throw new BadRequestException(AppAuthErrorMessages.PHONE_MISMATCH)
      }

      // `await this.smsService.validateVerifyCode({
      //   phone: user.phoneNumber,
      //   code: body.code,
      // })`
    } else {
      await this.loginGuardService.checkLock(
        AppAuthRedisKeys.LOGIN_LOCK(user.id),
      )

      let password = ''
      try {
        password = this.rsaService.decryptWith(body.password!)
      } catch {
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

  /**
   * 更新最后登录信息
   */
  private async updateUserLoginInfo(
    userId: number,
    clientContext: SessionClientContext,
  ) {
    await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.appUserTable)
        .set({
          lastLoginAt: new Date(),
          lastLoginIp:
            clientContext.ip || AuthDefaultValue.IP_ADDRESS_UNKNOWN,
        })
        .where(eq(this.appUserTable.id, userId)),
    )
  }

  /**
   * 用户退出登录
   */
  async logout(dto: TokenDto) {
    return this.authSessionService.logout(dto, { revokeDbTokens: true })
  }

  /**
   * 刷新令牌
   */
  async refreshToken(
    dto: RefreshTokenDto,
    clientContext: SessionClientContext,
  ) {
    const tokens = await this.authSessionService.refreshAndPersist(
      dto.refreshToken,
      clientContext,
    )
    const payload = await this.baseJwtService.decodeToken(tokens.accessToken)
    const user = await this.userCoreService.findById(Number(payload.sub))

    if (!user) {
      await this.authSessionService.logout(tokens, { revokeDbTokens: true })
      throw new BadRequestException(AppAuthErrorMessages.ACCOUNT_NOT_FOUND)
    }

    try {
      this.ensureSessionAllowed(user)
    } catch (error) {
      await this.authSessionService.logout(tokens, { revokeDbTokens: true })
      throw error
    }

    return tokens
  }

  /**
   * 登录成功后的统一处理
   */
  private async handleLoginSuccess(
    user: AppUserSelect,
    clientContext: SessionClientContext,
  ) {
    await this.updateUserLoginInfo(user.id, clientContext)

    const tokens = await this.baseJwtService.generateTokens({
      sub: String(user.id),
      phone: user.phoneNumber,
    })

    await this.authSessionService.persistTokens(user.id, tokens, clientContext)

    return {
      user: this.sanitizeUser(user),
      tokens,
    }
  }

  /**
   * 脱敏返回用户信息
   */
  private sanitizeUser(user: AppUserSelect) {
    return {
      id: user.id,
      account: user.account,
      phoneNumber: user.phoneNumber ?? undefined,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl ?? undefined,
      emailAddress: user.emailAddress ?? undefined,
      genderType: user.genderType ?? GenderEnum.UNKNOWN,
      birthDate: user.birthDate ?? undefined,
      signature: user.signature ?? undefined,
      bio: user.bio ?? undefined,
      points: user.points ?? 0,
      experience: user.experience ?? 0,
      status: user.status ?? UserStatusEnum.NORMAL,
      isEnabled: user.isEnabled,
    }
  }

  private async createRegisteredUser(
    phone: string,
    hashedPassword: string,
  ): Promise<AppUserSelect> {
    let lastError: unknown = new ConflictException(
      AppAuthErrorMessages.REGISTER_RETRY_FAILED,
    )

    for (let attempt = 0; attempt < APP_USER_ACCOUNT_MAX_RETRIES; attempt += 1) {
      try {
        return await this.drizzle.db.transaction(async (tx) => {
          const uid = await this.generateUniqueAccount(tx)

          const [newUser] = await tx
            .insert(this.appUserTable)
            .values({
              account: String(uid),
              nickname: `用户${uid}`,
              password: hashedPassword,
              phoneNumber: phone,
              genderType: GenderEnum.UNKNOWN,
              isEnabled: true,
            })
            .returning()

          await this.profileService.initUserProfile(tx, newUser.id)
          return newUser
        })
      } catch (error) {
        lastError = error

        if (!this.isAccountUniqueViolation(error)) {
          this.drizzle.handleError(error)
        }

        if (attempt >= APP_USER_ACCOUNT_MAX_RETRIES - 1) {
          throw new ConflictException(
            AppAuthErrorMessages.REGISTER_RETRY_FAILED,
            {
              cause: error,
            },
          )
        }
      }
    }

    throw lastError
  }

  private isAccountUniqueViolation(error: unknown) {
    if (!this.drizzle.isUniqueViolation(error)) {
      return false
    }

    return (
      this.drizzle.extractError(error)?.constraint
      === APP_USER_ACCOUNT_UNIQUE_CONSTRAINT
    )
  }

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

    throw new BadRequestException(AppAuthErrorMessages.ACCOUNT_OR_PASSWORD_ERROR)
  }
}
