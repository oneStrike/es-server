/// <reference types="jest" />

import 'reflect-metadata'
import { PATH_METADATA } from '@nestjs/common/constants'
import { PaymentController } from './payment.controller'

describe('App PaymentController route smoke', () => {
  it('registers app payment notification route and forwards current user context', async () => {
    const paymentService = {
      confirmPaymentOrder: jest.fn(() =>
        Promise.resolve({ orderNo: 'PAY-1', status: 2 }),
      ),
    }
    const controller = new PaymentController(paymentService as any)

    expect(Reflect.getMetadata(PATH_METADATA, PaymentController)).toBe(
      'app/payment',
    )
    expect(
      Reflect.getMetadata(
        PATH_METADATA,
        PaymentController.prototype.confirmPaymentOrder,
      ),
    ).toBe('notification/create')

    await expect(
      controller.confirmPaymentOrder({ orderNo: 'PAY-1' } as any, 33),
    ).resolves.toEqual({ orderNo: 'PAY-1', status: 2 })
    expect(paymentService.confirmPaymentOrder).toHaveBeenCalledWith(
      { orderNo: 'PAY-1' },
      { userId: 33 },
    )
  })
})
