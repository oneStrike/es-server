import type { AppConfigInterface } from '@libs/platform/types'
import type { Cache } from 'cache-manager'
import type {
  RedisRateLimitClient,
  RedisRateLimitStore,
  RedisRateLimitStoreWithClient,
  SmsRateLimitConfig,
  SmsRateLimitConfigPartial,
} from './sms.type'
import { DrizzleService } from '@db/core'
import {
  CheckVerifyCodeDto,
  SendVerifyCodeDto,
} from '@libs/platform/modules/sms/dto'
import { SmsTemplateCodeEnum } from '@libs/platform/modules/sms/sms.constant'
import { SmsService as LibSmsService } from '@libs/platform/modules/sms/sms.service'
import { CACHE_MANAGER } from '@nestjs/cache-manager'

import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { and, eq, isNull } from 'drizzle-orm'
import { AppAuthErrorMessages } from './auth.constant'

const DEFAULT_SMS_RATE_LIMIT: SmsRateLimitConfig = {
  phoneTemplateCooldownSeconds: 60,
  phoneTemplateDailyLimit: 10,
  ipTemplateMinuteLimit: 30,
  phoneIpHourLimit: 5,
}

const SMS_RATE_LIMIT_KEY_PREFIX = 'app:auth:sms'
const UNKNOWN_IP = 'unknown'

/**
 * 应用端短信服务。
 * 负责发送验证码、校验验证码及频控。
 */
@Injectable()
export class SmsService {
  private readonly rateLimitLocks = new Map<string, Promise<void>>()

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly libSmsService: LibSmsService,
    private readonly configService: ConfigService,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  // 复用当前模块共享数据库连接。
  private get db() {
    return this.drizzle.db
  }

  // 复用应用用户表。
  get appUser() {
    return this.drizzle.schema.appUser
  }

  // 发送验证码，根据模板做手机号存在性校验与多维度频控。
  async sendVerifyCode(dto: SendVerifyCodeDto, clientIp = UNKNOWN_IP) {
    const templateCode = dto.templateCode || SmsTemplateCodeEnum.LOGIN_REGISTER
    const normalizedDto = { ...dto, templateCode }

    if (
      SmsTemplateCodeEnum.VERIFY_BIND_PHONE === normalizedDto.templateCode ||
      SmsTemplateCodeEnum.RESET_PASSWORD === normalizedDto.templateCode ||
      SmsTemplateCodeEnum.BIND_NEW_PHONE === normalizedDto.templateCode
    ) {
      const [user] = await this.db
        .select({ id: this.appUser.id })
        .from(this.appUser)
        .where(
          and(
            eq(this.appUser.phoneNumber, normalizedDto.phone),
            isNull(this.appUser.deletedAt),
          ),
        )
        .limit(1)
      if (
        SmsTemplateCodeEnum.BIND_NEW_PHONE === normalizedDto.templateCode
          ? user
          : !user
      ) {
        // 对外统一返回，避免通过发送验证码接口枚举手机号是否存在。
        return true
      }
    }
    await this.enforceSmsRateLimit(normalizedDto, clientIp)

    if (await this.libSmsService.sendVerifyCode(normalizedDto)) {
      return true
    }
    throw new InternalServerErrorException(
      AppAuthErrorMessages.VERIFY_CODE_SEND_FAILED,
    )
  }

  // 校验验证码，失败时抛出 UnauthorizedException。
  async validateVerifyCode(dto: CheckVerifyCodeDto) {
    const normalizedDto = {
      ...dto,
      templateCode: dto.templateCode || SmsTemplateCodeEnum.LOGIN_REGISTER,
    }
    if (await this.libSmsService.checkVerifyCode(normalizedDto)) {
      return true
    }
    throw new UnauthorizedException(
      AppAuthErrorMessages.VERIFY_CODE_CHECK_FAILED,
    )
  }

