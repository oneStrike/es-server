import {
  BaseAdProviderConfigDto,
  BaseCouponDefinitionDto,
  BaseCurrencyPackageDto,
  BaseMembershipAutoRenewAgreementDto,
  BaseMembershipBenefitDefinitionDto,
  BasePaymentProviderConfigDto,
  ConfirmPaymentOrderDto,
  CreateAdProviderConfigDto,
  CreateCouponDefinitionDto,
  CreateCurrencyPackageDto,
  CreateMembershipBenefitDefinitionDto,
  CreateMembershipPageConfigDto,
  CreateMembershipPlanDto,
  CreatePaymentProviderConfigDto,
  GrantCouponDto,
  MembershipPageConfigItemDto,
  MembershipPlanItemDto,
  PaymentOrderResultDto,
  QueryAdProviderConfigDto,
  QueryCouponDefinitionDto,
  QueryCurrencyPackageDto,
  QueryMembershipAutoRenewAgreementDto,
  QueryMembershipBenefitDefinitionDto,
  QueryMembershipPageConfigDto,
  QueryMembershipPlanDto,
  QueryPaymentOrderDto,
  QueryPaymentProviderConfigDto,
  UpdateAdProviderConfigDto,
  UpdateCouponDefinitionDto,
  UpdateCurrencyPackageDto,
  UpdateMembershipBenefitDefinitionDto,
  UpdateMembershipPageConfigDto,
  UpdateMembershipPlanDto,
  UpdatePaymentProviderConfigDto,
} from '@libs/interaction/monetization/dto/monetization.dto'
import { MonetizationService } from '@libs/interaction/monetization/monetization.service'
import { ApiPageDoc } from '@libs/platform/decorators'
import { IdDto, UpdateEnabledStatusDto } from '@libs/platform/dto'
import { AuditActionTypeEnum } from '@libs/platform/modules/audit/audit-action.constant'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { ApiAuditDoc } from '../../common/decorators/api-audit-doc.decorator'

@ApiTags('变现管理')
@Controller('admin/monetization')
export class MonetizationController {
  constructor(private readonly monetizationService: MonetizationService) {}

  @Get('vip-plan/page')
  @ApiPageDoc({
    summary: '分页查询 VIP 套餐',
    model: MembershipPlanItemDto,
  })
  async getMembershipPlanPage(@Query() query: QueryMembershipPlanDto) {
    return this.monetizationService.getMembershipPlanPage(query)
  }

  @Post('vip-plan/create')
  @ApiAuditDoc({
    summary: '创建 VIP 套餐',
    model: Boolean,
    audit: { actionType: AuditActionTypeEnum.CREATE },
  })
  async createMembershipPlan(@Body() body: CreateMembershipPlanDto) {
    return this.monetizationService.createMembershipPlan(body)
  }

  @Post('vip-plan/update')
  @ApiAuditDoc({
    summary: '更新 VIP 套餐',
    model: Boolean,
    audit: { actionType: AuditActionTypeEnum.UPDATE },
  })
  async updateMembershipPlan(@Body() body: UpdateMembershipPlanDto) {
    return this.monetizationService.updateMembershipPlan(body)
  }

  @Post('vip-plan/update-status')
  @ApiAuditDoc({
    summary: '更新 VIP 套餐启用状态',
    model: Boolean,
    audit: { actionType: AuditActionTypeEnum.UPDATE },
  })
  async updateMembershipPlanStatus(@Body() body: UpdateEnabledStatusDto) {
    return this.monetizationService.updateMembershipPlanStatus(
      body.id,
      body.isEnabled,
    )
  }

  @Get('vip-benefit/page')
  @ApiPageDoc({
    summary: '分页查询会员权益定义',
    model: BaseMembershipBenefitDefinitionDto,
  })
  async getMembershipBenefitDefinitionPage(
    @Query() query: QueryMembershipBenefitDefinitionDto,
  ) {
    return this.monetizationService.getMembershipBenefitDefinitionPage(query)
  }

  @Post('vip-benefit/create')
  @ApiAuditDoc({
    summary: '创建会员权益定义',
    model: Boolean,
    audit: { actionType: AuditActionTypeEnum.CREATE },
  })
  async createMembershipBenefitDefinition(
    @Body() body: CreateMembershipBenefitDefinitionDto,
  ) {
    return this.monetizationService.createMembershipBenefitDefinition(body)
  }

  @Post('vip-benefit/update')
  @ApiAuditDoc({
    summary: '更新会员权益定义',
    model: Boolean,
    audit: { actionType: AuditActionTypeEnum.UPDATE },
  })
  async updateMembershipBenefitDefinition(
    @Body() body: UpdateMembershipBenefitDefinitionDto,
  ) {
    return this.monetizationService.updateMembershipBenefitDefinition(body)
  }

