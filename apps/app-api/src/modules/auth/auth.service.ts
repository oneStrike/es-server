import type { FastifyRequest } from 'fastify'
import { BaseService } from '@libs/base/database'

import { RsaService, ScryptService } from '@libs/base/modules'
import { AuthService as BaseAuthService } from '@libs/base/modules/auth'
import { extractIpAddress } from '@libs/base/utils'

import { ForumProfileService } from '@libs/forum'
import { BadRequestException, Injectable } from '@nestjs/common'
import { ErrorMessages } from './auth.constant'
import {
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
} from './dto/auth.dto'

/**
 * 认证服务类
 * 提供用户注册、登录、令牌管理、密码重置等核心认证功能
 */
@Injectable()
export class AuthService extends BaseService {
  constructor(
    private readonly rsaService: RsaService,
    private readonly scryptService: ScryptService,
    private readonly baseJwtService: BaseAuthService,
    private readonly profileService: ForumProfileService,
  ) {
    super()
  }

  get appUser() {
    return this.prisma.appUser
  }

  /**
   * 用户注册
   * @param body - 注册数据，包含账号、密码、昵称等信息
   * @param _req - Fastify 请求对象
   * @returns 注册结果，包含用户信息和 JWT 令牌
   * @throws {BadRequestException} 账号、手机号或邮箱已存在
   * @throws {BadRequestException} 系统配置错误：找不到默认论坛等级
   */
  async register(body: RegisterDto, _req: FastifyRequest) {
    await this.validateAccountUnique(body.account, body.phone, body.email)

    const password = this.rsaService.decryptWith(body.password)
    const hashedPassword = await this.scryptService.encryptPassword(password)

    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.appUser.create({
        data: {
          account: body.account,
          nickname: body.nickname,
          password: hashedPassword,
          phone: body.phone,
          email: body.email,
          gender: body.gender,
          isEnabled: true,
        },
      })

      await this.profileService.initForumProfile(tx, newUser.id)

      return newUser
    })

    const tokens = await this.baseJwtService.generateTokens({
      sub: String(user.id),
      account: user.account,
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
    const user = await this.prisma.appUser.findUnique({
      where: { account: body.account },
    })

    if (!user) {
      throw new BadRequestException(ErrorMessages.ACCOUNT_OR_PASSWORD_ERROR)
    }

    if (!user.isEnabled) {
      throw new BadRequestException(ErrorMessages.ACCOUNT_DISABLED)
    }

    const password = this.rsaService.decryptWith(body.password)
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
      account: user.account,
    })

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
    const user = await this.findUserByAccount(body.account)

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
  async resetPassword(body: ResetPasswordDto) {
    const user = await this.findUserByAccount(body.account)

    if (!user) {
      throw new BadRequestException(ErrorMessages.ACCOUNT_NOT_FOUND)
    }

    const password = this.rsaService.decryptWith(body.password)
    const hashedPassword = await this.scryptService.encryptPassword(password)

    await this.prisma.appUser.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    })

    return true
  }

  /**
   * 验证账号唯一性
   * @param account - 账号
   * @param phone - 手机号（可选）
   * @param email - 邮箱（可选）
   * @throws {BadRequestException} 账号、手机号或邮箱已存在
   */
  private async validateAccountUnique(
    account: string,
    phone?: string,
    email?: string,
  ) {
    const existingUser = await this.appUser.findFirst({
      where: {
        OR: [
          { account },
          ...(phone ? [{ phone }] : []),
          ...(email ? [{ email }] : []),
        ],
      },
    })

    if (existingUser) {
      if (existingUser.account === account) {
        throw new BadRequestException(ErrorMessages.ACCOUNT_EXISTS)
      }
      if (phone && existingUser.phone === phone) {
        throw new BadRequestException(ErrorMessages.PHONE_EXISTS)
      }
      if (email && existingUser.email === email) {
        throw new BadRequestException(ErrorMessages.EMAIL_EXISTS)
      }
    }
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
   * @param account - 账号（可以是账号、手机号或邮箱）
   * @returns 用户对象或 null
   */
  private async findUserByAccount(account: string) {
    return this.appUser.findFirst({
      where: {
        OR: [{ account }, { phone: account }, { email: account }],
      },
    })
  }
}
