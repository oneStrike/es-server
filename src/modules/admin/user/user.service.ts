import { Buffer } from 'node:buffer'
import * as process from 'node:process'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common'
import { Cache } from 'cache-manager'
import { FastifyRequest } from 'fastify'
import * as svgCaptcha from 'svg-captcha'
import { v4 as uuid } from 'uuid'
import { CryptoService } from '@/common/module/jwt/crypto.service'
import { RsaService } from '@/common/module/jwt/rsa.service'
import { BaseRepositoryService } from '@/global/services/base-repository.service'

import { PrismaService } from '@/global/services/prisma.service'
import { AdminJwtService } from '@/modules/admin/auth'
import { CacheKey, TokenDto } from '@/modules/admin/user'
import { ActionTypeEnum, RequestLogService } from '@/modules/shared/request-log'
import {
  UpdatePasswordDto,
  UpdateUserDto,
  UserLoginDto,
  UserPageDto,
  UserRegisterDto,
} from './dto/user.dto'

@Injectable()
export class AdminUserService extends BaseRepositoryService<'AdminUser'> {
  protected readonly modelName = 'AdminUser' as const
  constructor(
    private readonly rsa: RsaService,
    private readonly crypto: CryptoService,
    private readonly adminJwtService: AdminJwtService,
    private readonly requestLogService: RequestLogService,
    protected readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    super(prisma)
  }

  /**
   * 获取验证码
   */
  async getCaptcha() {
    const captcha = svgCaptcha.create({
      size: 4, // 验证码长度
      ignoreChars: '0o1i', // 排除 0o1i
      noise: 3, // 噪声线条数量
      color: true, // 验证码的字符有颜色，而不是黑白
    })

    const uniqueId = uuid()
    await this.cacheManager.set(
      CacheKey.CAPTCHA + uniqueId,
      captcha.text,
      1000 * 60,
    )
    return {
      data: `data:image/svg+xml;base64,${Buffer.from(captcha.data).toString('base64')}`,
      id: uniqueId,
    }
  }