  @Post('vip-benefit/update-status')
  @ApiAuditDoc({
    summary: '更新会员权益启用状态',
    model: Boolean,
    audit: { actionType: AuditActionTypeEnum.UPDATE },
  })
  async updateMembershipBenefitDefinitionStatus(
    @Body() body: UpdateEnabledStatusDto,
  ) {
    return this.monetizationService.updateMembershipBenefitDefinitionStatus(
      body.id,
      body.isEnabled,
    )
  }

  @Get('vip-page-config/page')
  @ApiPageDoc({
    summary: '分页查询会员订阅页配置',
    model: MembershipPageConfigItemDto,
  })
  async getMembershipPageConfigPage(
    @Query() query: QueryMembershipPageConfigDto,
  ) {
    return this.monetizationService.getMembershipPageConfigPage(query)
  }

  @Post('vip-page-config/create')
  @ApiAuditDoc({
    summary: '创建会员订阅页配置',
    model: Boolean,
    audit: { actionType: AuditActionTypeEnum.CREATE },
  })
  async createMembershipPageConfig(
    @Body() body: CreateMembershipPageConfigDto,
  ) {
    return this.monetizationService.createMembershipPageConfig(body)
  }

  @Post('vip-page-config/update')
  @ApiAuditDoc({
    summary: '更新会员订阅页配置',
    model: Boolean,
    audit: { actionType: AuditActionTypeEnum.UPDATE },
  })
  async updateMembershipPageConfig(
    @Body() body: UpdateMembershipPageConfigDto,
  ) {
    return this.monetizationService.updateMembershipPageConfig(body)
  }

  @Post('vip-page-config/update-status')
  @ApiAuditDoc({
    summary: '更新会员订阅页配置启用状态',
    model: Boolean,
    audit: { actionType: AuditActionTypeEnum.UPDATE },
  })
  async updateMembershipPageConfigStatus(@Body() body: UpdateEnabledStatusDto) {
    return this.monetizationService.updateMembershipPageConfigStatus(
      body.id,
      body.isEnabled,
    )
  }

  @Get('vip-auto-renew-agreement/page')
  @ApiPageDoc({
    summary: '分页查询 VIP 自动续费协议',
    model: BaseMembershipAutoRenewAgreementDto,
  })
  async getMembershipAutoRenewAgreementPage(
    @Query() query: QueryMembershipAutoRenewAgreementDto,
  ) {
    return this.monetizationService.getMembershipAutoRenewAgreementPage(query)
  }

  @Post('vip-auto-renew-agreement/cancellation/create')
  @ApiAuditDoc({
    summary: '取消 VIP 自动续费协议',
    model: Boolean,
    audit: { actionType: AuditActionTypeEnum.UPDATE },
  })
  async cancelMembershipAutoRenewAgreement(@Body() body: IdDto) {
    return this.monetizationService.cancelMembershipAutoRenewAgreement(body.id)
  }

  @Get('currency-package/page')
  @ApiPageDoc({
    summary: '分页查询虚拟币充值包',
    model: BaseCurrencyPackageDto,
  })
  async getCurrencyPackagePage(@Query() query: QueryCurrencyPackageDto) {
    return this.monetizationService.getCurrencyPackagePage(query)
  }

  @Post('currency-package/create')
  @ApiAuditDoc({
    summary: '创建虚拟币充值包',
    model: Boolean,
    audit: { actionType: AuditActionTypeEnum.CREATE },
  })
  async createCurrencyPackage(@Body() body: CreateCurrencyPackageDto) {
    return this.monetizationService.createCurrencyPackage(body)
  }

  @Post('currency-package/update')
  @ApiAuditDoc({
    summary: '更新虚拟币充值包',
    model: Boolean,
    audit: { actionType: AuditActionTypeEnum.UPDATE },
  })
  async updateCurrencyPackage(@Body() body: UpdateCurrencyPackageDto) {
    return this.monetizationService.updateCurrencyPackage(body)
  }

  @Post('currency-package/update-status')
  @ApiAuditDoc({
    summary: '更新虚拟币充值包启用状态',
    model: Boolean,
    audit: { actionType: AuditActionTypeEnum.UPDATE },
  })
  async updateCurrencyPackageStatus(@Body() body: UpdateEnabledStatusDto) {
    return this.monetizationService.updateCurrencyPackageStatus(
      body.id,
      body.isEnabled,
    )
  }

  @Get('coupon/page')
  @ApiPageDoc({
    summary: '分页查询券定义',
    model: BaseCouponDefinitionDto,
  })
  async getCouponDefinitionPage(@Query() query: QueryCouponDefinitionDto) {
    return this.monetizationService.getCouponDefinitionPage(query)
  }

  @Post('coupon/create')
  @ApiAuditDoc({
    summary: '创建券定义',
    model: Boolean,
    audit: { actionType: AuditActionTypeEnum.CREATE },
  })
  async createCouponDefinition(@Body() body: CreateCouponDefinitionDto) {
    return this.monetizationService.createCouponDefinition(body)
  }

