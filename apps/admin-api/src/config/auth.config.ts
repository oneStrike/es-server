import process from 'node:process'
import dotenv from 'dotenv'

// 加载环境变量（根据 NODE_ENV 自动选择 .env.development / .env.production）
dotenv.config({
  path: process.env.NODE_ENV ? `.env.${process.env.NODE_ENV}` : '.env',
})

// 时间常量（毫秒）
const MINUTE = 60 * 1000

/**
 * 管理端登录锁定策略配置
 * - maxFailCount: 失败次数阈值，达到或超过将锁定账号
 * - lockDurationMs: 锁定时长，超过该时长后自动解锁
 */
export const ADMIN_LOGIN_POLICY = {
  maxFailCount: (() => {
    const v = Number.parseInt(process.env.ADMIN_LOGIN_LOCK_COUNT || '5', 10)
    return Number.isFinite(v) && v > 0 ? v : 5
  })(),
  lockDurationMs: (() => {
    const min = Number.parseInt(
      process.env.ADMIN_LOGIN_LOCK_DURATION_MIN || '30',
      10,
    )
    const duration = Number.isFinite(min) && min > 0 ? min * MINUTE : 30 * MINUTE
    return duration
  })(),
} as const

export type AdminLoginPolicy = typeof ADMIN_LOGIN_POLICY
