import type { FastifyRequest } from 'fastify'
import { BaseService } from '@libs/base/database'

import { GenderEnum } from '@libs/base/enum'
import { RsaService, ScryptService, SmsService } from '@libs/base/modules'
import { AuthService as BaseAuthService } from '@libs/base/modules/auth'

import { extractIpAddress, parseDeviceInfo } from '@libs/base/utils'
import { ForumProfileService } from '@libs/forum'
import { BadRequestException, Injectable } from '@nestjs/common'
import { ErrorMessages } from './auth.constant'
import {
  ForgotPasswordDto,
  LoginDto,
} from './dto/auth.dto'
import { AppTokenStorageService } from './token-storage.service'

/**
 * 认证服务类
 * 提供用户注册、登录、令牌管理、密码重置等核心认证功能
 */
@Injectable()
export class AuthService extends BaseService {
  constructor(
    private readonly rsaService: RsaService,
    private readonly smsService: SmsService,
    private readonly scryptService: ScryptService,
    private readonly baseJwtService: BaseAuthService,
    private readonly profileService: ForumProfileService,
    private readonly tokenStorageService: AppTokenStorageService,
  ) {
    super()
  }

  get appUser() {
    return this.prisma.appUser
  }

  /**
   * 生成唯一随机的账号
   * @returns 唯一的账号
   */
  async generateUniqueAccount() {
    const randomAccount = Math.floor(100000 + Math.random() * 900000)
    const existingUser = await this.appUser.findUnique({
      where: { account: randomAccount },
    })
    if (existingUser) {
      return this.generateUniqueAccount()
    }
    return randomAccount
  }

  /**
   * 用户注册
   * @param body - 注册数据，包含手机号、密码等信息
   * @returns 注册结果，包含用户信息和 JWT 令牌
   * @throws {BadRequestException} 手机号已存在
   * @throws {BadRequestException} 系统配置错误：找不到默认论坛等级
   */
  async register(body: LoginDto) {
    if (body.phone && body.code) {
      // 验证码注册
      await this.smsService.checkVerifyCode({
        phoneNumber: body.phone,
        verifyCode: body.code,
      })
    }
    const password = this.rsaService.decryptWith(body.password!)
    const hashedPassword = await this.scryptService.encryptPassword(password)

    const user = await this.prisma.$transaction(async (tx) => {
      const uid = await this.generateUniqueAccount()
      const newUser = await tx.appUser.create({
        data: {
          account: uid,
          nickname: `用户${uid}`,
          password: hashedPassword,
          phone: body.phone,
          gender: GenderEnum.UNKNOWN,
          isEnabled: true,
        },
      })

      await this.profileService.initForumProfile(tx as any, newUser.id)

      return newUser
    })

    const tokens = await this.baseJwtService.generateTokens({
      sub: String(user.id),
      phone: user.phone,
    })
    return {
      user: this.sanitizeUser(user),
      tokens,
    }
  }

