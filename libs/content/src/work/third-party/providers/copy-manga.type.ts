/** CopyManga 所有接口统一使用的响应外壳，仅供 provider 内部解析。 */
export interface CopyMangaResponse<TResult> {
  code?: number
  message?: string
  results?: TResult | null
}

/** CopyManga 网络发现接口返回的 API host 列表。 */
export interface CopyMangaNetworkResponse {
  code?: number
  message?: string
  results?: {
    api?: unknown
  }
}

/** CopyManga 原生 fetch 传输错误的最小诊断结构。 */
export interface CopyMangaTransportError extends Error {
  /** 非 2xx 响应对应的 HTTP 状态码。 */
  response?: {
    status?: number
    retryAfterHeader?: string
  }
  /** fetch/undici 层可能暴露的传输错误码。 */
  code?: string
  /** fetch/undici 层可能嵌套的底层错误。 */
  cause?: {
    code?: string
  }
}

/** CopyManga API host 缓存条目。 */
export interface CopyMangaApiHostCache {
  expiresAt: number
  hosts: string[]
}

/** CopyManga API 请求失败后可安全落库/分支判断的诊断原因。 */
export interface CopyMangaApiFailureCause {
  kind: 'http' | 'transport' | 'provider'
  path: string
  reason: string
  status?: number
  code?: string
  rateLimited?: true
  retryAfterHeader?: string
  retryAfterMs?: number
  retryAt?: string
}

/** CopyManga 安全 JSON 请求入参。 */
export interface CopyMangaJsonRequestInput {
  url: URL
  address: import('node:dns').LookupAddress
  headers: Record<string, string>
}

/** CopyManga host 通过 allowlist 和 DNS 校验后的请求目标。 */
export interface CopyMangaValidatedRequestTarget {
  url: URL
  address: import('node:dns').LookupAddress
}

/** CopyManga 分类、作者、地区等命名项的原始形状。 */
export interface CopyMangaNamedItem {
  name?: string
  path_word?: string
  display?: string
  value?: string
}

/** CopyManga 搜索接口的结果集合。 */
export interface CopyMangaSearchResults {
  total?: number
  limit?: number
  offset?: number
  list?: Array<{
    path_word?: string
    name?: string
    cover?: string
    author?: CopyMangaNamedItem[]
  }>
}

/** CopyManga 搜索接口的单条漫画结果。 */
export type CopyMangaSearchItem = NonNullable<
  CopyMangaSearchResults['list']
>[number]

/** CopyManga 漫画详情接口的结果对象。 */
export interface CopyMangaDetailResults {
  is_lock?: boolean
  is_login?: boolean
  is_mobile_bind?: boolean
  is_vip?: boolean
  popular?: number
  comic?: {
    uuid?: string
    name?: string
    alias?: string
    path_word?: string
    cover?: string
    brief?: string
    region?: CopyMangaNamedItem | string
    status?: CopyMangaNamedItem | string
    author?: CopyMangaNamedItem[]
    theme?: CopyMangaNamedItem[]
    reclass?: CopyMangaNamedItem | string
    parodies?: CopyMangaNamedItem[]
    clubs?: CopyMangaNamedItem[]
    datetime_updated?: string
    popular?: number
  }
  groups?: Record<
    string,
    {
      path_word?: string
      count?: number
      name?: string
    }
  >
}

/** CopyManga 章节列表接口的结果对象。 */
export interface CopyMangaChapterResults {
  list?: Array<{
    index?: number
    uuid?: string
    count?: number
    size?: number
    name?: string
    group_path_word?: string
    type?: number
    datetime_created?: string
  }>
}

/** CopyManga 章节列表接口的单条章节结果。 */
export type CopyMangaChapterListItem = NonNullable<
  CopyMangaChapterResults['list']
>[number]

/** CopyManga 章节内容接口的图片结果对象。 */
export interface CopyMangaChapterContentResults {
  chapter?: {
    uuid?: string
    name?: string
    contents?: Array<{
      uuid?: string
      url?: string
    }>
  }
}

/** CopyManga 章节内容接口中的单张图片对象。 */
export type CopyMangaChapterContentImage = NonNullable<
  NonNullable<CopyMangaChapterContentResults['chapter']>['contents']
>[number]
