import type { FastifyReply } from 'fastify'
import { PaymentProviderNotifyChannelEnum } from '@libs/interaction/payment/payment.constant'

// 按渠道协议写入第三方成功确认，绕过普通 App JSON 响应包装。
export function sendPaymentProviderNotifyAck(
  reply: FastifyReply,
  channel: PaymentProviderNotifyChannelEnum,
) {
  if (channel === PaymentProviderNotifyChannelEnum.ALIPAY) {
    return reply.code(200).type('text/plain').send('success')
  }
  return reply
    .code(200)
    .type('application/json')
    .send({ code: 'SUCCESS', message: '成功' })
}
