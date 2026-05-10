/// <reference types="jest" />

import 'reflect-metadata'
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants'
import { AuditActionTypeEnum } from '@libs/platform/modules/audit/audit-action.constant'
import { DECORATORS } from '@nestjs/swagger/dist/constants'
import { PaymentController } from './payment.controller'

describe('Admin PaymentController route smoke', () => {
  it('registers the split admin payment route and audited manual settlement entry', async () => {
    const paymentService = {
      confirmPaymentOrderManually: jest.fn(() =>
        Promise.resolve({ orderNo: 'PAY-1', status: 2 }),
      ),
    }
    const controller = new PaymentController(paymentService as any)

    expect(Reflect.getMetadata(PATH_METADATA, PaymentController)).toBe(
      'admin/payment',
    )
    expect(
      Reflect.getMetadata(
        PATH_METADATA,
        PaymentController.prototype.confirmPaymentOrder,
      ),
    ).toBe('order/update-status')
    expect(
      Reflect.getMetadata(
        METHOD_METADATA,
        PaymentController.prototype.confirmPaymentOrder,
      ),
    ).toBe(1)
    expect(
      Reflect.getMetadata(
        'audit',
        PaymentController.prototype.confirmPaymentOrder,
      ),
    ).toMatchObject({
      actionType: AuditActionTypeEnum.UPDATE,
      content: '手工确认支付订单状态',
    })

    await expect(
      controller.confirmPaymentOrder({ orderNo: 'PAY-1' } as any),
    ).resolves.toEqual({ orderNo: 'PAY-1', status: 2 })
    expect(paymentService.confirmPaymentOrderManually).toHaveBeenCalledWith({
      orderNo: 'PAY-1',
    })
  })

  it('documents order page with the admin page item DTO instead of the app payment result DTO', () => {
    const method = PaymentController.prototype.getPaymentOrderPage
    const extraModels =
      (Reflect.getMetadata(DECORATORS.API_EXTRA_MODELS, method) as
        | Array<{ name: string }>
        | undefined) ?? []
    const modelNames = extraModels.map((model) => model.name)
    const responses = Reflect.getMetadata(
      DECORATORS.API_RESPONSE,
      method,
    ) as Record<string, any>

    expect(modelNames).toContain('AdminPaymentOrderPageItemDto')
    expect(modelNames).not.toContain('PaymentOrderResultDto')
    expect(
      responses[200].content['application/json'].schema.properties.data
        .properties.list.items.$ref,
    ).toBe('#/components/schemas/AdminPaymentOrderPageItemDto')
  })
})
