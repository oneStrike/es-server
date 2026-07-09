import {
  CreateMembershipBenefitDefinitionDto,
  CreateMembershipPageConfigDto,
  CreateMembershipPlanDto,
  MembershipBenefitDefinitionOutputDto,
  MembershipPageConfigItemDto,
  MembershipPlanItemDto,
  QueryMembershipBenefitDefinitionDto,
  QueryMembershipPageConfigDto,
  QueryMembershipPlanDto,
  UpdateMembershipBenefitDefinitionDto,
  UpdateMembershipPageConfigDto,
  UpdateMembershipPlanDto,
} from '@libs/interaction/membership/dto/membership.dto'
import { MembershipService } from '@libs/interaction/membership/membership.service'
import { ApiPageDoc } from '@libs/platform/decorators'
import { UpdateEnabledStatusDto } from '@libs/platform/dto'
import { AuditActionTypeEnum } from '@libs/platform/modules/audit/audit-action.constant'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { AdminPermission } from '../../common/decorators/admin-permission.decorator'
import { ApiAuditDoc } from '../../common/decorators/api-audit-doc.decorator'

@ApiTags('会员管理')
@Controller('admin/membership')
export class MembershipController {
  constructor(private readonly membershipService: MembershipService) {}

  // 分页查询 VIP 套餐。
  @Get('plan/page')
  @AdminPermission({
    code: 'membership:plan:page',
    name: '分页查询 VIP 套餐',
    groupCode: 'membership',
  })
  @ApiPageDoc({
    summary: '分页查询 VIP 套餐',
    model: MembershipPlanItemDto,
  })
  async getMembershipPlanPage(@Query() query: QueryMembershipPlanDto) {
    return this.membershipService.getMembershipPlanPage(query)
  }

  // 创建 VIP 套餐。
  @Post('plan/create')
  @AdminPermission({
    code: 'membership:plan:create',
    name: '创建 VIP 套餐',
    groupCode: 'membership',
  })
  @ApiAuditDoc({
    summary: '创建 VIP 套餐',
    model: Boolean,
    audit: { actionType: AuditActionTypeEnum.CREATE },
  })
  async createMembershipPlan(@Body() body: CreateMembershipPlanDto) {
    return this.membershipService.createMembershipPlan(body)
  }

  // 更新 VIP 套餐。
  @Post('plan/update')
  @AdminPermission({
    code: 'membership:plan:update',
    name: '更新 VIP 套餐',
    groupCode: 'membership',
  })
  @ApiAuditDoc({
    summary: '更新 VIP 套餐',
    model: Boolean,
    audit: { actionType: AuditActionTypeEnum.UPDATE },
  })
  async updateMembershipPlan(@Body() body: UpdateMembershipPlanDto) {
    return this.membershipService.updateMembershipPlan(body)
  }

  // 更新 VIP 套餐启用状态。
  @Post('plan/update-status')
  @AdminPermission({
    code: 'membership:plan:update:status',
    name: '更新 VIP 套餐启用状态',
    groupCode: 'membership',
  })
  @ApiAuditDoc({
    summary: '更新 VIP 套餐启用状态',
    model: Boolean,
    audit: { actionType: AuditActionTypeEnum.UPDATE },
  })
  async updateMembershipPlanStatus(@Body() body: UpdateEnabledStatusDto) {
    return this.membershipService.updateMembershipPlanStatus(
      body.id,
      body.isEnabled,
    )
  }

  // 分页查询会员权益定义。
  @Get('benefit/page')
  @AdminPermission({
    code: 'membership:benefit:page',
    name: '分页查询会员权益定义',
    groupCode: 'membership',
  })
  @ApiPageDoc({
    summary: '分页查询会员权益定义',
    model: MembershipBenefitDefinitionOutputDto,
  })
  async getMembershipBenefitDefinitionPage(
    @Query() query: QueryMembershipBenefitDefinitionDto,
  ) {
    return this.membershipService.getMembershipBenefitDefinitionPage(query)
  }

