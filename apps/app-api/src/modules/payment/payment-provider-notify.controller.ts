import type { ProviderPaymentNotifyParamsDto } from '@libs/interaction/payment/dto/payment.dto'
import type { RawBodyRequest } from '@nestjs/common'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { PaymentNotifyService } from '@libs/interaction/payment/payment-notify.service'
import {
  PaymentChannelEnum,
  PaymentProviderNotifyChannelEnum,
} from '@libs/interaction/payment/payment.constant'
import { BusinessErrorCode } from '@libs/platform/constant'
import { Public } from '@libs/platform/decorators'
import { BusinessException } from '@libs/platform/exceptions'
import {
  Body,
  Controller,
  Headers,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common'
import { ApiExcludeController } from '@nestjs/swagger'
import { sendPaymentProviderNotifyAck } from './payment-provider-notify-response'

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
    @Headers() headers: Record<string, unknown>,
    @Query() query: unknown,
    @Body() body: unknown,
    @Req() request: RawBodyRequest<FastifyRequest>,
    @Res() reply: FastifyReply,
  ) {
    await this.paymentNotifyService.handleProviderPaymentNotify({
      body: { raw: this.toRawRecord(body) },
      channel: this.toPaymentChannel(params.channel),
      headers: { raw: headers },
      query: { raw: this.toRawRecord(query) },
      rawBody: request.rawBody?.toString('utf8'),
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

  // 保持第三方协议字段原样下沉；非对象载荷与旧实现一致地归一为空对象。
  private toRawRecord(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null
      ? (value as Record<string, unknown>)
      : {}
  }
}