  // 从配置读取短信频控参数，缺失时回退到默认值。
  private getSmsRateLimitConfig(): SmsRateLimitConfig {
    const configured =
      this.configService.get<AppConfigInterface>('app')?.auth?.smsRateLimit ??
      this.configService.get<SmsRateLimitConfigPartial>(
        'app.auth.smsRateLimit',
      ) ??
      {}

    return {
      phoneTemplateCooldownSeconds: this.toPositiveInteger(
        configured.phoneTemplateCooldownSeconds,
        DEFAULT_SMS_RATE_LIMIT.phoneTemplateCooldownSeconds,
      ),
      phoneTemplateDailyLimit: this.toPositiveInteger(
        configured.phoneTemplateDailyLimit,
        DEFAULT_SMS_RATE_LIMIT.phoneTemplateDailyLimit,
      ),
      ipTemplateMinuteLimit: this.toPositiveInteger(
        configured.ipTemplateMinuteLimit,
        DEFAULT_SMS_RATE_LIMIT.ipTemplateMinuteLimit,
      ),
      phoneIpHourLimit: this.toPositiveInteger(
        configured.phoneIpHourLimit,
        DEFAULT_SMS_RATE_LIMIT.phoneIpHourLimit,
      ),
    }
  }

  // 执行短信频控：优先 Redis，降级到本地 cache + 进程内锁。
  private async enforceSmsRateLimit(
    dto: SendVerifyCodeDto & { templateCode: string },
    clientIp: string,
  ) {
    const config = this.getSmsRateLimitConfig()
    const phoneTemplateKey = this.buildRateLimitKey(
      'phone-template',
      dto.phone,
      dto.templateCode,
    )
    const ipTemplateKey = this.buildRateLimitKey(
      'ip-template',
      clientIp || UNKNOWN_IP,
      dto.templateCode,
    )
    const phoneIpKey = this.buildRateLimitKey(
      'phone-ip',
      dto.phone,
      clientIp || UNKNOWN_IP,
    )

    if (
      await this.enforceRedisSmsRateLimit(
        {
          phoneTemplateKey,
          ipTemplateKey,
          phoneIpKey,
        },
        config,
      )
    ) {
      return
    }

    await this.withRateLimitLocks(
      [phoneTemplateKey, ipTemplateKey, phoneIpKey],
      async () => {
        await this.ensureCooldown(
          `${phoneTemplateKey}:cooldown`,
          config.phoneTemplateCooldownSeconds,
        )
        await this.ensureCounterLimit(
          `${phoneTemplateKey}:daily`,
          config.phoneTemplateDailyLimit,
          24 * 60 * 60,
        )
        await this.ensureCounterLimit(
          `${ipTemplateKey}:minute`,
          config.ipTemplateMinuteLimit,
          60,
        )
        await this.ensureCounterLimit(
          `${phoneIpKey}:hour`,
          config.phoneIpHourLimit,
          60 * 60,
        )
      },
    )
  }

  // 使用 Redis 执行短信频控，不可用时返回 false 降级。
  private async enforceRedisSmsRateLimit(
    keys: {
      phoneTemplateKey: string
      ipTemplateKey: string
      phoneIpKey: string
    },
    config: SmsRateLimitConfig,
  ) {
    const redisStore = this.getRedisRateLimitStore()
    const redis = redisStore?.client
    if (!redis) {
      return false
    }

    const cooldownSet = await redis.set(
      this.toRedisCacheKey(`${keys.phoneTemplateKey}:cooldown`, redisStore),
      String(Date.now()),
      {
        NX: true,
        PX: config.phoneTemplateCooldownSeconds * 1000,
      },
    )
    if (cooldownSet === null) {
      this.throwRateLimited()
    }

    await this.incrementRedisCounter(
      this.toRedisCacheKey(`${keys.phoneTemplateKey}:daily`, redisStore),
      config.phoneTemplateDailyLimit,
      24 * 60 * 60,
      redis,
    )
    await this.incrementRedisCounter(
      this.toRedisCacheKey(`${keys.ipTemplateKey}:minute`, redisStore),
      config.ipTemplateMinuteLimit,
      60,
      redis,
    )
    await this.incrementRedisCounter(
      this.toRedisCacheKey(`${keys.phoneIpKey}:hour`, redisStore),
      config.phoneIpHourLimit,
      60 * 60,
      redis,
    )

    return true
  }

