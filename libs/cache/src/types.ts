// 定义 CacheModule 可接受的配置接口
export interface CacheModuleConfig {
  // 缓存过期时间，默认不过期
  ttl?: number
  // 缓存存储类型，数组第一位为默认存储类型，第二位为备用存储类型
  store?: ('redis' | 'memory')[]
}
