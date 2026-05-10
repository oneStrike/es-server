import { CouponService } from '@libs/interaction/coupon/coupon.service'
import {
  BaseCouponDefinitionDto,
  CreateCouponDefinitionDto,
  GrantCouponDto,
  QueryCouponDefinitionDto,
  UpdateCouponDefinitionDto,
} from '@libs/interaction/coupon/dto/coupon.dto'
import { ApiPageDoc } from '@libs/platform/decorators'
import { UpdateEnabledStatusDto } from '@libs/platform/dto'
import { AuditActionTypeEnum } from '@libs/platform/modules/audit/audit-action.constant'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { ApiAuditDoc } from '../../common/decorators/api-audit-doc.decorator'

@ApiTags('券管理')
@Controller('admin/coupon')
export class CouponController {
  constructor(private readonly couponService: CouponService) {}

  // 分页查询券定义。
  @Get('definition/page')
  @ApiPageDoc({
    summary: '分页查询券定义',
    model: BaseCouponDefinitionDto,
  })
  async getCouponDefinitionPage(@Query() query: QueryCouponDefinitionDto) {
    return this.couponService.getCouponDefinitionPage(query)
  }

  // 创建券定义。
  @Post('definition/create')
  @ApiAuditDoc({
    summary: '创建券定义',
    model: Boolean,
    audit: { actionType: AuditActionTypeEnum.CREATE },
  })
  async createCouponDefinition(@Body() body: CreateCouponDefinitionDto) {
    return this.couponService.createCouponDefinition(body)
  }

  // 更新券定义。
  @Post('definition/update')
  @ApiAuditDoc({
    summary: '更新券定义',
    model: Boolean,
    audit: { actionType: AuditActionTypeEnum.UPDATE },
  })
  async updateCouponDefinition(@Body() body: UpdateCouponDefinitionDto) {
    return this.couponService.updateCouponDefinition(body)
  }

  // 更新券定义启用状态。
  @Post('definition/update-status')
  @ApiAuditDoc({
    summary: '更新券定义启用状态',
    model: Boolean,
    audit: { actionType: AuditActionTypeEnum.UPDATE },
  })
  async updateCouponDefinitionStatus(@Body() body: UpdateEnabledStatusDto) {
    return this.couponService.updateCouponDefinitionStatus(
      body.id,
      body.isEnabled,
    )
  }

  // 发放用户券实例。
  @Post('grant/create')
  @ApiAuditDoc({
    summary: '发放券',
    model: Boolean,
    audit: { actionType: AuditActionTypeEnum.CREATE },
  })
  async grantCoupon(@Body() body: GrantCouponDto) {
    return this.couponService.grantCoupon(body)
  }
}