  // Redis 计数器递增，超限抛出 429。
  private async incrementRedisCounter(
    key: string,
    limit: number,
    seconds: number,
    redis: RedisRateLimitClient,
  ) {
    const current = await redis.incr(key)
    if (current === 1) {
      await redis.expire(key, seconds)
    }
    if (current > limit) {
      this.throwRateLimited()
    }
  }

  // 从 cache-manager 的 stores 中探测可用的 Redis 客户端。
  private getRedisRateLimitStore(): RedisRateLimitStore | undefined {
    const [keyvStore] =
      (this.cacheManager as Cache & { stores?: Array<{ store?: unknown }> })
        .stores ?? []
    const store = keyvStore?.store as RedisRateLimitStoreWithClient | undefined
    if (
      typeof store?.client?.set === 'function' &&
      typeof store.client.incr === 'function' &&
      typeof store.client.expire === 'function'
    ) {
      return store
    }
    return undefined
  }

  // 将原始 key 加上 Redis namespace 前缀。
  private toRedisCacheKey(key: string, store: RedisRateLimitStore) {
    if (!store.namespace) {
      return key
    }
    return `${store.namespace}${store.keyPrefixSeparator ?? '::'}${key}`
  }

  // 递归地按 key 顺序获取进程内锁，确保同 key 串行执行。
  private async withRateLimitLocks<T>(
    keys: string[],
    action: () => Promise<T>,
  ): Promise<T> {
    const uniqueKeys = [...new Set(keys)].sort()
    const [key, ...remainingKeys] = uniqueKeys
    if (!key) {
      return action()
    }

    return this.withSingleRateLimitLock(key, async () =>
      this.withRateLimitLocks(remainingKeys, action),)
  }

  // 单 key 进程内锁：排队等待前一个 Promise 完成后再执行。
  private async withSingleRateLimitLock<T>(
    key: string,
    action: () => Promise<T>,
  ) {
    const previous = this.rateLimitLocks.get(key) ?? Promise.resolve()
    let release!: () => void
    const current = new Promise<void>((resolve) => {
      release = resolve
    })
    const queued = previous.then(
      async () => current,
      async () => current,
    )
    this.rateLimitLocks.set(key, queued)

    await previous
    try {
      return await action()
    } finally {
      release()
      if (this.rateLimitLocks.get(key) === queued) {
        this.rateLimitLocks.delete(key)
      }
    }
  }

  // 冷却期检查：key 存在说明仍在冷却期，抛出 429。
  private async ensureCooldown(key: string, seconds: number) {
    const cached = await this.cacheManager.get<number>(key)
    if (cached) {
      this.throwRateLimited()
    }

    await this.cacheManager.set(key, Date.now(), seconds * 1000)
  }

  // 计数器检查：达到上限抛出 429，否则递增。
  private async ensureCounterLimit(
    key: string,
    limit: number,
    seconds: number,
  ) {
    const current = (await this.cacheManager.get<number>(key)) ?? 0
    if (current >= limit) {
      this.throwRateLimited()
    }

    await this.cacheManager.set(key, current + 1, seconds * 1000)
  }

  // 按作用域和组成部分拼接频控 key。
  private buildRateLimitKey(scope: string, ...parts: string[]) {
    return [
      SMS_RATE_LIMIT_KEY_PREFIX,
      scope,
      ...parts.map((part) => encodeURIComponent(part)),
    ].join(':')
  }

  // 安全转换为正整数，非正整数或 NaN 返回 fallback。
  private toPositiveInteger(value: unknown, fallback: number) {
    const numericValue = Number(value)
    return Number.isInteger(numericValue) && numericValue > 0
      ? numericValue
      : fallback
  }

  // 抛出 429 Too Many Requests。
  private throwRateLimited(): never {
    throw new HttpException(
      '验证码请求过于频繁，请稍后再试',
      HttpStatus.TOO_MANY_REQUESTS,
    )
  }
}
