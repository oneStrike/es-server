/** APP 短信验证码限流配置，来自 app.auth.smsRateLimit 并在服务内归一化。 */
export interface SmsRateLimitConfig {
  phoneTemplateCooldownSeconds: number
  phoneTemplateDailyLimit: number
  ipTemplateMinuteLimit: number
  phoneIpHourLimit: number
}

/** APP 短信限流使用的 Redis 客户端最小能力。 */
export interface RedisRateLimitClient {
  expire: (key: string, seconds: number) => Promise<unknown>
  incr: (key: string) => Promise<number>
  set: (
    key: string,
    value: string,
    options?: { NX?: boolean, PX?: number },
  ) => Promise<null | string>
}

/** cache-manager store 中可选 Redis 限流能力的结构视图。 */
export interface RedisRateLimitStore {
  client?: RedisRateLimitClient
  keyPrefixSeparator?: string
  namespace?: string
}

/** 短信限流配置的部分字段，用于配置读取。 */
export type SmsRateLimitConfigPartial = Partial<SmsRateLimitConfig>

/** cache-manager store 中 Redis 限流能力的部分结构视图。 */
export type RedisRateLimitStoreWithClient = Partial<RedisRateLimitStore> & {
  client?: Partial<RedisRateLimitClient>
}
