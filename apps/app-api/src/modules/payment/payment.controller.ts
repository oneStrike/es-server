import type { FastifyRequest } from 'fastify'
import { Buffer } from 'node:buffer'
import {
  GetPaymentOrderStatusDto,
  PaymentOrderStatusDto,
} from '@libs/interaction/payment/dto/payment.dto'
import { PaymentChannelEnum } from '@libs/interaction/payment/payment.constant'
import { PaymentService } from '@libs/interaction/payment/payment.service'
import { BusinessErrorCode } from '@libs/platform/constant'
import { ApiDoc, CurrentUser, Public } from '@libs/platform/decorators'
import { BusinessException } from '@libs/platform/exceptions'
import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('支付')
@Controller('app/payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('provider/:channel/notify')
  @Public()
  @ApiDoc({ summary: 'Provider 支付通知' })
  async providerNotify(
    @Param('channel') channel: string,
    @Headers() headers: Record<string, unknown>,
    @Query() query: Record<string, unknown>,
    @Body() body: Record<string, unknown>,
    @Req() request: FastifyRequest & { rawBody?: Buffer | string },
  ) {
    return this.paymentService.handleProviderPaymentNotify({
      channel: this.parsePaymentChannel(channel),
      headers,
      query,
      body,
      rawBody: this.readRawBody(request.rawBody),
    })
  }

  @Get('order/status')
  @ApiDoc({
    summary: '查询支付订单状态',
    model: PaymentOrderStatusDto,
  })
  async getOrderStatus(
    @Query() query: GetPaymentOrderStatusDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.paymentService.getAppPaymentOrderStatus(userId, query.orderNo)
  }

  private parsePaymentChannel(channel: string): PaymentChannelEnum {
    if (channel === 'alipay' || channel === '1') {
      return PaymentChannelEnum.ALIPAY
    }
    if (channel === 'wechat' || channel === '2') {
      return PaymentChannelEnum.WECHAT
    }
    throw new BusinessException(
      BusinessErrorCode.OPERATION_NOT_ALLOWED,
      '不支持的支付渠道',
    )
  }

  private readRawBody(rawBody: Buffer | string | undefined) {
    if (Buffer.isBuffer(rawBody)) {
      return rawBody.toString('utf8')
    }
    if (typeof rawBody === 'string' && rawBody.length > 0) {
      return rawBody
    }
    return undefined
  }
}
