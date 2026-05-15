import type {
  ThirdPartyResourceThrottleChannel,
  ThirdPartyResourceThrottleState,
} from '../third-party-resource-throttle.type'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { ConfigReader } from '@libs/system-config/config-reader'
import { Injectable } from '@nestjs/common'

@Injectable()
export class ThirdPartyResourceThrottleService {
  private readonly channels: Record<
    ThirdPartyResourceThrottleChannel,
    ThirdPartyResourceThrottleState
  > = {
    api: this.createChannelState(),
    image: this.createChannelState(),
  }

  // 注入系统配置读取器，运行时始终读取已归一化的三方资源解析配置。
  constructor(private readonly configReader: ConfigReader) {}

  // 等待 CopyManga API/discovery 通道可用。
  async waitForApiSlot() {
    await this.waitForChannel('api')
  }

  // 等待三方远程图片下载通道可用。
  async waitForImageSlot() {
    await this.waitForChannel('image')
  }

  // 返回 CopyManga host discovery 缓存 TTL，供 HTTP client 控制缓存失效。
  getHostCacheTtlMs() {
    return (
      this.configReader.getThirdPartyResourceParseConfig().hostCacheTtlSeconds *
      1000
    )
  }

  // 创建单个节流通道的初始状态。
  private createChannelState(): ThirdPartyResourceThrottleState {
    return {
      nextAvailableAt: 0,
      queueSize: 0,
      tail: Promise.resolve(),
    }
  }

  // 按通道串行排队并保证相邻请求之间满足配置间隔。
  private async waitForChannel(channel: ThirdPartyResourceThrottleChannel) {
    const config = this.configReader.getThirdPartyResourceParseConfig()
    if (!config.enabled) {
      return
    }

    const state = this.channels[channel]
    if (state.queueSize >= config.maxQueueSize) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '三方资源解析请求排队过多，请稍后重试',
      )
    }

    state.queueSize += 1
    const intervalMs =
      channel === 'api' ? config.apiIntervalMs : config.imageIntervalMs
    const previousTail = state.tail.catch(() => undefined)
    const currentTurn = previousTail.then(async () => {
      const delayMs = Math.max(0, state.nextAvailableAt - Date.now())
      if (delayMs > 0) {
        await this.delay(delayMs)
      }
      state.nextAvailableAt = Date.now() + intervalMs
    })
    state.tail = currentTurn.catch(() => undefined)

    try {
      await currentTurn
    } finally {
      state.queueSize -= 1
    }
  }

  // 使用原生定时器延迟当前排队项，方便 Jest fake timers 精确验证。
  private delay(delayMs: number) {
    return new Promise<void>((resolve) => {
      setTimeout(resolve, delayMs)
    })
  }
}
