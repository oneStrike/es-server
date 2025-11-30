import process from 'node:process'
/**
 * 环境=辅助函数
 */

/**
 * 获取当前环境
 * @returns 当前环境
 */

export function getEnv(): string {
  return process.env.NODE_ENV || 'development'
}

/**
 * 判断当前是否为开发环境
 * @returns 是否为开发环境
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development'
}

/**
 * 判断当前是否为生产环境
 * @returns 是否为生产环境
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production'
}

/**
 * 判断当前是否为测试环境
 * @returns 是否为测试环境
 */
export function isTest(): boolean {
  return process.env.NODE_ENV === 'test'
}

/**
 * 判断当前是否为预发布环境
 * @returns 是否为预发布环境
 */
export function isProvision(): boolean {
  return process.env.NODE_ENV === 'provision'
}
