import { CouponAdminGrantWorkflowService } from '@libs/interaction/coupon/coupon-admin-grant-workflow.service'
import { CouponService } from '@libs/interaction/coupon/coupon.service'
import {
  CouponDefinitionOutputDto,
  CreateCouponDefinitionDto,
  CreateCouponGrantWorkflowDto,
  QueryCouponDefinitionDto,
  UpdateCouponDefinitionDto,
} from '@libs/interaction/coupon/dto/coupon.dto'
import { AuditActionTypeEnum } from '@libs/observability/audit/audit-action.constant'
import { ApiPageDoc, CurrentUser } from '@libs/platform/decorators'
import { UpdateEnabledStatusDto } from '@libs/platform/dto'
import { WorkflowJobDto } from '@libs/workflow/workflow/dto/workflow.dto'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { AdminPermission } from '../../common/decorators/admin-permission.decorator'
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
  @AdminPermission({
    code: 'coupon:definition:page',
    name: '分页查询券定义',
    groupCode: 'coupon',
  })
  @ApiPageDoc({
    summary: '分页查询券定义',
    model: CouponDefinitionOutputDto,
  })
  async getCouponDefinitionPage(@Query() query: QueryCouponDefinitionDto) {
    return this.couponService.getCouponDefinitionPage(query)
  }

  // 创建券定义。
  @Post('definition/create')
  @AdminPermission({
    code: 'coupon:definition:create',
    name: '创建券定义',
    groupCode: 'coupon',
  })
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
  @AdminPermission({
    code: 'coupon:definition:update',
    name: '更新券定义',
    groupCode: 'coupon',
  })
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
  @AdminPermission({
    code: 'coupon:definition:update:status',
    name: '更新券定义启用状态',
    groupCode: 'coupon',
  })
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
  @AdminPermission({
    code: 'coupon:grant:workflow:create',
    name: '创建批量发券任务',
    groupCode: 'coupon',
  })
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