  @Post('coupon/update')
  @ApiAuditDoc({
    summary: '更新券定义',
    model: Boolean,
    audit: { actionType: AuditActionTypeEnum.UPDATE },
  })
  async updateCouponDefinition(@Body() body: UpdateCouponDefinitionDto) {
    return this.monetizationService.updateCouponDefinition(body)
  }

  @Post('coupon/update-status')
  @ApiAuditDoc({
    summary: '更新券定义启用状态',
    model: Boolean,
    audit: { actionType: AuditActionTypeEnum.UPDATE },
  })
  async updateCouponDefinitionStatus(@Body() body: UpdateEnabledStatusDto) {
    return this.monetizationService.updateCouponDefinitionStatus(
      body.id,
      body.isEnabled,
    )
  }

  @Post('coupon/grant/create')
  @ApiAuditDoc({
    summary: '发放券',
    model: Boolean,
    audit: { actionType: AuditActionTypeEnum.CREATE },
  })
  async grantCoupon(@Body() body: GrantCouponDto) {
    return this.monetizationService.grantCoupon(body)
  }

  @Get('payment-provider/page')
  @ApiPageDoc({
    summary: '分页查询支付 provider 配置',
    model: BasePaymentProviderConfigDto,
  })
  async getPaymentProviderConfigPage(
    @Query() query: QueryPaymentProviderConfigDto,
  ) {
    return this.monetizationService.getPaymentProviderConfigPage(query)
  }

  @Post('payment-provider/create')
  @ApiAuditDoc({
    summary: '创建支付 provider 配置',
    model: Boolean,
    audit: { actionType: AuditActionTypeEnum.CREATE },
  })
  async createPaymentProviderConfig(
    @Body() body: CreatePaymentProviderConfigDto,
  ) {
    return this.monetizationService.createPaymentProviderConfig(body)
  }

  @Post('payment-provider/update')
  @ApiAuditDoc({
    summary: '更新支付 provider 配置',
    model: Boolean,
    audit: { actionType: AuditActionTypeEnum.UPDATE },
  })
  async updatePaymentProviderConfig(
    @Body() body: UpdatePaymentProviderConfigDto,
  ) {
    return this.monetizationService.updatePaymentProviderConfig(body)
  }

  @Post('payment-provider/update-status')
  @ApiAuditDoc({
    summary: '更新支付 provider 启用状态',
    model: Boolean,
    audit: { actionType: AuditActionTypeEnum.UPDATE },
  })
  async updatePaymentProviderStatus(@Body() body: UpdateEnabledStatusDto) {
    return this.monetizationService.updatePaymentProviderStatus(
      body.id,
      body.isEnabled,
    )
  }

  @Get('payment-order/page')
  @ApiPageDoc({
    summary: '分页查询支付订单',
    model: PaymentOrderResultDto,
  })
  async getPaymentOrderPage(@Query() query: QueryPaymentOrderDto) {
    return this.monetizationService.getPaymentOrderPage(query)
  }

  @Post('payment-order/update-status')
  @ApiAuditDoc({
    summary: '确认支付订单状态',
    model: PaymentOrderResultDto,
    audit: { actionType: AuditActionTypeEnum.UPDATE },
  })
  async confirmPaymentOrder(@Body() body: ConfirmPaymentOrderDto) {
    return this.monetizationService.confirmPaymentOrder(body)
  }

  @Get('ad-provider/page')
  @ApiPageDoc({
    summary: '分页查询广告 provider 配置',
    model: BaseAdProviderConfigDto,
  })
  async getAdProviderConfigPage(@Query() query: QueryAdProviderConfigDto) {
    return this.monetizationService.getAdProviderConfigPage(query)
  }

  @Post('ad-provider/create')
  @ApiAuditDoc({
    summary: '创建广告 provider 配置',
    model: Boolean,
    audit: { actionType: AuditActionTypeEnum.CREATE },
  })
  async createAdProviderConfig(@Body() body: CreateAdProviderConfigDto) {
    return this.monetizationService.createAdProviderConfig(body)
  }

  @Post('ad-provider/update')
  @ApiAuditDoc({
    summary: '更新广告 provider 配置',
    model: Boolean,
    audit: { actionType: AuditActionTypeEnum.UPDATE },
  })
  async updateAdProviderConfig(@Body() body: UpdateAdProviderConfigDto) {
    return this.monetizationService.updateAdProviderConfig(body)
  }

  @Post('ad-provider/update-status')
  @ApiAuditDoc({
    summary: '更新广告 provider 启用状态',
    model: Boolean,
    audit: { actionType: AuditActionTypeEnum.UPDATE },
  })
  async updateAdProviderStatus(@Body() body: UpdateEnabledStatusDto) {
    return this.monetizationService.updateAdProviderStatus(
      body.id,
      body.isEnabled,
    )
  }
}
