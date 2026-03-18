import type { FastifyRequest } from 'fastify'
import { DrizzleService } from '@db/core'
import { ForumProfileService } from '@libs/forum'
import { GenderEnum } from '@libs/platform/constant'
import { RsaService, ScryptService } from '@libs/platform/modules'
import {
  AuthService as BaseAuthService,
  LoginGuardService,
} from '@libs/platform/modules/auth'
import { extractIpAddress, parseDeviceInfo } from '@libs/platform/utils'
import { BadRequestException, Injectable } from '@nestjs/common'
import { and, eq, isNull, or } from 'drizzle-orm'
import {
  AuthConstants,
  AuthDefaultValue,
  AuthErrorMessages,
  AuthRedisKeys,
} from './auth.constant'
import { LoginDto, TokenDto } from './dto/auth.dto'
import { PasswordService } from './password.service'
import { SmsService } from './sms.service'
import { AppTokenStorageService } from './token-storage.service'

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
    private readonly passwordService: PasswordService,
    private readonly profileService: ForumProfileService,
    private readonly tokenStorageService: AppTokenStorageService,
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
  async register(body: LoginDto, req: FastifyRequest) {
    if (!body.phone) {
      throw new BadRequestException(
        AuthErrorMessages.PHONE_REQUIRED_FOR_REGISTER,
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
            phone: this.appUserTable.phoneNumber,
            isEnabled: this.appUserTable.isEnabled,
          })

        await this.profileService.initForumProfile(tx, newUser.id)
        return newUser
      }),
    )

    return this.handleLoginSuccess(user, req)
  }

  /**
   * 用户登录
   */
  async login(body: LoginDto, req: FastifyRequest) {
    if (!body.phone && !body.account) {
      throw new BadRequestException(AuthErrorMessages.PHONE_OR_ACCOUNT_REQUIRED)
    }

    if (!body.code && !body.password) {
      throw new BadRequestException(AuthErrorMessages.PASSWORD_OR_CODE_REQUIRED)
    }

    if (body.code && !body.phone) {
      throw new BadRequestException(
        AuthErrorMessages.PHONE_REQUIRED_FOR_CODE_LOGIN,
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
          phone: this.appUserTable.phoneNumber,
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
          phone: this.appUserTable.phoneNumber,
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

      throw new BadRequestException(AuthErrorMessages.ACCOUNT_NOT_FOUND)
    }

    if (body.code) {
      if (!user.phone) {
        throw new BadRequestException(AuthErrorMessages.ACCOUNT_NOT_BOUND_PHONE)
      }

      if (body.phone && body.phone !== user.phone) {
        throw new BadRequestException(AuthErrorMessages.PHONE_MISMATCH)
      }

      // await this.smsService.validateVerifyCode({
      //   phone: user.phone,
      //   code: body.code,
      // })
    } else {
      await this.loginGuardService.checkLock(AuthRedisKeys.LOGIN_LOCK(user.id))

      const password = this.rsaService.decryptWith(body.password!)
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
      }

      await this.loginGuardService.clearHistory(
        AuthRedisKeys.LOGIN_FAIL_COUNT(user.id),
      )
    }

    if (!user.isEnabled) {
      throw new BadRequestException(AuthErrorMessages.ACCOUNT_DISABLED)
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
   * 持久化访问令牌和刷新令牌
   */
  private async storeTokens(userId: number, tokens: any, req: FastifyRequest) {
    const [accessPayload, refreshPayload] = await Promise.all([
      this.baseJwtService.decodeToken(tokens.accessToken),
      this.baseJwtService.decodeToken(tokens.refreshToken),
    ])

    const accessTokenExpiresAt = new Date(accessPayload.exp * 1000)
    const refreshTokenExpiresAt = new Date(refreshPayload.exp * 1000)
    const deviceInfo = parseDeviceInfo(req.headers['user-agent'])

    await this.tokenStorageService.createTokens([
      {
        userId,
        jti: accessPayload.jti,
        tokenType: 'ACCESS',
        expiresAt: accessTokenExpiresAt,
        deviceInfo,
        ipAddress: extractIpAddress(req) || AuthDefaultValue.IP_ADDRESS_UNKNOWN,
        userAgent: req.headers['user-agent'],
      },
      {
        userId,
        jti: refreshPayload.jti,
        tokenType: 'REFRESH',
        expiresAt: refreshTokenExpiresAt,
        deviceInfo,
        ipAddress: extractIpAddress(req) || AuthDefaultValue.IP_ADDRESS_UNKNOWN,
        userAgent: req.headers['user-agent'],
      },
    ])
  }

  /**
   * 用户退出登录
   */
  async logout(dto: TokenDto) {
    const { accessToken, refreshToken } = dto

    const [accessPayload, refreshPayload] = await Promise.all([
      this.baseJwtService.decodeToken(accessToken),
      this.baseJwtService.decodeToken(refreshToken),
    ])

    await this.tokenStorageService.revokeByJtis(
      [accessPayload.jti, refreshPayload.jti],
      'USER_LOGOUT',
    )

    return this.baseJwtService.logout(accessToken, refreshToken)
  }

  /**
   * 刷新令牌
   */
  async refreshToken(refreshToken: string, req: FastifyRequest) {
    const tokens = await this.baseJwtService.refreshAccessToken(refreshToken, {
      validateRefreshTokenJti: async (jti) => this.tokenStorageService.isTokenValid(jti),
      revokeRefreshTokenJti: async (jti) =>
        this.tokenStorageService.revokeByJti(jti, 'TOKEN_REFRESH'),
    })
    const payload = await this.baseJwtService.decodeToken(tokens.accessToken)
    const userId = Number(payload.sub)

    await this.storeTokens(userId, tokens, req)
    return tokens
  }

  /**
   * 登录成功后的统一处理
   */
  private async handleLoginSuccess(user: any, req: FastifyRequest) {
    await this.updateUserLoginInfo(user.id, req)

    const tokens = await this.baseJwtService.generateTokens({
      sub: String(user.id),
      phone: user.phone,
    })

    await this.storeTokens(user.id, tokens, req)

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
