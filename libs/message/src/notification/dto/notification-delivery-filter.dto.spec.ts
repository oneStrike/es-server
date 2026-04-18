import { QueryMessageDispatchPageDto } from '@libs/message/monitor/dto/message-monitor.dto'
import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'
import { QueryNotificationDeliveryPageDto } from './notification.dto'
import 'reflect-metadata'

describe('notification delivery ID filters', () => {
  it('accepts positive bigint query strings for delivery page', () => {
    const dto = plainToInstance(QueryNotificationDeliveryPageDto, {
      eventId: '10001',
      dispatchId: '10088',
    })

    expect(validateSync(dto)).toHaveLength(0)
  })

  it('treats blank ID filters as omitted', () => {
    const dto = plainToInstance(QueryNotificationDeliveryPageDto, {
      eventId: '  ',
      dispatchId: '',
    })

    expect(dto.eventId).toBeUndefined()
    expect(dto.dispatchId).toBeUndefined()
    expect(validateSync(dto)).toHaveLength(0)
  })

  it('rejects invalid ID filters for both delivery and dispatch pages', () => {
    const deliveryDto = plainToInstance(QueryNotificationDeliveryPageDto, {
      eventId: 'abc',
      dispatchId: '-1',
    })
    const dispatchDto = plainToInstance(QueryMessageDispatchPageDto, {
      eventId: '1.5',
      dispatchId: '0',
    })

    expect(validateSync(deliveryDto)).toHaveLength(2)
    expect(validateSync(dispatchDto)).toHaveLength(2)
  })
})
