import type { Cache } from 'cache-manager'
import type { ITokenStorageService } from './auth.types'
import type {
  CreateTokenDto,
  ITokenDelegate,
  ITokenEntity,
} from './token-storage.types'
import { BaseService } from '@libs/base/database'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Inject, Injectable } from '@nestjs/common'

/**
 * 基础 Token 存储服务
 *
 * 职责：
 * 1. 提供 Token 存储的通用逻辑（Admin 和 App 共享）
 * 2. 统一管理缓存策略
 * 3. 减少重复代码
 */
@Injectable()
export abstract class BaseTokenStorageService<T extends ITokenEntity>
  extends BaseService
  implements ITokenStorageService
{
  constructor(@Inject(CACHE_MANAGER) protected readonly cacheManager: Cache) {
    super()
  }

  /**
   * 获取 Prisma Delegate
   * 由子类实现，返回具体的 Model Delegate (如 this.prisma.adminUserToken)
   */
  protected abstract get tokenDelegate(): ITokenDelegate<T>

  /**
   * 创建单个 Token 记录
   */
  async createToken(data: CreateTokenDto) {
    const result = await this.tokenDelegate.create({
      data: {
        userId: data.userId,
        jti: data.jti,
        tokenType: data.tokenType,
        expiresAt: data.expiresAt,
        deviceInfo: data.deviceInfo,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      },
    })

    // 缓存 Token 状态
    const ttl = Math.floor((data.expiresAt.getTime() - Date.now()) / 1000)
    if (ttl > 0) {
      await this.cacheManager.set(`token:${data.jti}`, 'valid', ttl)
    }

    return result
  }

  /**
   * 批量创建 Token 记录
   */
  async createTokens(tokens: CreateTokenDto[]) {
    const result = await this.tokenDelegate.createMany({
      data: tokens.map((token) => ({
        userId: token.userId,
        jti: token.jti,
        tokenType: token.tokenType,
        expiresAt: token.expiresAt,
        deviceInfo: token.deviceInfo,
        ipAddress: token.ipAddress,
        userAgent: token.userAgent,
      })),
    })

    // 批量缓存 Token 状态
    await Promise.all(
      tokens.map(async (token) => {
        const ttl = Math.floor((token.expiresAt.getTime() - Date.now()) / 1000)
        if (ttl > 0) {
          await this.cacheManager.set(`token:${token.jti}`, 'valid', ttl)
        }
      }),
    )

    return result
  }

  /**
   * 根据 JTI 查询 Token
   */
  async findByJti(jti: string) {
    return this.tokenDelegate.findUnique({
      where: { jti },
    })
  }

  /**
   * 检查 Token 是否有效
   * 包含 Redis 缓存逻辑
   */
  async isTokenValid(jti: string): Promise<boolean> {
    // 优先读缓存，命中即返回
    const cached = await this.cacheManager.get(`token:${jti}`)
    if (cached !== null && cached !== undefined) {
      return cached === 'valid'
    }

    const token = await this.findByJti(jti)
    if (!token) {
      // 不存在的 token 缓存为无效，避免穿透
      await this.cacheManager.set(`token:${jti}`, 'invalid', 86400) // 缓存无效状态 24h
      return false
    }

    if (token.revokedAt) {
      await this.cacheManager.set(`token:${jti}`, 'invalid', 86400)
      return false
    }

    if (new Date() > token.expiresAt) {
      await this.cacheManager.set(`token:${jti}`, 'invalid', 86400)
      return false
    }

    // 计算剩余 TTL (秒) 并写入缓存
    const ttl = Math.floor((token.expiresAt.getTime() - Date.now()) / 1000)
    if (ttl > 0) {
      await this.cacheManager.set(`token:${jti}`, 'valid', ttl)
    } else {
      await this.cacheManager.set(`token:${jti}`, 'invalid', 86400)
      return false
    }

    return true
  }

  /**
   * 撤销单个 Token
   */
  async revokeByJti(jti: string, reason: string) {
    await this.tokenDelegate.updateMany({
      where: { jti },
      data: {
        revokedAt: new Date(),
        revokeReason: reason,
      },
    })

    await this.cacheManager.set(`token:${jti}`, 'invalid', 86400)
  }

  /**
   * 批量撤销 Token
   */
  async revokeByJtis(jtis: string[], reason: string) {
    await this.tokenDelegate.updateMany({
      where: { jti: { in: jtis } },
      data: {
        revokedAt: new Date(),
        revokeReason: reason,
      },
    })

    await Promise.all(
      jtis.map(async (jti) =>
        this.cacheManager.set(`token:${jti}`, 'invalid', 86400),
      ),
    )
  }

  /**
   * 撤销用户所有 Token
   */
  async revokeAllByUserId(userId: number, reason: string) {
    // 先查出所有有效的 Token JTI，用于清除缓存
    const tokens = await this.tokenDelegate.findMany({
      where: {
        userId,
        revokedAt: null,
      },
      select: { jti: true },
    })

    const jtis = tokens.map((t: any) => t.jti)

    await this.tokenDelegate.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
        revokeReason: reason,
      },
    })

    await Promise.all(
      jtis.map(async (jti: string) =>
        this.cacheManager.set(`token:${jti}`, 'invalid', 86400),
      ),
    )
  }

  /**
   * 查询用户的所有活跃 Token
   */
  async findActiveTokensByUserId(userId: number) {
    return this.tokenDelegate.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    })
  }

  /**
   * 清理过期 Token
   * 将过期但未撤销的 Token 标记为已撤销
   */
  async cleanupExpiredTokens() {
    const result = await this.tokenDelegate.updateMany({
      where: {
        expiresAt: { lt: new Date() },
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
        revokeReason: 'TOKEN_EXPIRED',
      },
    })
    return result.count
  }

  /**
   * 删除已撤销的旧 Token
   * @param retentionDays 保留天数
   */
  async deleteOldRevokedTokens(retentionDays: number = 30) {
    const date = new Date()
    date.setDate(date.getDate() - retentionDays)

    const result = await this.tokenDelegate.deleteMany({
      where: {
        revokedAt: {
          not: null,
          lt: date,
        },
      },
    })
    return result.count
  }
}
