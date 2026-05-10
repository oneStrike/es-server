import {
  ConfirmPaymentOrderDto,
  PaymentOrderResultDto,
} from '@libs/interaction/payment/dto/payment.dto'
import { PaymentService } from '@libs/interaction/payment/payment.service'
import { ApiDoc, CurrentUser } from '@libs/platform/decorators'
import { Body, Controller, Post } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('支付')
@Controller('app/payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  // 确认客户端支付通知，并复用支付结算幂等核心。
  @Post('notification/create')
  @ApiDoc({
    summary: '确认支付通知',
    model: PaymentOrderResultDto,
  })
  async confirmPaymentOrder(
    @Body() body: ConfirmPaymentOrderDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.paymentService.confirmPaymentOrder(body, { userId })
  }
}