  /**
   * 用户登录
   * @param body - 登录数据，包含账号和密码
   * @param req - Fastify 请求对象，用于获取客户端 IP
   * @returns 登录结果，包含用户信息和 JWT 令牌
   * @throws {BadRequestException} 账号或密码错误
   * @throws {BadRequestException} 账号已被禁用
   */
  async login(body: LoginDto, req: FastifyRequest) {
    if (!body.phone && !body.password) {
      throw new BadRequestException(ErrorMessages.PHONE_OR_ACCOUNT_REQUIRED)
    }

    if (!body.code && !body.password) {
      throw new BadRequestException(ErrorMessages.PASSWORD_OR_CODE_REQUIRED)
    }

    const user = await this.appUser.findFirst({
      where: {
        OR: [{ phone: body.phone }, { account: body.account }],
      },
    })

    if (!user) {
      // 如果用户不存在但是使用了验证码，就注册用户
      if (!body.code) {
        throw new BadRequestException(ErrorMessages.ACCOUNT_NOT_FOUND)
      }
      return this.register(body)
    }
    // 使用验证码登录
    if (body.code) {
      const verifyCodeService = this.smsService.checkVerifyCode({
        phoneNumber: user.phone!,
        VerifyCode: body.code,
      })
      console.log("🚀 ~ AuthService ~ login ~ verifyCodeService:", verifyCodeService)
    }

    if (!user.isEnabled) {
      throw new BadRequestException(ErrorMessages.ACCOUNT_DISABLED)
    }

    const password = this.rsaService.decryptWith(body.password!)
    const isPasswordValid = await this.scryptService.verifyPassword(
      password,
      user.password,
    )
    if (!isPasswordValid) {
      throw new BadRequestException(ErrorMessages.ACCOUNT_OR_PASSWORD_ERROR)
    }

    await this.prisma.appUser.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: extractIpAddress(req) || ErrorMessages.IP_ADDRESS_UNKNOWN,
      },
    })

    const tokens = await this.baseJwtService.generateTokens({
      sub: String(user.id),
      phone: user.phone,
    })

    const accessPayload = await this.baseJwtService.decodeToken(tokens.accessToken)
    const refreshPayload = await this.baseJwtService.decodeToken(tokens.refreshToken)

    const accessTokenExpiresAt = new Date(accessPayload.exp * 1000)
    const refreshTokenExpiresAt = new Date(refreshPayload.exp * 1000)

    const deviceInfo = parseDeviceInfo(req.headers['user-agent'])

    await this.tokenStorageService.createTokens([
      {
        userId: user.id,
        jti: accessPayload.jti,
        tokenType: 'ACCESS',
        expiresAt: accessTokenExpiresAt,
        deviceInfo,
        ipAddress: extractIpAddress(req) || ErrorMessages.IP_ADDRESS_UNKNOWN,
        userAgent: req.headers['user-agent'],
      },
      {
        userId: user.id,
        jti: refreshPayload.jti,
        tokenType: 'REFRESH',
        expiresAt: refreshTokenExpiresAt,
        deviceInfo,
        ipAddress: extractIpAddress(req) || ErrorMessages.IP_ADDRESS_UNKNOWN,
        userAgent: req.headers['user-agent'],
      },
    ])

    return {
      user: this.sanitizeUser(user),
      tokens,
    }
  }

  /**
   * 用户退出登录
   * @param accessToken - 访问令牌
   * @param refreshToken - 刷新令牌
   * @returns 退出登录结果
   */
  async logout(accessToken: string, refreshToken: string) {
    const accessPayload = await this.baseJwtService.decodeToken(accessToken)
    const refreshPayload = await this.baseJwtService.decodeToken(refreshToken)

    await this.tokenStorageService.revokeByJtis(
      [accessPayload.jti, refreshPayload.jti],
      'USER_LOGOUT',
    )

    return this.baseJwtService.logout(accessToken, refreshToken)
  }

  /**
   * 刷新访问令牌
   * @param refreshToken - 刷新令牌
   * @returns 新的令牌对
   */
  async refreshToken(refreshToken: string) {
    return this.baseJwtService.refreshAccessToken(refreshToken)
  }

  /**
   * 忘记密码
   * @param body - 忘记密码数据，包含账号
   * @returns 提示信息
   * @throws {BadRequestException} 账号不存在
   */
  async forgotPassword(body: ForgotPasswordDto) {
    const user = await this.findUserByAccount(body.phone)

    if (!user) {
      throw new BadRequestException(ErrorMessages.ACCOUNT_NOT_FOUND)
    }

    return {
      message: '如果账号存在，重置密码的验证码已发送',
    }
  }

  /**
   * 重置密码
   * @param body - 重置密码数据，包含账号和新密码
   * @returns 重置结果
   * @throws {BadRequestException} 账号不存在
   */
  async resetPassword(body: ForgotPasswordDto) {
    const user = await this.findUserByAccount(body.phone)

    if (!user) {
      throw new BadRequestException(ErrorMessages.ACCOUNT_NOT_FOUND)
    }

    const password = this.rsaService.decryptWith(body.password)
    const hashedPassword = await this.scryptService.encryptPassword(password)

    await this.prisma.appUser.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    })

    await this.tokenStorageService.revokeAllByUserId(user.id, 'PASSWORD_CHANGE')

    return true
  }

  /**
   * 清理用户敏感信息
   * @param user - 用户对象
   * @returns 清理后的用户对象
   */
  private sanitizeUser(user: any) {
    const { password, ...sanitized } = user
    return sanitized
  }

  /**
   * 根据账号查找用户
   * @param phone - 手机号
   * @returns 用户对象或 null
   */
  private async findUserByAccount(phone: string) {
    return this.appUser.findFirst({
      where: {
        phone
      },
    })
  }

  /**
   * 获取用户的登录设备列表
   * @param userId - 用户ID
   * @returns 设备列表
   */
  async getUserDevices(userId: number) {
    return this.tokenStorageService.getUserDevices(userId)
  }

  /**
   * 撤销特定设备的 Token
   * @param userId - 用户ID
   * @param tokenId - Token ID
   * @returns 撤销结果
   */
  async revokeDevice(userId: number, tokenId: number) {
    const token = await this.prisma.appUserToken.findUnique({
      where: { id: tokenId },
    })

    if (!token) {
      throw new BadRequestException('设备不存在')
    }

    if (token.userId !== userId) {
      throw new BadRequestException('无权操作此设备')
    }

    await this.tokenStorageService.revokeByJti(token.jti, 'USER_LOGOUT')
    return true
  }
}
