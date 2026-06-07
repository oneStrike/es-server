import type { PaymentOrderSelect } from '@db/schema'
import type {
  PaymentProviderAdapter,
  PaymentProviderCreateOrderInput,
  PaymentProviderNotifyInput,
  PaymentProviderNotifyOrderNoInput,
  PaymentRefundParsedNotify,
} from './types/payment.type'
import { Buffer } from 'node:buffer'
import {
  createDecipheriv,
  createSign,
  createVerify,
  randomBytes,
} from 'node:crypto'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { Logger } from '@nestjs/common'
import { AlipaySdk } from 'alipay-sdk'
import {
  PaymentChannelEnum,
  PaymentSceneEnum,
} from './payment.constant'
import {
  readNumberField,
  readRecord,
  readStringField,
} from './provider-verification.util'

abstract class BasePaymentProviderAdapter implements PaymentProviderAdapter {
  abstract readonly channel: PaymentChannelEnum
  private readonly logger = new Logger(BasePaymentProviderAdapter.name)

  // 生成客户端拉起 provider 支付所需的场景化参数。
  async createOrder(input: PaymentProviderCreateOrderInput) {
    if (
      input.order.channel !== this.channel ||
      input.config.channel !== this.channel
    ) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '支付 provider 下单渠道不匹配',
      )
    }

    if (this.channel === PaymentChannelEnum.ALIPAY) {
      return this.createAlipayOrder(input)
    }

    if (this.channel === PaymentChannelEnum.WECHAT) {
      return this.createWechatOrder(input)
    }

    throw new BusinessException(
      BusinessErrorCode.OPERATION_NOT_ALLOWED,
      '不支持的支付 provider 下单渠道',
    )
  }

  // 校验 provider 支付回调签名。
  extractNotifyOrderNo(input: PaymentProviderNotifyOrderNoInput) {
    if (this.channel === PaymentChannelEnum.ALIPAY) {
      return (
        readStringField(this.readProviderNotifyBody(input), 'out_trade_no') ??
        undefined
      )
    }

    if (this.channel === PaymentChannelEnum.WECHAT) {
      const resource = this.decryptWechatNotifyResource(input)
      return readStringField(resource, 'out_trade_no') ?? undefined
    }

    return undefined
  }

  // 校验 provider 支付回调签名。
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

    if (this.channel === PaymentChannelEnum.ALIPAY) {
      return this.verifyAlipayNotify(input)
    }

    if (this.channel === PaymentChannelEnum.WECHAT) {
      return this.verifyWechatNotify(input)
    }

    return false
  }

  // 从已验签 provider 回调中解析 service 可消费的可信支付事实。
  parseNotify(input: PaymentProviderNotifyInput) {
    const payload = this.readProviderNotifyBody(input)
    if (this.channel === PaymentChannelEnum.ALIPAY) {
      return {
        providerTradeNo: readStringField(payload, 'trade_no') ?? undefined,
        paidAmount:
          this.readAlipayAmountCents(payload, 'total_amount') ?? undefined,
      }
    }

    if (this.channel === PaymentChannelEnum.WECHAT) {
      const resource = this.decryptWechatNotifyResource(input)
      const amount = readRecord(resource?.amount)
      return {
        providerTradeNo:
          readStringField(resource, 'transaction_id') ?? undefined,
        paidAmount: readNumberField(amount, 'payer_total') ?? undefined,
      }
    }

    return {
      providerTradeNo: readStringField(payload, 'providerTradeNo') ?? undefined,
      paidAmount: readNumberField(payload, 'paidAmount') ?? undefined,
    }
  }

  // Provider 订单查询未接真实通道前必须 fail closed，避免把本地订单行误当三方事实。
  queryOrder(order: PaymentOrderSelect): Record<string, unknown> {
    throw new BusinessException(
      BusinessErrorCode.OPERATION_NOT_ALLOWED,
      `支付订单 ${order.orderNo} 的 provider 查询未接入`,
    )
  }

  // 本轮退款执行固定 fail closed，避免形成未闭环的资金反向路径。
  refund(order: PaymentOrderSelect): Record<string, unknown> {
    this.logger.warn(
      `payment_refund_blocked orderNo=${order.orderNo} channel=${order.channel} status=${order.status} providerConfigId=${order.providerConfigId}`,
    )
    throw new BusinessException(
      BusinessErrorCode.OPERATION_NOT_ALLOWED,
      `支付订单 ${order.orderNo} 暂未开放退款执行`,
    )
  }

  // 从 provider 退款回调中解析内部对账所需的交易号。
  parseRefundNotify(
    input: PaymentProviderNotifyInput,
  ): PaymentRefundParsedNotify {
    const payload = input.payload ?? {}
    return {
      providerTradeNo:
        typeof payload.providerTradeNo === 'string'
          ? payload.providerTradeNo
          : undefined,
    }
  }

  private createAlipayOrder(input: PaymentProviderCreateOrderInput) {
    const privateKey = input.credentialMaterial?.appPrivateKeyPem
    if (!privateKey) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '支付宝下单缺少应用私钥材料',
      )
    }
    const sdk = new AlipaySdk({
      appId: input.config.appId,
      privateKey,
      alipayPublicKey: input.credentialMaterial?.alipayPublicKeyPem,
      endpoint:
        this.readMetadataString(input.config.configMetadata, 'alipayEndpoint') ??
        undefined,
      keyType: input.credentialMaterial?.alipayKeyType ?? 'PKCS8',
      signType: 'RSA2',
    })
    const bizContent = {
      out_trade_no: input.order.orderNo,
      product_code:
        input.order.paymentScene === PaymentSceneEnum.H5
          ? 'QUICK_WAP_WAY'
          : 'QUICK_MSECURITY_PAY',
      subject: this.buildOrderSubject(input),
      total_amount: this.formatAmountYuan(input.order.payableAmount),
    }
    const commonParams = {
      bizContent,
      notifyUrl: input.config.notifyUrl ?? undefined,
    }
    if (input.order.paymentScene === PaymentSceneEnum.H5) {
      return {
        channel: 'alipay',
        scene: 'h5',
        payUrl: sdk.pageExecute('alipay.trade.wap.pay', 'GET', {
          ...commonParams,
          returnUrl:
            input.sceneContext.returnUrl ?? input.config.returnUrl ?? undefined,
        }),
      }
    }
    if (input.order.paymentScene === PaymentSceneEnum.APP) {
      return {
        channel: 'alipay',
        scene: 'app',
        orderString: sdk.sdkExecute('alipay.trade.app.pay', commonParams),
      }
    }
    throw new BusinessException(
      BusinessErrorCode.OPERATION_NOT_ALLOWED,
      '支付宝暂不支持该支付场景',
    )
  }

  private async createWechatOrder(input: PaymentProviderCreateOrderInput) {
    const apiV3Key = input.credentialMaterial?.wechatApiV3Key
    const merchantSerialNo = input.credentialMaterial?.wechatMerchantSerialNo
    const privateKey = input.credentialMaterial?.appPrivateKeyPem
    if (!apiV3Key || !merchantSerialNo || !privateKey) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '微信下单缺少商户私钥、证书序列号或 APIv3 key 材料',
      )
    }
    const path = this.getWechatTransactionPath(input.order.paymentScene)
    const body = this.buildWechatTransactionBody(input)
    const response = await this.postWechatTransaction(input, path, body)
    if (input.order.paymentScene === PaymentSceneEnum.H5) {
      const h5Url =
        readStringField(response, 'h5_url') ??
        readStringField(response, 'mweb_url')
      if (!h5Url) {
        throw new BusinessException(
          BusinessErrorCode.OPERATION_NOT_ALLOWED,
          '微信 H5 下单未返回拉起地址',
        )
      }
      return {
        channel: 'wechat',
        mwebUrl: h5Url,
        scene: 'h5',
      }
    }
    const prepayId = readStringField(response, 'prepay_id')
    if (!prepayId) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '微信下单未返回 prepay_id',
      )
    }
    return this.buildWechatClientPayPayload(input, prepayId)
  }

  private getWechatTransactionPath(scene: PaymentSceneEnum | number) {
    if (scene === PaymentSceneEnum.APP) {
      return '/v3/pay/transactions/app'
    }
    if (scene === PaymentSceneEnum.H5) {
      return '/v3/pay/transactions/h5'
    }
    if (scene === PaymentSceneEnum.MINI_PROGRAM) {
      return '/v3/pay/transactions/jsapi'
    }
    throw new BusinessException(
      BusinessErrorCode.OPERATION_NOT_ALLOWED,
      '微信暂不支持该支付场景',
    )
  }

  private buildWechatTransactionBody(input: PaymentProviderCreateOrderInput) {
    const body: Record<string, unknown> = {
      amount: {
        currency: 'CNY',
        total: input.order.payableAmount,
      },
      appid: input.config.appId,
      description: this.buildOrderSubject(input),
      mchid: input.config.mchId,
      notify_url: input.config.notifyUrl,
      out_trade_no: input.order.orderNo,
    }
    if (!body.notify_url) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '微信下单缺少通知地址',
      )
    }
    if (input.order.paymentScene === PaymentSceneEnum.MINI_PROGRAM) {
      if (!input.sceneContext.openId) {
        throw new BusinessException(
          BusinessErrorCode.OPERATION_NOT_ALLOWED,
          '微信小程序支付缺少 openId',
        )
      }
      body.payer = { openid: input.sceneContext.openId }
    }
    if (input.order.paymentScene === PaymentSceneEnum.H5) {
      if (!input.sceneContext.terminalIp) {
        throw new BusinessException(
          BusinessErrorCode.OPERATION_NOT_ALLOWED,
          '微信 H5 支付缺少终端 IP',
        )
      }
      body.scene_info = {
        h5_info: {
          type:
            this.readMetadataString(input.config.configMetadata, 'h5Type') ??
            'Wap',
        },
        payer_client_ip: input.sceneContext.terminalIp,
      }
    }
    return body
  }

  private async postWechatTransaction(
    input: PaymentProviderCreateOrderInput,
    path: string,
    body: Record<string, unknown>,
  ) {
    const bodyText = JSON.stringify(body)
    const endpoint =
      this.readMetadataString(input.config.configMetadata, 'wechatEndpoint') ??
      'https://api.mch.weixin.qq.com'
    const response = await fetch(`${endpoint}${path}`, {
      body: bodyText,
      headers: {
        "Accept": 'application/json',
        "Authorization": this.buildWechatAuthorization(input, path, bodyText),
        'Content-Type': 'application/json',
      },
      method: 'POST',
    })
    const responseText = await response.text()
    const payload = this.parseJsonRecord(responseText)
    if (!response.ok) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        `微信下单失败: ${readStringField(payload, 'message') ?? response.status}`,
      )
    }
    return payload
  }

  private buildWechatAuthorization(
    input: PaymentProviderCreateOrderInput,
    path: string,
    bodyText: string,
  ) {
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const nonce = randomBytes(16).toString('hex')
    const signContent = `POST\n${path}\n${timestamp}\n${nonce}\n${bodyText}\n`
    const signature = this.signRsaSha256(
      signContent,
      this.requireMaterial(
        input.credentialMaterial?.appPrivateKeyPem,
        '微信下单缺少商户私钥材料',
      ),
    )
    return [
      'WECHATPAY2-SHA256-RSA2048',
      `mchid="${input.config.mchId}"`,
      `nonce_str="${nonce}"`,
      `signature="${signature}"`,
      `timestamp="${timestamp}"`,
      `serial_no="${this.requireMaterial(
        input.credentialMaterial?.wechatMerchantSerialNo,
        '微信下单缺少商户证书序列号',
      )}"`,
    ].join(' ')
  }

  private buildWechatClientPayPayload(
    input: PaymentProviderCreateOrderInput,
    prepayId: string,
  ) {
    if (input.order.paymentScene === PaymentSceneEnum.H5) {
      return {
        channel: 'wechat',
        scene: 'h5',
        mwebUrl: readStringField(
          input.config.configMetadata as Record<string, unknown> | null,
          'mwebUrl',
        ),
        prepayId,
      }
    }
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const nonceStr = randomBytes(16).toString('hex')
    const packageValue = `prepay_id=${prepayId}`
    if (input.order.paymentScene === PaymentSceneEnum.MINI_PROGRAM) {
      return {
        appId: input.config.appId,
        channel: 'wechat',
        nonceStr,
        packageValue,
        paySign: this.signRsaSha256(
          `${input.config.appId}\n${timestamp}\n${nonceStr}\n${packageValue}\n`,
          this.requireMaterial(
            input.credentialMaterial?.appPrivateKeyPem,
            '微信小程序支付缺少商户私钥材料',
          ),
        ),
        prepayId,
        scene: 'jsapi',
        signType: 'RSA',
        timestamp,
      }
    }
    if (input.order.paymentScene === PaymentSceneEnum.APP) {
      return {
        appId: input.config.appId,
        channel: 'wechat',
        nonceStr,
        packageValue: 'Sign=WXPay',
        partnerId: input.config.mchId,
        prepayId,
        scene: 'app',
        sign: this.signRsaSha256(
          `${input.config.appId}\n${input.config.mchId}\n${prepayId}\n${nonceStr}\n${timestamp}\n`,
          this.requireMaterial(
            input.credentialMaterial?.appPrivateKeyPem,
            '微信 App 支付缺少商户私钥材料',
          ),
        ),
        signType: 'RSA',
        timestamp,
      }
    }
    throw new BusinessException(
      BusinessErrorCode.OPERATION_NOT_ALLOWED,
      '微信暂不支持该支付场景',
    )
  }

  private verifyAlipayNotify(input: PaymentProviderNotifyInput) {
    const payload = this.readProviderNotifyBody(input)
    if (!payload) {
      return false
    }
    const publicKeyPem = input.credentialMaterial?.alipayPublicKeyPem
    const signType = readStringField(payload, 'sign_type')
    const signature = readStringField(payload, 'sign')
    const orderNo = readStringField(payload, 'out_trade_no')
    const providerTradeNo = readStringField(payload, 'trade_no')
    const tradeStatus = readStringField(payload, 'trade_status')
    const paidAmount = this.readAlipayAmountCents(payload, 'total_amount')
    const appId = readStringField(payload, 'app_id')
    if (
      !publicKeyPem ||
      signType !== 'RSA2' ||
      !signature ||
      orderNo !== input.order.orderNo ||
      !providerTradeNo ||
      !this.isAlipaySuccessStatus(tradeStatus) ||
      paidAmount !== input.order.payableAmount ||
      (appId && input.config.appId && appId !== input.config.appId)
    ) {
      return false
    }

    try {
      const verifier = createVerify('RSA-SHA256')
      verifier.update(this.buildAlipayNotifySignContent(payload))
      verifier.end()
      return verifier.verify(publicKeyPem, signature, 'base64')
    } catch {
      return false
    }
  }

  private verifyWechatNotify(input: PaymentProviderNotifyInput) {
    if (!this.verifyWechatHeaderSignature(input)) {
      return false
    }
    const resource = this.decryptWechatNotifyResource(input)
    const amount = readRecord(resource?.amount)
    const orderNo = readStringField(resource, 'out_trade_no')
    const providerTradeNo = readStringField(resource, 'transaction_id')
    const tradeState = readStringField(resource, 'trade_state')
    const paidAmount = readNumberField(amount, 'payer_total')
    const appId = readStringField(resource, 'appid')
    const mchId = readStringField(resource, 'mchid')
    return (
      orderNo === input.order.orderNo &&
      !!providerTradeNo &&
      tradeState === 'SUCCESS' &&
      paidAmount === input.order.payableAmount &&
      (!appId || !input.config.appId || appId === input.config.appId) &&
      (!mchId || !input.config.mchId || mchId === input.config.mchId)
    )
  }

  private verifyWechatHeaderSignature(input: PaymentProviderNotifyInput) {
    const payload = readRecord(input.payload)
    const headers = readRecord(payload?.headers)
    const publicKeyPem = input.credentialMaterial?.wechatPlatformPublicKeyPem
    const expectedSerial = input.credentialMaterial?.wechatPlatformSerialNo
    const timestamp = this.readHeaderField(headers, 'wechatpay-timestamp')
    const nonce = this.readHeaderField(headers, 'wechatpay-nonce')
    const signature = this.readHeaderField(headers, 'wechatpay-signature')
    const serial = this.readHeaderField(headers, 'wechatpay-serial')
    const rawBody = readStringField(payload, 'rawBody')
    if (
      !publicKeyPem ||
      !timestamp ||
      !nonce ||
      !signature ||
      !serial ||
      !rawBody ||
      (expectedSerial && serial !== expectedSerial)
    ) {
      return false
    }

    try {
      const verifier = createVerify('RSA-SHA256')
      verifier.update(`${timestamp}\n${nonce}\n${rawBody}\n`)
      verifier.end()
      return verifier.verify(publicKeyPem, signature, 'base64')
    } catch {
      return false
    }
  }

  private decryptWechatNotifyResource(
    input: PaymentProviderNotifyOrderNoInput,
  ) {
    const payload = this.readProviderNotifyBody(input)
    const resource = readRecord(payload?.resource)
    const apiV3Key = input.credentialMaterial?.wechatApiV3Key
    const algorithm = readStringField(resource, 'algorithm')
    const ciphertext = readStringField(resource, 'ciphertext')
    const associatedData = readStringField(resource, 'associated_data') ?? ''
    const nonce = readStringField(resource, 'nonce')
    if (
      !apiV3Key ||
      Buffer.byteLength(apiV3Key, 'utf8') !== 32 ||
      algorithm !== 'AEAD_AES_256_GCM' ||
      !ciphertext ||
      !nonce
    ) {
      return null
    }

    try {
      const encrypted = Buffer.from(ciphertext, 'base64')
      if (encrypted.length <= 16) {
        return null
      }
      const encryptedPayload = encrypted.subarray(0, encrypted.length - 16)
      const authTag = encrypted.subarray(encrypted.length - 16)
      const decipher = createDecipheriv(
        'aes-256-gcm',
        Buffer.from(apiV3Key, 'utf8'),
        Buffer.from(nonce, 'utf8'),
      )
      decipher.setAuthTag(authTag)
      if (associatedData.length > 0) {
        decipher.setAAD(Buffer.from(associatedData, 'utf8'))
      }
      const plainText = Buffer.concat([
        decipher.update(encryptedPayload),
        decipher.final(),
      ]).toString('utf8')
      return readRecord(JSON.parse(plainText))
    } catch {
      return null
    }
  }

  private buildAlipayNotifySignContent(payload: Record<string, unknown>) {
    return Object.keys(payload)
      .filter((key) => !['sign', 'sign_type'].includes(key))
      .filter((key) => this.isPrimitivePayloadValue(payload[key]))
      .sort()
      .map((key) => `${key}=${payload[key]}`)
      .join('&')
  }

  private readProviderNotifyBody(input: PaymentProviderNotifyOrderNoInput) {
    const payload = readRecord(input.payload)
    return readRecord(payload?.body) ?? payload
  }

  private readAlipayAmountCents(
    payload: Record<string, unknown> | null,
    field: string,
  ) {
    const rawValue = readStringField(payload, field)
    if (!rawValue || !/^\d+(?:\.\d{1,2})?$/.test(rawValue)) {
      return null
    }
    const [yuanPart, fractionPart = ''] = rawValue.split('.')
    const yuan = Number(yuanPart)
    const cents = Number(fractionPart.padEnd(2, '0'))
    if (!Number.isSafeInteger(yuan) || !Number.isSafeInteger(cents)) {
      return null
    }
    return yuan * 100 + cents
  }

  private isAlipaySuccessStatus(status: string | null) {
    return status === 'TRADE_SUCCESS' || status === 'TRADE_FINISHED'
  }

  private readHeaderField(
    headers: Record<string, unknown> | null,
    field: string,
  ) {
    if (!headers) {
      return null
    }
    const entry = Object.entries(headers).find(
      ([key]) => key.toLowerCase() === field,
    )
    const value = entry?.[1]
    if (Array.isArray(value)) {
      return typeof value[0] === 'string' && value[0].trim()
        ? value[0].trim()
        : null
    }
    return typeof value === 'string' && value.trim() ? value.trim() : null
  }

  private isPrimitivePayloadValue(value: unknown) {
    return ['string', 'number', 'boolean'].includes(typeof value)
  }

  private buildOrderSubject(input: PaymentProviderCreateOrderInput) {
    return (
      this.readMetadataString(input.config.configMetadata, 'orderSubject') ??
      `ES payment order ${input.order.orderNo}`
    )
  }

  private formatAmountYuan(amountCents: number) {
    return (amountCents / 100).toFixed(2)
  }

  private readMetadataString(metadata: unknown, field: string) {
    return readStringField(readRecord(metadata), field) ?? undefined
  }

  private parseJsonRecord(input: string) {
    try {
      return readRecord(JSON.parse(input)) ?? {}
    } catch {
      return {}
    }
  }

  private requireMaterial(value: string | undefined, message: string) {
    if (!value) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        message,
      )
    }
    return value
  }

  private signRsaSha256(content: string, privateKey: string) {
    const signer = createSign('RSA-SHA256')
    signer.update(content)
    signer.end()
    return signer.sign(privateKey, 'base64')
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
