import { Module } from '@nestjs/common'
import { EventDefinitionService } from './event-definition.service'

/**
 * 事件定义模块。
 * 统一暴露代码级事件注册表查询能力，供成长、任务、通知和治理按需复用。
 */
@Module({
  providers: [EventDefinitionService],
  exports: [EventDefinitionService],
})
export class EventDefinitionModule {}
