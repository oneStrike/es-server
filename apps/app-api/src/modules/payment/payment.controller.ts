import {
  GetPaymentOrderStatusDto,
  PaymentOrderStatusDto,
} from '@libs/interaction/payment/dto/payment.dto'
import { PaymentOrderReadService } from '@libs/interaction/payment/payment-order-read.service'
import { ApiDoc, CurrentUser } from '@libs/platform/decorators'
import { Controller, Get, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('支付')
@Controller('app/payment')
export class PaymentController {
  constructor(
    private readonly paymentOrderReadService: PaymentOrderReadService,
  ) {}

  /** 查询当前登录用户自己的支付订单状态。 */
  @Get('order/status')
  @ApiDoc({
    summary: '查询支付订单状态',
    model: PaymentOrderStatusDto,
  })
  async getOrderStatus(
    @Query() query: GetPaymentOrderStatusDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.paymentOrderReadService.getAppPaymentOrderStatus(
      userId,
      query.orderNo,
    )
  }
}
