import type { Cache } from 'cache-manager'
import type { ITokenStorageService } from './auth.types'
import type {
  CreateTokenDto,
  ITokenDelegate,
  ITokenEntity,
} from './token-storage.types'
import { PlatformService } from '@libs/platform/database'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Inject, Injectable } from '@nestjs/common'

const INVALID_TOKEN_CACHE_TTL_MS = 24 * 60 * 60 * 1000

/**
 * 鍩虹 Token 瀛樺偍鏈嶅姟
 *
 * 鑱岃矗锛?
 * 1. 鎻愪緵 Token 瀛樺偍鐨勯€氱敤閫昏緫锛圓dmin 鍜?App 鍏变韩锛?
 * 2. 缁熶竴绠＄悊缂撳瓨绛栫暐
 * 3. 鍑忓皯閲嶅浠ｇ爜
 */
@Injectable()
export abstract class BaseTokenStorageService<T extends ITokenEntity>
  extends PlatformService
  implements ITokenStorageService
{
  constructor(@Inject(CACHE_MANAGER) protected readonly cacheManager: Cache) {
    super()
  }

  /**
   * 鑾峰彇 Prisma Delegate
   * 鐢卞瓙绫诲疄鐜帮紝杩斿洖鍏蜂綋鐨?Model Delegate (濡?this.prisma.adminUserToken)
   */
  protected abstract get tokenDelegate(): ITokenDelegate<T>

  private getTokenTtlMs(expiresAt: Date) {
    return Math.max(0, Math.floor(expiresAt.getTime() - Date.now()))
  }

  /**
   * 鍒涘缓鍗曚釜 Token 璁板綍
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

    // 缂撳瓨 Token 鐘舵€?
    const ttlMs = this.getTokenTtlMs(data.expiresAt)
    if (ttlMs > 0) {
      await this.cacheManager.set(`token:${data.jti}`, 'valid', ttlMs)
    }

    return result
  }

  /**
   * 鎵归噺鍒涘缓 Token 璁板綍
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

    // 鎵归噺缂撳瓨 Token 鐘舵€?
    await Promise.all(
      tokens.map(async (token) => {
        const ttlMs = this.getTokenTtlMs(token.expiresAt)
        if (ttlMs > 0) {
          await this.cacheManager.set(`token:${token.jti}`, 'valid', ttlMs)
        }
      }),
    )

    return result
  }

  /**
   * 鏍规嵁 JTI 鏌ヨ Token
   */
  async findByJti(jti: string) {
    return this.tokenDelegate.findUnique({
      where: { jti },
    })
  }

  /**
   * 妫€鏌?Token 鏄惁鏈夋晥
   * 鍖呭惈 Redis 缂撳瓨閫昏緫
   */
  async isTokenValid(jti: string): Promise<boolean> {
    // 浼樺厛璇荤紦瀛橈紝鍛戒腑鍗宠繑鍥?
    const cached = await this.cacheManager.get(`token:${jti}`)
    if (cached !== null && cached !== undefined) {
      return cached === 'valid'
    }

    const token = await this.findByJti(jti)
    if (!token) {
      // 涓嶅瓨鍦ㄧ殑 token 缂撳瓨涓烘棤鏁堬紝閬垮厤绌块€?
      await this.cacheManager.set(`token:${jti}`, 'invalid', INVALID_TOKEN_CACHE_TTL_MS) // 缂撳瓨鏃犳晥鐘舵€?24h
      return false
    }

    if (token.revokedAt) {
      await this.cacheManager.set(`token:${jti}`, 'invalid', INVALID_TOKEN_CACHE_TTL_MS)
      return false
    }

    if (new Date() > token.expiresAt) {
      await this.cacheManager.set(`token:${jti}`, 'invalid', INVALID_TOKEN_CACHE_TTL_MS)
      return false
    }

    // 璁＄畻鍓╀綑 TTL (绉? 骞跺啓鍏ョ紦瀛?
    const ttlMs = this.getTokenTtlMs(token.expiresAt)
    if (ttlMs > 0) {
      await this.cacheManager.set(`token:${jti}`, 'valid', ttlMs)
    } else {
      await this.cacheManager.set(`token:${jti}`, 'invalid', INVALID_TOKEN_CACHE_TTL_MS)
      return false
    }

    return true
  }

  /**
   * 鎾ら攢鍗曚釜 Token
   */
  async revokeByJti(jti: string, reason: string) {
    await this.tokenDelegate.updateMany({
      where: { jti },
      data: {
        revokedAt: new Date(),
        revokeReason: reason,
      },
    })

    await this.cacheManager.set(`token:${jti}`, 'invalid', INVALID_TOKEN_CACHE_TTL_MS)
  }

  /**
   * 鎵归噺鎾ら攢 Token
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
        this.cacheManager.set(`token:${jti}`, 'invalid', INVALID_TOKEN_CACHE_TTL_MS),
      ),
    )
  }

  /**
   * 鎾ら攢鐢ㄦ埛鎵€鏈?Token
   */
  async revokeAllByUserId(userId: number, reason: string) {
    // 鍏堟煡鍑烘墍鏈夋湁鏁堢殑 Token JTI锛岀敤浜庢竻闄ょ紦瀛?
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
        this.cacheManager.set(`token:${jti}`, 'invalid', INVALID_TOKEN_CACHE_TTL_MS),
      ),
    )
  }

  /**
   * 鏌ヨ鐢ㄦ埛鐨勬墍鏈夋椿璺?Token
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
   * 娓呯悊杩囨湡 Token
   * 灏嗚繃鏈熶絾鏈挙閿€鐨?Token 鏍囪涓哄凡鎾ら攢
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
   * 鍒犻櫎宸叉挙閿€鐨勬棫 Token
   * @param retentionDays 淇濈暀澶╂暟
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
