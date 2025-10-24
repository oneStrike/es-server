import { Buffer } from 'node:buffer'
import * as process from 'node:process'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { Cache } from 'cache-manager'
import { FastifyRequest } from 'fastify'
import * as svgCaptcha from 'svg-captcha'
import { v4 as uuid } from 'uuid'
import { CryptoService } from '@/common/module/crypto/crypto.service'
import { RsaService } from '@/common/module/crypto/rsa.service'
import { RepositoryService } from '@/common/services/repository.service'
import { RequestLogService } from '@/modules/shared/request-log'
import { AdminJwtService } from './admin-jwt.service'
import { CacheKey } from './auth.constant'
import { RefreshTokenDto, TokenDto } from './dto/token.dto'
import { UserLoginDto } from './dto/user-login.dto'

/**
 * 管理端认证服务
 * 负责登录、登出、令牌刷新、验证码生成等认证相关业务逻辑
 */
@Injectable()
export class AdminAuthService extends RepositoryService {
  get adminUser() {
    return this.prisma.adminUser
  }

  constructor(
    private readonly rsa: RsaService,
    private readonly crypto: CryptoService,
    private readonly adminJwtService: AdminJwtService,
    private readonly requestLogService: RequestLogService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    super()
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
    const user = await this.adminUser.findFirst({
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
      await this.requestLogService.createLoginFailureRequestLog(
        {
          content: `【${body.username}】登录失败，账户已被锁定`,
          username: body.username,
        },
        req,
      )
      throw new UnauthorizedException('账户已被锁定')
    }

    // 验证密码
    const isPasswordValid = await this.crypto.verifyPassword(
      password,
      user.password,
    )
    if (!isPasswordValid) {
      // 增加登录失败次数
      await this.adminUser.update({
        where: { id: user.id },
        data: {
          loginFailCount: user.loginFailCount + 1,
          isLocked: user.loginFailCount + 1 >= 5, // 失败5次后锁定账户
        },
      })
      throw new BadRequestException('账号或密码错误')
    }

    // 更新登录信息
    await this.adminUser.update({
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
    await this.requestLogService.createLoginSuccessRequestLog(
      {
        content: `【${body.username}】登录成功`,
        username: body.username,
        userId: user.id,
      },
      req,
    )

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
  async refreshToken(body: RefreshTokenDto) {
    return this.adminJwtService.refreshAccessToken(body.refreshToken)
  }
}
