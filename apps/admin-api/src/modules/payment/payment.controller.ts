import {
  AdminPaymentOrderPageItemDto,
  BasePaymentProviderConfigDto,
  ConfirmPaymentOrderDto,
  CreatePaymentProviderConfigDto,
  PaymentOrderResultDto,
  QueryPaymentOrderDto,
  QueryPaymentProviderConfigDto,
  UpdatePaymentProviderConfigDto,
} from '@libs/interaction/payment/dto/payment.dto'
import { PaymentService } from '@libs/interaction/payment/payment.service'
import { ApiPageDoc } from '@libs/platform/decorators'
import { UpdateEnabledStatusDto } from '@libs/platform/dto'
import { AuditActionTypeEnum } from '@libs/platform/modules/audit/audit-action.constant'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { ApiAuditDoc } from '../../common/decorators/api-audit-doc.decorator'

@ApiTags('支付管理')
@Controller('admin/payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  // 分页查询支付 provider 配置。
  @Get('provider/page')
  @ApiPageDoc({
    summary: '分页查询支付 provider 配置',
    model: BasePaymentProviderConfigDto,
  })
  async getPaymentProviderConfigPage(
    @Query() query: QueryPaymentProviderConfigDto,
  ) {
    return this.paymentService.getPaymentProviderConfigPage(query)
  }

  // 创建支付 provider 配置。
  @Post('provider/create')
  @ApiAuditDoc({
    summary: '创建支付 provider 配置',
    model: Boolean,
    audit: { actionType: AuditActionTypeEnum.CREATE },
  })
  async createPaymentProviderConfig(
    @Body() body: CreatePaymentProviderConfigDto,
  ) {
    return this.paymentService.createPaymentProviderConfig(body)
  }

  // 更新支付 provider 配置。
  @Post('provider/update')
  @ApiAuditDoc({
    summary: '更新支付 provider 配置',
    model: Boolean,
    audit: { actionType: AuditActionTypeEnum.UPDATE },
  })
  async updatePaymentProviderConfig(
    @Body() body: UpdatePaymentProviderConfigDto,
  ) {
    return this.paymentService.updatePaymentProviderConfig(body)
  }

  // 更新支付 provider 启用状态。
  @Post('provider/update-status')
  @ApiAuditDoc({
    summary: '更新支付 provider 启用状态',
    model: Boolean,
    audit: { actionType: AuditActionTypeEnum.UPDATE },
  })
  async updatePaymentProviderStatus(@Body() body: UpdateEnabledStatusDto) {
    return this.paymentService.updatePaymentProviderStatus(
      body.id,
      body.isEnabled,
    )
  }

  // 分页查询支付订单。
  @Get('order/page')
  @ApiPageDoc({
    summary: '分页查询支付订单',
    model: AdminPaymentOrderPageItemDto,
  })
  async getPaymentOrderPage(@Query() query: QueryPaymentOrderDto) {
    return this.paymentService.getPaymentOrderPage(query)
  }

  // 手工确认支付订单状态，并复用支付结算幂等核心。
  @Post('order/update-status')
  @ApiAuditDoc({
    summary: '手工确认支付订单状态',
    model: PaymentOrderResultDto,
    audit: { actionType: AuditActionTypeEnum.UPDATE },
  })
  async confirmPaymentOrder(@Body() body: ConfirmPaymentOrderDto) {
    return this.paymentService.confirmPaymentOrderManually(body)
  }
}
