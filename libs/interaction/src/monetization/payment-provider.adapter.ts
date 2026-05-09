import type { PaymentOrderSelect } from '@db/schema'
import type {
  PaymentProviderAdapter,
  PaymentProviderCreateOrderInput,
  PaymentProviderNotifyInput,
} from './monetization.type'
import {
  PaymentChannelEnum,
  PaymentSceneEnum,
  PaymentSubscriptionModeEnum,
} from './monetization.constant'
import {
  readNumberField,
  readRecord,
  readStringField,
  readVerificationSecret,
  verifyHmacSha256Signature,
} from './provider-verification.util'

abstract class BasePaymentProviderAdapter implements PaymentProviderAdapter {
  abstract readonly channel: PaymentChannelEnum

  // 生成客户端拉起 provider 支付所需的场景化参数。
  createOrder(input: PaymentProviderCreateOrderInput) {
    const { order, config, sceneContext } = input
    const basePayload = {
      channel: this.channel,
      orderNo: order.orderNo,
      amount: order.payableAmount,
      appId: config.appId,
      mchId: config.mchId,
      providerConfigId: config.id,
      providerConfigVersion: config.configVersion,
      credentialVersionRef: config.credentialVersionRef,
      subscriptionMode: order.subscriptionMode,
      supportsAutoRenew: config.supportsAutoRenew,
      agreementNotifyUrl: config.agreementNotifyUrl,
    }

    if (order.paymentScene === PaymentSceneEnum.APP) {
      return {
        ...basePayload,
        scene: 'app',
        sdkPayload: {
          orderNo: order.orderNo,
          amount: order.payableAmount,
        },
      }
    }

    if (order.paymentScene === PaymentSceneEnum.H5) {
      return {
        ...basePayload,
        scene: 'h5',
        redirectUrl: sceneContext.returnUrl ?? config.returnUrl,
      }
    }

    return {
      ...basePayload,
      scene: 'mini_program',
      miniProgramAppId: sceneContext.appId || config.appId,
      openId: sceneContext.openId,
      package: `prepay_id=${order.orderNo}`,
      signType: 'RSA',
      paySign: 'PROVIDER_SIGN_REQUIRED',
    }
  }

  // 校验 provider 支付回调签名，并在自动续费首单中强制协议号参与签名。
  verifyNotify(input: PaymentProviderNotifyInput) {
    const payload = readRecord(input.payload)
    if (
      !payload ||
      input.order.channel !== this.channel ||
      input.config.channel !== this.channel ||
      input.config.id !== input.order.providerConfigId ||
      input.config.credentialVersionRef !== input.order.credentialVersionRef
    ) {
      return false
    }

    const orderNo = readStringField(payload, 'orderNo')
    const providerTradeNo = readStringField(payload, 'providerTradeNo')
    const tradeStatus = readStringField(payload, 'tradeStatus')
    const signType = readStringField(payload, 'signType')
    const signature = readStringField(payload, 'signature')
    const agreementNo = readStringField(payload, 'agreementNo')
    const channel = readNumberField(payload, 'channel')
    const paidAmount = readNumberField(payload, 'paidAmount')
    const providerConfigId = readNumberField(payload, 'providerConfigId')
    const providerConfigVersion = readNumberField(
      payload,
      'providerConfigVersion',
    )
    const credentialVersionRef = readStringField(
      payload,
      'credentialVersionRef',
    )
    if (
      orderNo !== input.order.orderNo ||
      !providerTradeNo ||
      tradeStatus !== 'SUCCESS' ||
      signType !== 'HMAC_SHA256' ||
      !signature ||
      channel !== this.channel ||
      paidAmount !== input.order.payableAmount ||
      providerConfigId !== input.order.providerConfigId ||
      providerConfigVersion !== input.order.providerConfigVersion ||
      credentialVersionRef !== input.order.credentialVersionRef
    ) {
      return false
    }
    if (
      input.order.subscriptionMode ===
      PaymentSubscriptionModeEnum.AUTO_RENEW_SIGNING &&
      !agreementNo
    ) {
      return false
    }

    const secret = readVerificationSecret(input.config.configMetadata)
    if (!secret) {
      return false
    }

    const fields = {
      channel: this.channel,
      credentialVersionRef: input.order.credentialVersionRef,
      orderNo: input.order.orderNo,
      paidAmount,
      providerConfigId: input.order.providerConfigId,
      providerConfigVersion: input.order.providerConfigVersion,
      providerTradeNo,
      tradeStatus,
      ...(agreementNo ? { agreementNo } : {}),
    }

    return verifyHmacSha256Signature({
      secret,
      signature,
      fields,
    })
  }

  // 从已验签 provider 回调中解析 service 可消费的可信支付事实。
  parseNotify(input: PaymentProviderNotifyInput) {
    const payload = readRecord(input.payload)
    return {
      providerTradeNo: readStringField(payload, 'providerTradeNo') ?? undefined,
      paidAmount: readNumberField(payload, 'paidAmount') ?? undefined,
      agreementNo: readStringField(payload, 'agreementNo') ?? undefined,
    }
  }

  // 查询 provider 订单时返回内部统一结构，真实 provider 接入时在子类扩展。
  queryOrder(order: PaymentOrderSelect) {
    return {
      orderNo: order.orderNo,
      status: order.status,
      providerTradeNo: order.providerTradeNo,
    }
  }

  // 发起 provider 退款时返回内部统一结构，真实 provider 接入时在子类扩展。
  refund(order: PaymentOrderSelect) {
    return {
      orderNo: order.orderNo,
      status: order.status,
      refundAccepted: true,
    }
  }

  // 从 provider 退款回调中解析内部对账所需的交易号。
  parseRefundNotify(input: PaymentProviderNotifyInput) {
    const payload = input.payload ?? {}
    return {
      providerTradeNo:
        typeof payload.providerTradeNo === 'string'
          ? payload.providerTradeNo
          : undefined,
    }
  }
}

export class AlipayPaymentProviderAdapter extends BasePaymentProviderAdapter {
  readonly channel = PaymentChannelEnum.ALIPAY
}

export class WechatPaymentProviderAdapter extends BasePaymentProviderAdapter {
  readonly channel = PaymentChannelEnum.WECHAT
}

export const PAYMENT_PROVIDER_ADAPTERS: PaymentProviderAdapter[] = [
  new AlipayPaymentProviderAdapter(),
  new WechatPaymentProviderAdapter(),
]
