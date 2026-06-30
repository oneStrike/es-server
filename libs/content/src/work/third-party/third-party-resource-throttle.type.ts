/** 三方资源解析节流通道。 */
export type ThirdPartyResourceThrottleChannelKind = 'api' | 'image'

/** 三方资源解析节流通道的内存排队状态。 */
export interface ThirdPartyResourceThrottleState {
  nextAvailableAt: number
  queueSize: number
  tail: Promise<void>
}
