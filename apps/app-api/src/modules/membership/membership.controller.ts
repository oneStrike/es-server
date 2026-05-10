import {
  BaseMembershipPlanDto,
  CreateVipSubscriptionOrderDto,
  QueryVipSubscriptionPageDto,
  VipSubscriptionPageDto,
} from '@libs/interaction/membership/dto/membership.dto'
import { MembershipService } from '@libs/interaction/membership/membership.service'
import { PaymentOrderResultDto } from '@libs/interaction/payment/dto/payment.dto'
import { ApiDoc, CurrentUser } from '@libs/platform/decorators'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('会员')
@Controller('app/membership')
export class MembershipController {
  constructor(private readonly membershipService: MembershipService) {}

  // 获取 App 可展示的 VIP 套餐列表。
  @Get('plan/list')
  @ApiDoc({
    summary: '获取 VIP 套餐列表',
    model: BaseMembershipPlanDto,
    isArray: true,
  })
  async getMembershipPlanList() {
    return this.membershipService.getMembershipPlanList()
  }

  // 获取当前用户 VIP 订阅页详情。
  @Get('page/detail')
  @ApiDoc({
    summary: '获取 VIP 订阅页详情',
    model: VipSubscriptionPageDto,
  })
  async getVipSubscriptionPage(
    @Query() query: QueryVipSubscriptionPageDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.membershipService.getVipSubscriptionPage(userId, query)
  }

  // 创建 VIP 订阅订单。
  @Post('order/create')
  @ApiDoc({
    summary: '创建 VIP 订阅订单',
    model: PaymentOrderResultDto,
  })
  async createVipSubscriptionOrder(
    @Body() body: CreateVipSubscriptionOrderDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.membershipService.createVipSubscriptionOrder(userId, body)
  }
}
