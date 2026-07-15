import type { FastifyReply, FastifyRequest } from 'fastify'
import type {
  ProviderNotifyRawBody,
  ProviderNotifyRawPayload,
  ProviderNotifyRawRequest,
} from './payment-provider-notify.type'
import { Buffer } from 'node:buffer'
import {
  ProviderPaymentNotifyBodyDto,
  ProviderPaymentNotifyHeadersDto,
  ProviderPaymentNotifyParamsDto,
  ProviderPaymentNotifyQueryDto,
} from '@libs/interaction/payment/dto/payment.dto'
import { PaymentNotifyService } from '@libs/interaction/payment/payment-notify.service'
import {
  PaymentChannelEnum,
  PaymentProviderNotifyChannelEnum,
} from '@libs/interaction/payment/payment.constant'
import { BusinessErrorCode } from '@libs/platform/constant'
import { Public } from '@libs/platform/decorators'
import { BusinessException } from '@libs/platform/exceptions'
import {
  Controller,
  createParamDecorator,
  ExecutionContext,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common'
import { ApiExcludeController } from '@nestjs/swagger'
import { sendPaymentProviderNotifyAck } from './payment-provider-notify-response'

/** 提取 provider 回调请求头，保留签名校验所需的原始字段。 */
const ProviderNotifyHeaders = createParamDecorator(
  (
    _data: unknown,
    context: ExecutionContext,
  ): ProviderPaymentNotifyHeadersDto => {
    const request = context.switchToHttp().getRequest<FastifyRequest>()
    return { raw: request.headers }
  },
)

/** 提取 provider 回调查询参数，禁止转换或重序列化。 */
const ProviderNotifyQuery = createParamDecorator(
  (
    _data: unknown,
    context: ExecutionContext,
  ): ProviderPaymentNotifyQueryDto => {
    const request = context.switchToHttp().getRequest<FastifyRequest>()
    return {
      raw:
        typeof request.query === 'object' && request.query !== null
          ? (request.query as Record<string, unknown>)
          : {},
    }
  },
)

/** 提取 provider 回调解析体；微信验签仍以另传的 rawBody 为准。 */
const ProviderNotifyBody = createParamDecorator(
  (_data: unknown, context: ExecutionContext): ProviderPaymentNotifyBodyDto => {
    const request = context.switchToHttp().getRequest<FastifyRequest>()
    return {
      raw:
        typeof request.body === 'object' && request.body !== null
          ? (request.body as Record<string, unknown>)
          : {},
    }
  },
)

/** 供第三方支付平台调用的私有回调入口，不属于 App OpenAPI 契约。 */
@ApiExcludeController()
@Controller('app/payment-webhook')
export class PaymentProviderNotifyController {
  constructor(private readonly paymentNotifyService: PaymentNotifyService) {}

  /** 验签并处理 provider 回调后，严格按渠道协议写入成功确认。 */
  @Post(':channel/notify')
  @Public()
  async providerNotify(
    @Param() params: ProviderPaymentNotifyParamsDto,
    @ProviderNotifyHeaders() headers: ProviderPaymentNotifyHeadersDto,
    @ProviderNotifyQuery() query: ProviderPaymentNotifyQueryDto,
    @ProviderNotifyBody() body: ProviderPaymentNotifyBodyDto,
    @Req() request: ProviderNotifyRawRequest,
    @Res() reply: FastifyReply,
  ) {
    await this.paymentNotifyService.handleProviderPaymentNotify({
      body,
      channel: this.toPaymentChannel(params.channel),
      headers,
      query,
      rawBody: this.readRawBody(request.rawBody),
    })
    return sendPaymentProviderNotifyAck(reply, params.channel)
  }

  // 将唯一的回调路径渠道映射到内部支付渠道枚举，不接受兼容别名。
  private toPaymentChannel(
    channel: PaymentProviderNotifyChannelEnum,
  ): PaymentChannelEnum {
    if (channel === PaymentProviderNotifyChannelEnum.ALIPAY) {
      return PaymentChannelEnum.ALIPAY
    }
    if (channel === PaymentProviderNotifyChannelEnum.WECHAT) {
      return PaymentChannelEnum.WECHAT
    }
    throw new BusinessException(
      BusinessErrorCode.OPERATION_NOT_ALLOWED,
      '不支持的支付渠道',
    )
  }

  // 读取 Fastify 保留的 UTF-8 原文，避免签名参与字段被重序列化。
  private readRawBody(
    rawBody: ProviderNotifyRawBody,
  ): ProviderNotifyRawPayload {
    if (Buffer.isBuffer(rawBody)) {
      return rawBody.toString('utf8')
    }
    if (typeof rawBody === 'string' && rawBody.length > 0) {
      return rawBody
    }
    return undefined
  }
}
