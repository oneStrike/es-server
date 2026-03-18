/**
 * 创建认证 Redis Key 生成器
 * @param prefix - 应用前缀 (如 'admin' 或 'app')
 */
export function createAuthRedisKeys(prefix: string) {
  return {
    /** 登录失败计数 Key */
    LOGIN_FAIL_COUNT: (id: number) => `${prefix}:auth:login:fail:${id}`,
    /** 账号锁定 Key */
    LOGIN_LOCK: (id: number) => `${prefix}:auth:login:lock:${id}`,
  }
}
