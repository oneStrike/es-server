import type { FastifyReply, FastifyRequest } from 'fastify'
import { Buffer } from 'node:buffer'
import {
  GetPaymentOrderStatusDto,
  PaymentOrderStatusDto,
  ProviderPaymentNotifyBodyDto,
  ProviderPaymentNotifyHeadersDto,
  ProviderPaymentNotifyParamsDto,
  ProviderPaymentNotifyQueryDto,
} from '@libs/interaction/payment/dto/payment.dto'
import { PaymentChannelEnum } from '@libs/interaction/payment/payment.constant'
import { PaymentService } from '@libs/interaction/payment/payment.service'
import { BusinessErrorCode } from '@libs/platform/constant'
import { ApiDoc, CurrentUser, Public } from '@libs/platform/decorators'
import { BusinessException } from '@libs/platform/exceptions'
import {
  Controller,
  createParamDecorator,
  ExecutionContext,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common'
import { ApiOkResponse, ApiProduces, ApiTags } from '@nestjs/swagger'

const ProviderNotifyHeaders = createParamDecorator(
  (_data: unknown, context: ExecutionContext): ProviderPaymentNotifyHeadersDto => {
    const request = context.switchToHttp().getRequest<FastifyRequest>()
    return { raw: request.headers }
  },
)

const ProviderNotifyQuery = createParamDecorator(
  (_data: unknown, context: ExecutionContext): ProviderPaymentNotifyQueryDto => {
    const request = context.switchToHttp().getRequest<FastifyRequest>()
    return {
      raw:
        typeof request.query === 'object' && request.query !== null
          ? (request.query as Record<string, unknown>)
          : {},
    }
  },
)

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

@ApiTags('支付')
@Controller('app/payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('provider/:channel/notify')
  @Public()
  @ApiProduces('text/plain', 'application/json')
  @ApiOkResponse({
    description: 'Provider 支付通知确认',
    content: {
      'text/plain': {
        schema: { type: 'string', example: 'success' },
      },
      'application/json': {
        schema: {
          type: 'object',
          required: ['code', 'message'],
          properties: {
            code: { type: 'string', example: 'SUCCESS' },
            message: { type: 'string', example: '成功' },
          },
        },
      },
    },
  })
  async providerNotify(
    @Param() params: ProviderPaymentNotifyParamsDto,
    @ProviderNotifyHeaders() headers: ProviderPaymentNotifyHeadersDto,
    @ProviderNotifyQuery() query: ProviderPaymentNotifyQueryDto,
    @ProviderNotifyBody() body: ProviderPaymentNotifyBodyDto,
    @Req() request: FastifyRequest & { rawBody?: Buffer | string },
    @Res() reply: FastifyReply,
  ) {
    const ack = await this.paymentService.handleProviderPaymentNotify({
      channel: this.parsePaymentChannel(params.channel),
      headers,
      query,
      body,
      rawBody: this.readRawBody(request.rawBody),
    })
    if (typeof ack === 'string') {
      return reply.code(200).type('text/plain').send(ack)
    }
    return reply.code(200).type('application/json').send(ack)
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
