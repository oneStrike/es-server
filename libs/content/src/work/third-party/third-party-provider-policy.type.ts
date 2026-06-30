/** 三方 provider host 安全策略，所有远端请求必须先命中该策略。 */
export interface ThirdPartyHostPolicy {
  /** 允许精确访问的 host，必须为小写 hostname。 */
  allowedExactHosts: string[]
  /** 允许访问的子域后缀，不包含通配符。 */
  allowedHostSuffixes: string[]
  /** 是否允许 URL 或 discovery host 携带端口。 */
  allowPort: boolean
  /** 重定向处理策略；当前破坏性版本只允许失败关闭。 */
  redirect: 'error'
  /** 地址安全防护来源；当前统一读取系统安全配置。 */
  addressGuard: 'system-config'
}

/** 三方 provider 在共享导入 runtime 中可展示的稳定文案。 */
export interface ThirdPartyProviderDisplayPolicy {
  /** 面向运维和错误信息的 provider 展示名称。 */
  displayName: string
  /** 写入本地作品 originalSource 的来源标签。 */
  sourceLabel: string
  /** 写入本地作品 remark 的前缀。 */
  workRemarkPrefix: string
}

/** 三方 provider 的远程章节封面能力。 */
export interface ThirdPartyRemoteChapterCoverCapability {
  /** provider 提供可远程导入的章节封面。 */
  mode: 'remote'
}

/** 三方 provider 的无章节封面能力。 */
export interface ThirdPartyUnsupportedChapterCoverCapability {
  /** provider 不提供章节封面。 */
  mode: 'unsupported'
  /** 不支持章节封面的用户可读原因。 */
  reason: string
}

/** 三方 provider 的章节封面能力。 */
export type ThirdPartyChapterCoverCapability =
  | ThirdPartyRemoteChapterCoverCapability
  | ThirdPartyUnsupportedChapterCoverCapability

/** 三方资源解析节流通道元数据，用于定位 provider 的 API/图片/host 缓存语义。 */
export interface ThirdPartyProviderThrottlePolicy {
  /** API 请求节流通道名称。 */
  apiChannel: string
  /** 远程图片请求节流通道名称。 */
  imageChannel: string
}

/** 三方漫画 provider 的运行时策略 contract。 */
export interface ThirdPartyProviderPolicy {
  /** 内容 API 请求 host 策略。 */
  apiHostPolicy: ThirdPartyHostPolicy
  /** 图片下载请求 host 策略。 */
  imageHostPolicy: ThirdPartyHostPolicy
  /** 共享 runtime 可使用的展示策略。 */
  display: ThirdPartyProviderDisplayPolicy
  /** 章节封面能力声明。 */
  chapterCover: ThirdPartyChapterCoverCapability
  /** provider 节流通道元数据。 */
  throttle: ThirdPartyProviderThrottlePolicy
}
