import {
  AdminPaymentOrderPageItemDto,
  AdminPaymentProviderConfigPageItemDto,
  AdminPaymentReconciliationPageItemDto,
  CreatePaymentProviderConfigDto,
  PaymentOrderResultDto,
  PaymentProviderAccountOptionDto,
  PaymentProviderAccountOptionQueryDto,
  PaymentProviderCertificateOptionDto,
  PaymentProviderCertificateOptionQueryDto,
  PaymentProviderCredentialOptionDto,
  PaymentProviderCredentialOptionQueryDto,
  QueryPaymentOrderDto,
  QueryPaymentProviderConfigDto,
  QueryPaymentReconciliationDto,
  RepairPaidPaymentOrderDto,
  UpdatePaymentProviderConfigDto,
} from '@libs/interaction/payment/dto/payment.dto'
import { PaymentService } from '@libs/interaction/payment/payment.service'
import { ApiDoc, ApiPageDoc, CurrentUser } from '@libs/platform/decorators'
import { UpdateEnabledStatusDto } from '@libs/platform/dto'
import { AuditActionTypeEnum } from '@libs/platform/modules/audit/audit-action.constant'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { AdminPermission } from '../../common/decorators/admin-permission.decorator'
import { ApiAuditDoc } from '../../common/decorators/api-audit-doc.decorator'

@ApiTags('支付管理')
@Controller('admin/payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  // 分页查询支付 provider 配置。
  @Get('provider/page')
  @AdminPermission({
    code: 'payment:provider:page',
    name: '分页查询支付 provider 配置',
    groupCode: 'payment',
  })
  @ApiPageDoc({
    summary: '分页查询支付 provider 配置',
    model: AdminPaymentProviderConfigPageItemDto,
  })
  async getPaymentProviderConfigPage(
    @Query() query: QueryPaymentProviderConfigDto,
  ) {
    return this.paymentService.getPaymentProviderConfigPage(query)
  }

  // 查询支付 provider 账号选项。
  @Get('provider-account-option/list')
  @AdminPermission({
    code: 'payment:provider:account:option:list',
    name: '查询支付 provider 账号选项',
    groupCode: 'payment',
  })
  @ApiDoc({
    summary: '查询支付 provider 账号选项',
    model: PaymentProviderAccountOptionDto,
    isArray: true,
  })
  async getPaymentProviderAccountOptions(
    @Query() query: PaymentProviderAccountOptionQueryDto,
  ) {
    return this.paymentService.getPaymentProviderAccountOptions(query)
  }

  // 查询支付凭据选项。
  @Get('credential-option/list')
  @AdminPermission({
    code: 'payment:credential:option:list',
    name: '查询支付凭据选项',
    groupCode: 'payment',
  })
  @ApiDoc({
    summary: '查询支付凭据选项',
    model: PaymentProviderCredentialOptionDto,
    isArray: true,
  })
  async getPaymentCredentialOptions(
    @Query() query: PaymentProviderCredentialOptionQueryDto,
  ) {
    return this.paymentService.getPaymentCredentialOptions(query)
  }

  // 查询支付证书选项。
  @Get('certificate-option/list')
  @AdminPermission({
    code: 'payment:certificate:option:list',
    name: '查询支付证书选项',
    groupCode: 'payment',
  })
  @ApiDoc({
    summary: '查询支付证书选项',
    model: PaymentProviderCertificateOptionDto,
    isArray: true,
  })
  async getPaymentCertificateOptions(
    @Query() query: PaymentProviderCertificateOptionQueryDto,
  ) {
    return this.paymentService.getPaymentCertificateOptions(query)
  }

  // 创建支付 provider 配置。
  @Post('provider/create')
  @AdminPermission({
    code: 'payment:provider:create',
    name: '创建支付 provider 配置',
    groupCode: 'payment',
  })
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
  @AdminPermission({
    code: 'payment:provider:update',
    name: '更新支付 provider 配置',
    groupCode: 'payment',
  })
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
  @AdminPermission({
    code: 'payment:provider:update:status',
    name: '更新支付 provider 启用状态',
    groupCode: 'payment',
  })
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
  @AdminPermission({
    code: 'payment:order:page',
    name: '分页查询支付订单',
    groupCode: 'payment',
  })
  @ApiPageDoc({
    summary: '分页查询支付订单',
    model: AdminPaymentOrderPageItemDto,
  })
  async getPaymentOrderPage(@Query() query: QueryPaymentOrderDto) {
    return this.paymentService.getPaymentOrderPage(query)
  }

  // 分页查询支付对账记录。
  @Get('reconcile/page')
  @AdminPermission({
    code: 'payment:reconcile:page',
    name: '分页查询支付对账记录',
    groupCode: 'payment',
  })
  @ApiPageDoc({
    summary: '分页查询支付对账记录',
    model: AdminPaymentReconciliationPageItemDto,
  })
  async getPaymentReconciliationPage(
    @Query() query: QueryPaymentReconciliationDto,
  ) {
    return this.paymentService.getPaymentReconciliationPage(query)
  }

  // 异常修复支付订单为已支付，并复用支付结算幂等核心。
  @Post('order/repair-paid')
  @AdminPermission({
    code: 'payment:order:repair:paid',
    name: '异常修复支付订单为已支付',
    groupCode: 'payment',
  })
  @ApiAuditDoc({
    summary: '异常修复支付订单为已支付',
    model: PaymentOrderResultDto,
    audit: { actionType: AuditActionTypeEnum.UPDATE },
  })
  async repairPaidOrder(
    @Body() body: RepairPaidPaymentOrderDto,
    @CurrentUser('sub') adminUserId: number,
  ) {
    return this.paymentService.repairPaidOrder(body, adminUserId)
  }
}
