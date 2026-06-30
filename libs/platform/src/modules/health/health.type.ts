/** cache-manager store 健康检查使用的最小缓存 store 能力。 */
export interface CacheStoreLike {
  opts?: {
    store?: {
      constructor?: {
        name?: string
      }
    }
  }
  set?: (key: string, value: string, ttl?: number) => Promise<boolean | void>
  get?: (key: string) => Promise<string | undefined>
  delete?: (key: string) => Promise<boolean | void>
  del?: (key: string) => Promise<boolean | void>
}

/** cache-manager 多 store 适配结构，用于健康检查区分内存与 Redis store。 */
export interface CacheManagerLike {
  stores?: CacheStoreLike[]
}
