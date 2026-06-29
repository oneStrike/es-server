/// <reference types="jest" />

import { AuditActionTypeEnum } from '@libs/platform/modules/audit/audit-action.constant'
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants'
import { PaymentController } from './payment.controller'
import 'reflect-metadata'

const SWAGGER_API_EXTRA_MODELS = 'swagger/apiExtraModels'
const SWAGGER_API_RESPONSE = 'swagger/apiResponse'

type PaymentControllerService = ConstructorParameters<
  typeof PaymentController
>[0]
type SwaggerResponses = Record<
  number,
  {
    content: Record<
      string,
      {
        schema: {
          properties: {
            data: {
              properties: {
                list: { items: { $ref: string } }
              }
            }
          }
        }
      }
    >
  }
>

describe('admin PaymentController route smoke', () => {
  function routeHandler(name: string) {
    return Reflect.get(PaymentController.prototype, name)
  }

  it('registers selector, reconcile, and audited repair routes', async () => {
    const paymentService = {
      getPaymentCertificateOptions: jest.fn(async (query) =>
        Promise.resolve(query),
      ),
      getPaymentCredentialOptions: jest.fn(async (query) =>
        Promise.resolve(query),
      ),
      getPaymentProviderAccountOptions: jest.fn(async (query) =>
        Promise.resolve(query),
      ),
      getPaymentReconciliationPage: jest.fn(async (query) =>
        Promise.resolve(query),
      ),
      repairPaidOrder: jest.fn(async () =>
        Promise.resolve({ orderNo: 'PAY-1', status: 2 }),
      ),
    }
    const controller = new PaymentController(
      paymentService as unknown as PaymentControllerService,
    )
    const accountQuery: Parameters<
      PaymentController['getPaymentProviderAccountOptions']
    >[0] = { channel: 1 }
    const credentialQuery: Parameters<
      PaymentController['getPaymentCredentialOptions']
    >[0] = { credentialType: 1 }
    const certificateQuery: Parameters<
      PaymentController['getPaymentCertificateOptions']
    >[0] = { certificateType: 2 }
    const reconciliationQuery: Parameters<
      PaymentController['getPaymentReconciliationPage']
    >[0] = { status: 1 }
    const repairPayload: Parameters<PaymentController['repairPaidOrder']>[0] = {
      evidence: { source: 'route-smoke' },
      orderNo: 'PAY-1',
      paidAmount: 100,
      providerTradeNo: 'provider-trade-no',
      reason: '线下对账确认已收款',
      reconciliationRecordId: 1,
    }

    expect(Reflect.getMetadata(PATH_METADATA, PaymentController)).toBe(
      'admin/payment',
    )
    const routePaths = Object.getOwnPropertyNames(PaymentController.prototype)
      .filter((name) => name !== 'constructor')
      .map((name) => Reflect.getMetadata(PATH_METADATA, routeHandler(name)))
    expect(routePaths).not.toContain('order/update-status')
    expect(routeHandler('confirmPaymentOrder')).toBeUndefined()
    expect(
      Reflect.getMetadata(
        PATH_METADATA,
        routeHandler('getPaymentProviderAccountOptions'),
      ),
    ).toBe('provider-account-option/list')
    expect(
      Reflect.getMetadata(
        PATH_METADATA,
        routeHandler('getPaymentCredentialOptions'),
      ),
    ).toBe('credential-option/list')
    expect(
      Reflect.getMetadata(
        PATH_METADATA,
        routeHandler('getPaymentCertificateOptions'),
      ),
    ).toBe('certificate-option/list')
    expect(
      Reflect.getMetadata(
        PATH_METADATA,
        routeHandler('getPaymentReconciliationPage'),
      ),
    ).toBe('reconcile/page')
    expect(
      Reflect.getMetadata(
        METHOD_METADATA,
        routeHandler('getPaymentReconciliationPage'),
      ),
    ).toBe(0)
    expect(
      Reflect.getMetadata(PATH_METADATA, routeHandler('repairPaidOrder')),
    ).toBe('order/repair-paid')
    expect(
      Reflect.getMetadata(METHOD_METADATA, routeHandler('repairPaidOrder')),
    ).toBe(1)
    expect(
      Reflect.getMetadata('audit', routeHandler('repairPaidOrder')),
    ).toMatchObject({
      actionType: AuditActionTypeEnum.UPDATE,
      content: '异常修复支付订单为已支付',
    })

    await expect(
      controller.getPaymentProviderAccountOptions(accountQuery),
    ).resolves.toEqual(accountQuery)
    await expect(
      controller.getPaymentCredentialOptions(credentialQuery),
    ).resolves.toEqual(credentialQuery)
    await expect(
      controller.getPaymentCertificateOptions(certificateQuery),
    ).resolves.toEqual(certificateQuery)
    await expect(
      controller.getPaymentReconciliationPage(reconciliationQuery),
    ).resolves.toEqual(reconciliationQuery)
    await expect(controller.repairPaidOrder(repairPayload, 7)).resolves.toEqual(
      { orderNo: 'PAY-1', status: 2 },
    )
    expect(paymentService.repairPaidOrder).toHaveBeenCalledWith(
      repairPayload,
      7,
    )
  })

  it('documents order page with the admin page item DTO instead of the app payment result DTO', () => {
    const method = routeHandler('getPaymentOrderPage')
    const extraModels =
      (Reflect.getMetadata(SWAGGER_API_EXTRA_MODELS, method) as
        | Array<{ name: string }>
        | undefined) ?? []
    const modelNames = extraModels.map((model) => model.name)
    const responses = Reflect.getMetadata(
      SWAGGER_API_RESPONSE,
      method,
    ) as SwaggerResponses

    expect(modelNames).toContain('AdminPaymentOrderPageItemDto')
    expect(modelNames).not.toContain('PaymentOrderResultDto')
    expect(
      responses[200].content['application/json'].schema.properties.data
        .properties.list.items.$ref,
    ).toBe('#/components/schemas/AdminPaymentOrderPageItemDto')
  })
})
