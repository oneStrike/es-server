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
  }
  /** fetch/undici 层可能暴露的传输错误码。 */
  code?: string
  /** fetch/undici 层可能嵌套的底层错误。 */
  cause?: {
    code?: string
  }
}

/** CopyManga API 请求失败后可安全落库/分支判断的诊断原因。 */
export interface CopyMangaApiFailureCause {
  kind: 'http' | 'transport'
  path: string
  reason: string
  status?: number
  code?: string
  routeCandidateRecoverable: boolean
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
