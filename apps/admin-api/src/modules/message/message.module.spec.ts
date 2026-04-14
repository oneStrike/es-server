import { MessageNotificationDeliveryService } from '@libs/message/notification/notification-delivery.service'

import { MessageNotificationTemplateService } from '@libs/message/notification/notification-template.service'
import { MODULE_METADATA } from '@nestjs/common/constants'
import { MessageModule } from './message.module'
import 'reflect-metadata'

jest.mock('uuid', () => ({
  v4: () => 'mock-uuid',
}))

describe('admin MessageModule metadata', () => {
  it('不应在入口层重复声明消息域模板和投递 service provider', () => {
    const providers = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      MessageModule,
    ) as Array<unknown> | undefined

    expect(providers ?? []).not.toContain(MessageNotificationDeliveryService)
    expect(providers ?? []).not.toContain(MessageNotificationTemplateService)
  })
})
