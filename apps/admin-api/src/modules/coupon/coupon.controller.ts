import { CouponAdminGrantWorkflowService } from '@libs/interaction/coupon/coupon-admin-grant-workflow.service'
import { CouponService } from '@libs/interaction/coupon/coupon.service'
import {
  BaseCouponDefinitionDto,
  CreateCouponDefinitionDto,
  CreateCouponGrantWorkflowDto,
  QueryCouponDefinitionDto,
  UpdateCouponDefinitionDto,
} from '@libs/interaction/coupon/dto/coupon.dto'
import { ApiPageDoc, CurrentUser } from '@libs/platform/decorators'
import { UpdateEnabledStatusDto } from '@libs/platform/dto'
import { AuditActionTypeEnum } from '@libs/platform/modules/audit/audit-action.constant'
import { WorkflowJobDto } from '@libs/platform/modules/workflow/dto'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { ApiAuditDoc } from '../../common/decorators/api-audit-doc.decorator'

@ApiTags('券管理')
@Controller('admin/coupon')
export class CouponController {
  constructor(
    private readonly couponService: CouponService,
    private readonly couponGrantWorkflowService: CouponAdminGrantWorkflowService,
  ) {}

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

  // 创建批量发券工作流。
  @Post('grant-workflow/create')
  @ApiAuditDoc({
    summary: '创建批量发券任务',
    model: WorkflowJobDto,
    audit: { actionType: AuditActionTypeEnum.CREATE },
  })
  async createGrantWorkflow(
    @Body() body: CreateCouponGrantWorkflowDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.couponGrantWorkflowService.createWorkflow(body, userId)
  }
}
