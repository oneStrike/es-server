/**
 * 登录锁配置接口
 */
export interface LoginGuardConfig {
  /** 最大尝试次数 */
  maxAttempts: number
  /** 失败计数过期时间（秒） */
  failTtl: number
  /** 锁定时长（秒） */
  lockTtl: number
}