  // 创建会员权益定义。
  @Post('benefit/create')
  @AdminPermission({
    code: 'membership:benefit:create',
    name: '创建会员权益定义',
    groupCode: 'membership',
  })
  @ApiAuditDoc({
    summary: '创建会员权益定义',
    model: Boolean,
    audit: { actionType: AuditActionTypeEnum.CREATE },
  })
  async createMembershipBenefitDefinition(
    @Body() body: CreateMembershipBenefitDefinitionDto,
  ) {
    return this.membershipService.createMembershipBenefitDefinition(body)
  }

  // 更新会员权益定义。
  @Post('benefit/update')
  @AdminPermission({
    code: 'membership:benefit:update',
    name: '更新会员权益定义',
    groupCode: 'membership',
  })
  @ApiAuditDoc({
    summary: '更新会员权益定义',
    model: Boolean,
    audit: { actionType: AuditActionTypeEnum.UPDATE },
  })
  async updateMembershipBenefitDefinition(
    @Body() body: UpdateMembershipBenefitDefinitionDto,
  ) {
    return this.membershipService.updateMembershipBenefitDefinition(body)
  }

  // 更新会员权益启用状态。
  @Post('benefit/update-status')
  @AdminPermission({
    code: 'membership:benefit:update:status',
    name: '更新会员权益启用状态',
    groupCode: 'membership',
  })
  @ApiAuditDoc({
    summary: '更新会员权益启用状态',
    model: Boolean,
    audit: { actionType: AuditActionTypeEnum.UPDATE },
  })
  async updateMembershipBenefitDefinitionStatus(
    @Body() body: UpdateEnabledStatusDto,
  ) {
    return this.membershipService.updateMembershipBenefitDefinitionStatus(
      body.id,
      body.isEnabled,
    )
  }

  // 分页查询会员订阅页配置。
  @Get('page-config/page')
  @AdminPermission({
    code: 'membership:page:config:page',
    name: '分页查询会员订阅页配置',
    groupCode: 'membership',
  })
  @ApiPageDoc({
    summary: '分页查询会员订阅页配置',
    model: MembershipPageConfigItemDto,
  })
  async getMembershipPageConfigPage(
    @Query() query: QueryMembershipPageConfigDto,
  ) {
    return this.membershipService.getMembershipPageConfigPage(query)
  }

  // 创建会员订阅页配置。
  @Post('page-config/create')
  @AdminPermission({
    code: 'membership:page:config:create',
    name: '创建会员订阅页配置',
    groupCode: 'membership',
  })
  @ApiAuditDoc({
    summary: '创建会员订阅页配置',
    model: Boolean,
    audit: { actionType: AuditActionTypeEnum.CREATE },
  })
  async createMembershipPageConfig(
    @Body() body: CreateMembershipPageConfigDto,
  ) {
    return this.membershipService.createMembershipPageConfig(body)
  }

  // 更新会员订阅页配置。
  @Post('page-config/update')
  @AdminPermission({
    code: 'membership:page:config:update',
    name: '更新会员订阅页配置',
    groupCode: 'membership',
  })
  @ApiAuditDoc({
    summary: '更新会员订阅页配置',
    model: Boolean,
    audit: { actionType: AuditActionTypeEnum.UPDATE },
  })
  async updateMembershipPageConfig(
    @Body() body: UpdateMembershipPageConfigDto,
  ) {
    return this.membershipService.updateMembershipPageConfig(body)
  }

  // 更新会员订阅页配置启用状态。
  @Post('page-config/update-status')
  @AdminPermission({
    code: 'membership:page:config:update:status',
    name: '更新会员订阅页配置启用状态',
    groupCode: 'membership',
  })
  @ApiAuditDoc({
    summary: '更新会员订阅页配置启用状态',
    model: Boolean,
    audit: { actionType: AuditActionTypeEnum.UPDATE },
  })
  async updateMembershipPageConfigStatus(@Body() body: UpdateEnabledStatusDto) {
    return this.membershipService.updateMembershipPageConfigStatus(
      body.id,
      body.isEnabled,
    )
  }
}
