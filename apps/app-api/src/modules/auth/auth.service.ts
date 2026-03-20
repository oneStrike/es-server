import type { FastifyRequest } from 'fastify'
import type {
  AppLoginInput,
  AppTokenPairInput,
} from './auth.type'
import { DrizzleService } from '@db/core'
import { UserProfileService } from '@libs/forum'
import { AuthSessionService } from '@libs/identity'
import { GenderEnum } from '@libs/platform/constant'
import { RsaService, ScryptService } from '@libs/platform/modules'
import {
  AuthConstants,
  AuthDefaultValue,
  AuthService as BaseAuthService,
  LoginGuardService,
} from '@libs/platform/modules/auth'
import { extractIpAddress } from '@libs/platform/utils'
import { BadRequestException, Injectable } from '@nestjs/common'
import { and, eq, isNull, or } from 'drizzle-orm'
import {
  AppAuthErrorMessages,
  AppAuthRedisKeys,
} from './auth.constant'
import { PasswordService } from './password.service'
import { SmsService } from './sms.service'

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
  ) {}

  private get db() {
    return this.drizzle.db
  }

  get appUserTable() {
    return this.drizzle.schema.appUser
  }

  /**
   * 生成唯一账号
   */
  async generateUniqueAccount() {
    const randomAccount = Math.floor(100000 + Math.random() * 900000)
    const [existingUser] = await this.db
      .select({ id: this.appUserTable.id })
      .from(this.appUserTable)
      .where(eq(this.appUserTable.account, String(randomAccount)))
      .limit(1)

    if (existingUser) {
      return this.generateUniqueAccount()
    }

    return randomAccount
  }

  /**
   * 用户注册
   */
  async register(body: AppLoginInput, req: FastifyRequest) {
    if (!body.phone) {
      throw new BadRequestException(
        AppAuthErrorMessages.PHONE_REQUIRED_FOR_REGISTER,
      )
    }

    if (body.code) {
      // await this.smsService.validateVerifyCode({
      //   phone: body.phone,
      //   code: body.code,
      // })
    }

    const password = body.password
      ? this.rsaService.decryptWith(body.password)
      : this.passwordService.generateSecureRandomPassword()

    const hashedPassword = await this.scryptService.encryptPassword(password)

    const user = await this.drizzle.withErrorHandling(async () =>
      this.drizzle.db.transaction(async (tx) => {
        const uid = await this.generateUniqueAccount()

        const [newUser] = await tx
          .insert(this.appUserTable)
          .values({
            account: String(uid),
            nickname: `用户${uid}`,
            password: hashedPassword,
            phoneNumber: body.phone,
            genderType: GenderEnum.UNKNOWN,
            isEnabled: true,
          })
          .returning({
            id: this.appUserTable.id,
            account: this.appUserTable.account,
            nickname: this.appUserTable.nickname,
            password: this.appUserTable.password,
            phoneNumber: this.appUserTable.phoneNumber,
            isEnabled: this.appUserTable.isEnabled,
          })

        await this.profileService.initUserProfile(tx, newUser.id)
        return newUser
      }),
    )

    return this.handleLoginSuccess(user, req)
  }

  /**
   * 用户登录
   */
  async login(body: AppLoginInput, req: FastifyRequest) {
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
        .select({
          id: this.appUserTable.id,
          account: this.appUserTable.account,
          nickname: this.appUserTable.nickname,
          password: this.appUserTable.password,
          phoneNumber: this.appUserTable.phoneNumber,
          isEnabled: this.appUserTable.isEnabled,
        })
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
        .select({
          id: this.appUserTable.id,
          account: this.appUserTable.account,
          nickname: this.appUserTable.nickname,
          password: this.appUserTable.password,
          phoneNumber: this.appUserTable.phoneNumber,
          isEnabled: this.appUserTable.isEnabled,
        })
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
        return this.register(body, req)
      }

      throw new BadRequestException(AppAuthErrorMessages.ACCOUNT_NOT_FOUND)
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

      // await this.smsService.validateVerifyCode({
      //   phone: user.phone,
      //   code: body.code,
      // })
    } else {
      await this.loginGuardService.checkLock(
        AppAuthRedisKeys.LOGIN_LOCK(user.id),
      )

      const password = this.rsaService.decryptWith(body.password!)
      const isPasswordValid = await this.scryptService.verifyPassword(
        password,
        user.password,
      )

      if (!isPasswordValid) {
        await this.loginGuardService.recordFail(
          AppAuthRedisKeys.LOGIN_FAIL_COUNT(user.id),
          AppAuthRedisKeys.LOGIN_LOCK(user.id),
          {
            maxAttempts: AuthConstants.LOGIN_MAX_ATTEMPTS,
            failTtl: AuthConstants.LOGIN_FAIL_TTL,
            lockTtl: AuthConstants.ACCOUNT_LOCK_TTL,
          },
        )
      }

      await this.loginGuardService.clearHistory(
        AppAuthRedisKeys.LOGIN_FAIL_COUNT(user.id),
      )
    }

    if (!user.isEnabled) {
      throw new BadRequestException(AppAuthErrorMessages.ACCOUNT_DISABLED)
    }

    return this.handleLoginSuccess(user, req)
  }

  /**
   * 更新最后登录信息
   */
  private async updateUserLoginInfo(userId: number, req: FastifyRequest) {
    await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.appUserTable)
        .set({
          lastLoginAt: new Date(),
          lastLoginIp: extractIpAddress(req) || AuthDefaultValue.IP_ADDRESS_UNKNOWN,
        })
        .where(eq(this.appUserTable.id, userId)),
    )
  }

  /**
   * 用户退出登录
   */
  async logout(dto: AppTokenPairInput) {
    return this.authSessionService.logout(dto, { revokeDbTokens: true })
  }

  /**
   * 刷新令牌
   */
  async refreshToken(refreshToken: string, req: FastifyRequest) {
    return this.authSessionService.refreshAndPersist(refreshToken, req)
  }

  /**
   * 登录成功后的统一处理
   */
  private async handleLoginSuccess(user: any, req: FastifyRequest) {
    await this.updateUserLoginInfo(user.id, req)

    const tokens = await this.baseJwtService.generateTokens({
      sub: String(user.id),
      phone: user.phoneNumber,
    })

    await this.authSessionService.persistTokens(user.id, tokens, req)

    return {
      user: this.sanitizeUser(user),
      tokens,
    }
  }

  /**
   * 脱敏返回用户信息
   */
  private sanitizeUser(user: any) {
    const { password, ...rest } = user
    return {
      ...rest,
    }
  }
}
