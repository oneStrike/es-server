import {
  AdRewardResultDto,
  AdRewardVerificationDto,
  BaseCurrencyPackageDto,
  BaseMembershipPlanDto,
  ConfirmPaymentOrderDto,
  CouponRedemptionResultDto,
  CreateCurrencyRechargeOrderDto,
  CreateVipSubscriptionOrderDto,
  PaymentOrderResultDto,
  QueryUserCouponDto,
  RedeemCouponBodyDto,
  UserCouponItemDto,
  VipSubscriptionPageDto,
  WalletDetailDto,
} from '@libs/interaction/monetization/dto/monetization.dto'
import { MonetizationService } from '@libs/interaction/monetization/monetization.service'
import { ApiDoc, ApiPageDoc, CurrentUser } from '@libs/platform/decorators'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('变现')
@Controller('app/monetization')
export class MonetizationController {
  constructor(private readonly monetizationService: MonetizationService) {}

  @Get('wallet/detail')
  @ApiDoc({
    summary: '获取钱包详情',
    model: WalletDetailDto,
  })
  async getWalletDetail(@CurrentUser('sub') userId: number) {
    return this.monetizationService.getWalletDetail(userId)
  }

  @Get('currency-package/list')
  @ApiDoc({
    summary: '获取虚拟币充值包列表',
    model: BaseCurrencyPackageDto,
    isArray: true,
  })
  async getCurrencyPackageList() {
    return this.monetizationService.getCurrencyPackageList()
  }

  @Post('wallet/recharge/create')
  @ApiDoc({
    summary: '创建虚拟币充值订单',
    model: PaymentOrderResultDto,
  })
  async createCurrencyRechargeOrder(
    @Body() body: CreateCurrencyRechargeOrderDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.monetizationService.createCurrencyRechargeOrder(userId, body)
  }

  @Post('payment-notification/create')
  @ApiDoc({
    summary: '确认支付通知',
    model: PaymentOrderResultDto,
  })
  async confirmPaymentOrder(
    @Body() body: ConfirmPaymentOrderDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.monetizationService.confirmPaymentOrder(body, { userId })
  }

  @Get('vip/plan/list')
  @ApiDoc({
    summary: '获取 VIP 套餐列表',
    model: BaseMembershipPlanDto,
    isArray: true,
  })
  async getMembershipPlanList() {
    return this.monetizationService.getMembershipPlanList()
  }

  @Get('vip/page/detail')
  @ApiDoc({
    summary: '获取 VIP 订阅页详情',
    model: VipSubscriptionPageDto,
  })
  async getVipSubscriptionPage(@CurrentUser('sub') userId: number) {
    return this.monetizationService.getVipSubscriptionPage(userId)
  }

  @Post('vip/order/create')
  @ApiDoc({
    summary: '创建 VIP 订阅订单',
    model: PaymentOrderResultDto,
  })
  async createVipSubscriptionOrder(
    @Body() body: CreateVipSubscriptionOrderDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.monetizationService.createVipSubscriptionOrder(userId, body)
  }

  @Get('coupon/my/page')
  @ApiPageDoc({
    summary: '分页查询我的券包',
    model: UserCouponItemDto,
  })
  async getMyCouponPage(
    @Query() query: QueryUserCouponDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.monetizationService.getUserCouponPage(userId, query)
  }

  @Post('coupon/redemption/create')
  @ApiDoc({
    summary: '核销券',
    model: CouponRedemptionResultDto,
  })
  async redeemCoupon(
    @Body() body: RedeemCouponBodyDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.monetizationService.redeemCoupon({
      ...body,
      userId,
    })
  }

  @Post('ad-reward/verification/create')
  @ApiDoc({
    summary: '创建广告奖励验证',
    model: AdRewardResultDto,
  })
  async verifyAdReward(
    @Body() body: AdRewardVerificationDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.monetizationService.verifyAdReward(userId, body)
  }
}
