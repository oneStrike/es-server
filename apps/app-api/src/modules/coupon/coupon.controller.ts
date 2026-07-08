import { CouponService } from '@libs/interaction/coupon/coupon.service'
import {
  CouponRedemptionResultDto,
  QueryUserCouponDto,
  RedeemCouponBodyDto,
  UserCouponItemDto,
} from '@libs/interaction/coupon/dto/coupon.dto'
import { ApiDoc, ApiPageDoc, CurrentUser } from '@libs/platform/decorators'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('券')
@Controller('app/coupon')
export class CouponController {
  constructor(private readonly couponService: CouponService) {}

  // 分页查询当前用户券包。
  @Get('my/page')
  @ApiPageDoc({
    summary: '分页查询我的券包',
    model: UserCouponItemDto,
  })
  async getMyCouponPage(
    @Query() query: QueryUserCouponDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.couponService.getUserCouponPage(userId, query)
  }

  // 核销当前用户券。
  @Post('redemption/create')
  @ApiDoc({
    summary: '核销券',
    model: CouponRedemptionResultDto,
  })
  async redeemCoupon(
    @Body() body: RedeemCouponBodyDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.couponService.redeemCoupon({
      ...body,
      userId,
    })
  }
}