  /**
   * 登录
   */
  async login(body: UserLoginDto, req: FastifyRequest) {
    // 检查用户输入的验证码
    if (!body.captcha) {
      await this.createLog(
        `【${body.username}】登录失败，未输入验证码`,
        false,
        { username: body.username },
        req,
      )
      throw new BadRequestException('请输入验证码')
    }
    const captchaText = await this.cacheManager.get(
      CacheKey.CAPTCHA + body.captchaId,
    )

    if (process.env.NODE_ENV === 'production') {
      // 检查验证码是否存在于缓存中
      if (!captchaText) {
        throw new BadRequestException('验证码已过期')
      }
      // 验证码比较（不区分大小写）
      if (
        String(captchaText).toLowerCase() !== String(body.captcha).toLowerCase()
      ) {
        await this.cacheManager.del(CacheKey.CAPTCHA + body.captchaId)
        throw new BadRequestException('验证码错误')
      }
    }

    // 验证通过后，删除已使用的验证码
    await this.cacheManager.del(CacheKey.CAPTCHA + body.captchaId)

    // 查找用户
    const user = await this.prisma.adminUser.findFirst({
      where: {
        OR: [{ username: body.username }],
        isEnabled: true, // 只查找启用的用户
      },
    })
    if (!user) {
      throw new BadRequestException('账号或密码错误')
    }

    // 尝试解密密码（如果是RSA加密的）
    let password = body.password
    try {
      password = this.rsa.decryptWithAdmin(body.password)
    } catch {
      throw new BadRequestException('账号或密码错误')
    }

    // 检查账户是否被锁定
    if (user.isLocked) {
      throw new UnauthorizedException('账户已被锁定，请联系管理员')
    }

    // 验证密码
    const isPasswordValid = await this.crypto.verifyPassword(
      password,
      user.password,
    )
    if (!isPasswordValid) {
      // 增加登录失败次数
      await this.prisma.adminUser.update({
        where: { id: user.id },
        data: {
          loginFailCount: user.loginFailCount + 1,
          isLocked: user.loginFailCount + 1 >= 5, // 失败5次后锁定账户
        },
      })
      throw new BadRequestException('账号或密码错误')
    }

    // 更新登录信息
    await this.prisma.adminUser.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp:
          req?.ip ||
          (req?.headers['x-forwarded-for'] as string) ||
          (req?.headers['x-real-ip'] as string) ||
          'unknown',
        loginFailCount: 0, // 重置登录失败次数
      },
    })

    // 生成令牌
    const tokens = await this.adminJwtService.generateTokens({
      sub: String(user.id),
      username: user.username,
    })

    // 去除 user 对象的 password 属性
    const { password: _password, ...userWithoutPassword } = user
    await this.createLog(`【${user.username}】登录成功`, true, user, req)
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
    return this.adminJwtService.logout(accessToken, refreshToken)
  }

  /**
   * 刷新访问令牌
   */
  async refreshToken(refreshToken: string) {
    return this.adminJwtService.refreshAccessToken(refreshToken)
  }

  /**
   * 更新用户密码
   */
  async updatePassword(
    userId: number,
    body: UpdatePasswordDto,
    req: FastifyRequest,
  ) {
    const { oldPassword, newPassword, confirmPassword, refreshToken } = body
    if (newPassword !== confirmPassword) {
      throw new BadRequestException('新密码和确认密码不一致')
    }

    const authHeader = req.headers.authorization!
    const accessToken = authHeader.substring(7) // 去掉 'Bearer ' 前缀

    // 查找用户
    const user = await this.prisma.adminUser.findUnique({
      where: { id: userId },
    })

    if (!user) {
      throw new NotFoundException('用户不存在')
    }

    // 验证旧密码
    const isPasswordValid = await this.crypto.verifyPassword(
      oldPassword,
      user.password,
    )
    if (!isPasswordValid) {
      throw new BadRequestException('旧密码错误')
    }

    // 加密新密码
    const encryptedPassword = await this.crypto.encryptPassword(newPassword)

    await this.adminJwtService.logout(accessToken, refreshToken)

    await this.prisma.adminUser.update({
      where: { id: userId },
      data: { password: encryptedPassword },
      select: {
        id: true,
      },
    })

    return userId
  }

  /**
   * 更新用户信息
   */
  async updateUserInfo(userId: number, updateData: UpdateUserDto) {
    userId = updateData.id || userId
    // 查找用户
    const user = await this.prisma.adminUser.findUnique({
      where: { id: userId },
    })
    if (!user) {
      throw new NotFoundException('用户不存在')
    }
    // 如果要更新用户名，检查是否已存在
    if (updateData.username && updateData.username !== user.username) {
      const existingUser = await this.prisma.adminUser.findUnique({
        where: { username: updateData.username },
      })

      if (existingUser) {
        throw new BadRequestException('用户名已存在')
      }
    }

    // 返回更新后的用户信息（不包含密码）
    return this.prisma.adminUser.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
      },
    })
  }

  /**
   * 注册管理员用户
   */
  async register(body: UserRegisterDto) {
    const { username, password, confirmPassword, avatar, role } = body
    if (password !== confirmPassword) {
      throw new BadRequestException('密码和确认密码不一致')
    }

    // 检查用户名是否已存在
    const existingUser = await this.prisma.adminUser.findFirst({
      where: {
        OR: [{ username }, { mobile: body.mobile }],
      },
    })

    if (existingUser) {
      throw new BadRequestException('用户名或手机号已被使用')
    }

    // 加密密码
    const encryptedPassword = await this.crypto.encryptPassword(password)

    // 创建用户
    return this.prisma.adminUser.create({
      data: {
        username,
        password: encryptedPassword,
        avatar,
        role: role || 0,
        isEnabled: true,
      },
      select: {
        id: true,
      },
    })
  }

  /**
   * 获取用户信息
   */
  async getUserInfo(userId: number) {
    const user = await this.prisma.adminUser.findUnique({
      where: { id: userId },
      omit: {
        password: true,
        isLocked: true,
        loginFailCount: true,
        lastLoginIp: true,
        lastLoginAt: true,
      },
    })

    if (!user) {
      throw new NotFoundException('用户不存在')
    }

    // 返回用户信息（不包含密码）
    return user
  }

  /**
   * 获取用户列表（分页）
   */
  async getUsers(queryDto: UserPageDto) {
    const { username, isEnabled, role } = queryDto

    const where: any = {}

    if (username) {
      where.username = { contains: username }
    }
    if (isEnabled !== undefined) {
      where.isEnabled = { equals: isEnabled }
    }
    if (role !== undefined) {
      where.role = { equals: role }
    }

    return this.findPagination({
      where,
      ...queryDto,
      omit: {
        password: true,
        isLocked: true,
        loginFailCount: true,
        lastLoginIp: true,
        lastLoginAt: true,
      },
    })
  }

  async createLog(
    content: string,
    isSuccess: boolean,
    user: Record<string, any>,
    req: FastifyRequest,
  ) {
    console.log('🚀 ~ AdminUserService ~ createLog ~ user:', user)
    return this.requestLogService.createRequestLog(
      {
        content,
        username: user.username,
        userId: user.userId || undefined,
        actionType: ActionTypeEnum.LOGIN,
        isSuccess,
      },
      req,
    )
  }
}
