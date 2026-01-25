import type { ITokenStorageService } from '@libs/base/modules/auth'
import type { Cache } from 'cache-manager'
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
 * 应用层 Token 存储服务
 *
 * 职责：
 * 1. 管理 Token 的生命周期（创建、查询、撤销）
 * 2. 提供 Redis 缓存优化，减少数据库查询
 * 3. 支持批量操作，提高性能
 * 4. 实现定时清理任务
 *
 * 设计原则：
 * - 使用 Redis 缓存活跃 Token 状态，减少数据库压力
 * - 异步更新缓存，不阻塞主流程
 * - 批量操作使用 Promise.all 并行执行
 */
@Injectable()
export class AppTokenStorageService extends BaseService implements ITokenStorageService {
  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {
    super()
  }

  get appUserToken() {
    return this.prisma.appUserToken
  }

  /**
   * 创建单个 Token 记录
   * @param data Token 数据
   * @returns 创建的 Token 记录
   */
  async createToken(data: CreateTokenDto) {
    return this.appUserToken.create({
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
   * 使用场景：用户登录时同时创建 ACCESS 和 REFRESH Token
   * @param tokens Token 数据数组
   * @returns 批量创建结果
   */
  async createTokens(tokens: CreateTokenDto[]) {
    return this.appUserToken.createMany({
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
   * @param jti JWT Token ID
   * @returns Token 记录或 null
   */
  async findByJti(jti: string) {
    return this.appUserToken.findUnique({
      where: { jti },
    })
  }

  /**
   * 检查 Token 是否有效
   *
   * 验证逻辑：
   * 1. 先检查 Redis 缓存（快速路径）
   * 2. 缓存未命中则查询数据库（慢速路径）
   * 3. 验证 Token 是否存在、是否被撤销、是否过期
   * 4. 将验证结果写入缓存，TTL 设置为 Token 剩余有效时间
   *
   * 性能优化：
   * - Redis 缓存命中率可达到 90% 以上
   * - 缓存过期时间与 Token 过期时间同步，避免缓存不一致
   *
   * @param jti JWT Token ID
   * @returns true=有效, false=无效
   */
  async isTokenValid(jti: string): Promise<boolean> {
    // 1. 先检查 Redis 缓存
    const cached = await this.cacheManager.get(`token:${jti}`)
    if (cached !== null) {
      return cached === 'valid'
    }

    // 2. 缓存未命中，查询数据库
    const token = await this.findByJti(jti)
    if (!token) {
      return false
    }

    // 3. 检查 Token 是否被撤销
    if (token.revokedAt) {
      return false
    }

    // 4. 检查 Token 是否过期
    if (new Date() > token.expiresAt) {
      // 自动标记为已过期
      await this.revokeByJti(jti, 'TOKEN_EXPIRED')
      return false
    }

    // 5. Token 有效，写入缓存
    // TTL 设置为 Token 剩余有效时间（秒）
    const ttl = Math.floor((token.expiresAt.getTime() - Date.now()) / 1000)
    await this.cacheManager.set(`token:${jti}`, 'valid', ttl)

    return true
  }

  /**
   * 撤销单个 Token
   *
   * 操作流程：
   * 1. 更新数据库中的 Token 状态
   * 2. 同时更新 Redis 缓存，标记为无效
   * 3. 使用 Promise.all 并行执行，提高性能
   *
   * @param jti JWT Token ID
   * @param reason 撤销原因
   */
  async revokeByJti(jti: string, reason: string) {
    await Promise.all([
      this.appUserToken.updateMany({
        where: { jti },
        data: {
          revokedAt: new Date(),
          revokeReason: reason,
        },
      }),
      // 缓存设置 1 天过期，避免 Redis 内存占用过大
      this.cacheManager.set(`token:${jti}`, 'invalid', 86400),
    ])
  }

  /**
   * 批量撤销 Token
   * 使用场景：用户退出登录时撤销 ACCESS 和 REFRESH Token
   *
   * @param jtis JWT Token ID 数组
   * @param reason 撤销原因
   */
  async revokeByJtis(jtis: string[], reason: string) {
    await Promise.all([
      this.appUserToken.updateMany({
        where: { jti: { in: jtis } },
        data: {
          revokedAt: new Date(),
          revokeReason: reason,
        },
      }),
      // 批量更新 Redis 缓存
      ...jtis.map(async jti =>
        this.cacheManager.set(`token:${jti}`, 'invalid', 86400)
      ),
    ])
  }

  /**
   * 撤销用户的所有 Token
   * 使用场景：
   * - 密码修改后撤销所有 Token
   * - 管理员强制用户下线
   * - 用户主动退出所有设备
   *
   * 操作流程：
   * 1. 查询用户所有未撤销的 Token
   * 2. 批量更新数据库状态
   * 3. 批量更新 Redis 缓存
   *
   * @param userId 用户 ID
   * @param reason 撤销原因
   */
  async revokeAllByUserId(userId: number, reason: string) {
    // 1. 查询用户所有未撤销的 Token
    const tokens = await this.appUserToken.findMany({
      where: {
        userId,
        revokedAt: null,
      },
      select: { jti: true },
    })

    const jtis = tokens.map(t => t.jti)

    // 2. 并行执行数据库更新和缓存更新
    await Promise.all([
      this.appUserToken.updateMany({
        where: {
          userId,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
          revokeReason: reason,
        },
      }),
      // 批量更新 Redis 缓存
      ...jtis.map(async jti =>
        this.cacheManager.set(`token:${jti}`, 'invalid', 86400)
      ),
    ])
  }

  /**
   * 查询用户的所有活跃 Token
   * 活跃条件：未撤销且未过期
   * @param userId 用户 ID
   * @returns 活跃 Token 列表
   */
  async findActiveTokensByUserId(userId: number) {
    return this.appUserToken.findMany({
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
   *
   * 业务逻辑：
   * 1. 查询用户所有活跃的 REFRESH Token
   * 2. 提取设备信息、IP 地址、创建时间等
   * 3. 使用 createdAt 作为 lastUsedAt（因为已移除 lastUsedAt 字段）
   *
   * @param userId 用户 ID
   * @returns 设备列表
   */
  async getUserDevices(userId: number) {
    const tokens = await this.findActiveTokensByUserId(userId)
    return tokens.map(token => ({
      id: token.id,
      jti: token.jti,
      deviceInfo: token.deviceInfo,
      ipAddress: token.ipAddress,
      lastUsedAt: token.createdAt,
      createdAt: token.createdAt,
    }))
  }

  /**
   * 清理过期的 Token
   *
   * 操作逻辑：
   * 1. 查询所有已过期但未撤销的 Token
   * 2. 批量标记为已撤销
   * 3. 撤销原因设置为 TOKEN_EXPIRED
   *
   * 性能考虑：
   * - 使用 updateMany 而非逐条更新，提高性能
   * - 建议每小时执行一次，避免数据累积过多
   *
   * @returns 清理的 Token 数量
   */
  async cleanupExpiredTokens() {
    const result = await this.appUserToken.updateMany({
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
   *
   * 业务逻辑：
   * 1. 删除已撤销且超过指定天数的 Token
   * 2. 保留审计记录，默认保留 30 天
   *
   * 使用场景：
   * - 定期清理历史数据，减少数据库存储压力
   * - 建议每天凌晨执行一次
   *
   * @param days 保留天数，默认 30 天
   * @returns 删除的 Token 数量
   */
  async deleteOldRevokedTokens(days: number = 30) {
    const date = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    return this.appUserToken.deleteMany({
      where: {
        revokedAt: { lt: date },
      },
    })
  }
}
