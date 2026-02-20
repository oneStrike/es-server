import { Inject, Injectable } from '@nestjs/common'
import { UserGrowthEventDto } from './dto/growth-event.dto'
import { USER_GROWTH_EVENT_BUS } from './growth-event.constant'
import { UserGrowthEventBus } from './growth-event.types'

/**
 * 成长事件服务类
 * 负责接收业务侧事件并发布至成长事件总线
 */
@Injectable()
export class UserGrowthEventService {
  constructor(
    @Inject(USER_GROWTH_EVENT_BUS)
    private readonly eventBus: UserGrowthEventBus,
  ) {}

  /**
   * 发布成长事件
   * @param event 事件数据
   */
  async handleEvent(event: UserGrowthEventDto) {
    await this.eventBus.publish(event)
  }
}
