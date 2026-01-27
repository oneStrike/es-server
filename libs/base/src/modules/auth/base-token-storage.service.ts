import type { Cache } from 'cache-manager'
import type { ITokenStorageService } from './auth.strategy'
import { BaseService } from '@libs/base/database'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Inject, Injectable } from '@nestjs/common'

/**
 * 创建 Token 数据传输对象
 */
export interface CreateTokenDto {
  userId: number
  jti: string
  tokenType: 'ACCESS' | 'REFRESH'
  expiresAt: Date
  deviceInfo?: any
  ipAddress?: string
  userAgent?: string
}

/**
 * Prisma Delegate 接口抽象
 * 适配 AdminUserToken 和 AppUserToken
 */
export interface ITokenDelegate<T> {
  create: (args: { data: any }) => Promise<T>
  createMany: (args: { data: any[] }) => Promise<any>
  findUnique: (args: { where: { jti?: string, id?: number } }) => Promise<T | null>
  findMany: (args: any) => Promise<T[]>
  update: (args: { where: any, data: any }) => Promise<T>
  updateMany: (args: { where: any, data: any }) => Promise<any>
  deleteMany: (args: { where: any }) => Promise<any>
}

/**
 * 基础 Token 存储服务
 *
 * 职责：
 * 1. 提供 Token 存储的通用逻辑（Admin 和 App 共享）
 * 2. 统一管理缓存策略
 * 3. 减少重复代码
 */
@Injectable()
export abstract class BaseTokenStorageService<T extends {
  id: number
  jti: string
  userId: number
  tokenType: string
  expiresAt: Date
  revokedAt?: Date | null
  createdAt: Date
  deviceInfo?: any
  ipAddress?: string | null
  userAgent?: string | null
}> extends BaseService implements ITokenStorageService {
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
    return this.tokenDelegate.create({
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
  }

  /**
   * 批量创建 Token 记录
   */
  async createTokens(tokens: CreateTokenDto[]) {
    return this.tokenDelegate.createMany({
      data: tokens.map(token => ({
        userId: token.userId,
        jti: token.jti,
        tokenType: token.tokenType,
        expiresAt: token.expiresAt,
        deviceInfo: token.deviceInfo,
        ipAddress: token.ipAddress,
        userAgent: token.userAgent,
      })),
    })
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
    const cached = await this.cacheManager.get(`token:${jti}`)
    if (cached !== null && cached !== undefined) {
      return cached === 'valid'
    }

    const token = await this.findByJti(jti)
    if (!token) {
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

    // 计算剩余 TTL (秒)
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
      jtis.map(async jti =>
        this.cacheManager.set(`token:${jti}`, 'invalid', 86400)
      )
    )
  }

  /**
   * 撤销用户的所有 Token
   */
  async revokeAllByUserId(userId: number, reason: string) {
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
        this.cacheManager.set(`token:${jti}`, 'invalid', 86400)
      )
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
      orderBy: { createdAt: 'desc' },
    })
  }

  /**
   * 获取用户的登录设备列表
   */
  async getUserDevices(userId: number) {
    const tokens = await this.tokenDelegate.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        tokenType: 'REFRESH',
      },
      orderBy: { createdAt: 'desc' },
    })

    return tokens.map((token: any) => ({
      id: token.id,
      jti: token.jti,
      deviceInfo: token.deviceInfo,
      ipAddress: token.ipAddress,
      lastUsedAt: token.createdAt, // 使用 createdAt 代替 lastUsedAt
      createdAt: token.createdAt,
    }))
  }

  /**
   * 清理过期的 Token
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
   */
  async deleteOldRevokedTokens(days: number = 30, batchSize: number = 1000) {
    const date = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    let totalDeleted = 0
    let hasMore = true

    while (hasMore) {
      const tokens = await this.tokenDelegate.findMany({
        where: {
          revokedAt: { lt: date },
        },
        select: { id: true },
        take: batchSize,
      })

      if (tokens.length === 0) {
        hasMore = false
        break
      }

      const ids = tokens.map((t: any) => t.id)
      const result = await this.tokenDelegate.deleteMany({
        where: {
          id: { in: ids },
        },
      })
      totalDeleted += result.count
      hasMore = result.count >= batchSize
    }

    return totalDeleted
  }
}
