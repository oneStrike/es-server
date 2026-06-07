/// <reference types="jest" />

import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { createSign, createVerify, generateKeyPairSync } from 'node:crypto'
import { PaymentService } from '@libs/interaction/payment/payment.service'
import { IS_PUBLIC_KEY } from '@libs/platform/decorators'
import { RequestMethod } from '@nestjs/common'
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants'
import { FastifyAdapter } from '@nestjs/platform-fastify'
import { Test } from '@nestjs/testing'
import { PaymentController } from './payment.controller'
import 'reflect-metadata'

describe('app PaymentController route smoke', () => {
  it('keeps the app payment controller mounted without a client payment confirmation route', () => {
    expect(Reflect.getMetadata(PATH_METADATA, PaymentController)).toBe(
      'app/payment',
    )
    expect('confirmPaymentOrder' in PaymentController.prototype).toBe(false)
  })

  it('exposes provider notify as a public provider-facing POST route', () => {
    const descriptor = Object.getOwnPropertyDescriptor(
      PaymentController.prototype,
      'providerNotify',
    )
    expect(descriptor?.value).toBeDefined()
    expect(Reflect.getMetadata(PATH_METADATA, descriptor?.value)).toBe(
      'provider/:channel/notify',
    )
    expect(Reflect.getMetadata(METHOD_METADATA, descriptor?.value)).toBe(
      RequestMethod.POST,
    )
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, descriptor?.value)).toBe(true)
  })

  it('exposes app order status as an authenticated GET route', () => {
    const descriptor = Object.getOwnPropertyDescriptor(
      PaymentController.prototype,
      'getOrderStatus',
    )
    expect(descriptor?.value).toBeDefined()
    expect(Reflect.getMetadata(PATH_METADATA, descriptor?.value)).toBe(
      'order/status',
    )
    expect(Reflect.getMetadata(METHOD_METADATA, descriptor?.value)).toBe(
      RequestMethod.GET,
    )
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, descriptor?.value)).toBeFalsy()
  })

  it('passes the exact provider-signed raw body through the Fastify transport', async () => {
    const rawBody = [
      '{',
      '  "id": "wechat-event-1",',
      '  "resource": {',
      '    "ciphertext": "cipher",',
      '    "nonce": "nonce",',
      '    "associated_data": "transaction"',
      '  }',
      '}',
    ].join('\n')
    const reconstructedBody = JSON.stringify(JSON.parse(rawBody))
    expect(reconstructedBody).not.toBe(rawBody)

    const { privateKey, publicKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
    })
    const timestamp = '1780826500'
    const nonce = 'wechat-transport-nonce'
    const signedMessage = `${timestamp}\n${nonce}\n${rawBody}\n`
    const signature = createSign('RSA-SHA256')
      .update(signedMessage)
      .sign(privateKey, 'base64')
    expect(
      createVerify('RSA-SHA256')
        .update(`${timestamp}\n${nonce}\n${reconstructedBody}\n`)
        .verify(publicKey, signature, 'base64'),
    ).toBe(false)

    const paymentService = {
      handleProviderPaymentNotify: jest.fn().mockResolvedValue({ ok: true }),
      getAppPaymentOrderStatus: jest.fn(),
    }
    const moduleRef = await Test.createTestingModule({
      controllers: [PaymentController],
      providers: [{ provide: PaymentService, useValue: paymentService }],
    })
      .overrideProvider(PaymentService)
      .useValue(paymentService)
      .compile()
    const app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
      { rawBody: true },
    )
    await app.init()
    await (
      app.getHttpAdapter().getInstance() as unknown as {
        ready: () => Promise<void>
      }
    ).ready()

    try {
      const response = await app.inject({
        method: 'POST',
        url: '/app/payment/provider/wechat/notify',
        headers: {
          'content-type': 'application/json',
          'wechatpay-timestamp': timestamp,
          'wechatpay-nonce': nonce,
          'wechatpay-signature': signature,
        },
        payload: rawBody,
      })

      expect(response.statusCode).toBe(201)
      const notifyInput = paymentService.handleProviderPaymentNotify.mock
        .calls[0][0]
      expect(notifyInput.rawBody).toBe(rawBody)
      expect(
        createVerify('RSA-SHA256')
          .update(`${timestamp}\n${nonce}\n${notifyInput.rawBody}\n`)
          .verify(publicKey, signature, 'base64'),
      ).toBe(true)
    } finally {
      await app.close()
      await moduleRef.close()
    }
  })
})
