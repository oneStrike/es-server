export interface AuthConfig {
  // JWT 配置
  secret: string
  // 刷新令牌 JWT 配置
  refreshSecret: string
  // JWT 过期时间（秒）
  expiresIn: number
  // 刷新令牌 JWT 过期时间（秒）
  refreshExpiresIn: number
  // JWT 受众（aud）
  aud: string
  // 发行者（iss）
  iss?: string
  // 策略键（strategyKey）
  strategyKey: string
}
