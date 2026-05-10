import {
  BaseMembershipAutoRenewAgreementDto,
  BaseMembershipBenefitDefinitionDto,
  CreateMembershipBenefitDefinitionDto,
  CreateMembershipPageConfigDto,
  CreateMembershipPlanDto,
  MembershipPageConfigItemDto,
  MembershipPlanItemDto,
  QueryMembershipAutoRenewAgreementDto,
  QueryMembershipBenefitDefinitionDto,
  QueryMembershipPageConfigDto,
  QueryMembershipPlanDto,
  UpdateMembershipBenefitDefinitionDto,
  UpdateMembershipPageConfigDto,
  UpdateMembershipPlanDto,
} from '@libs/interaction/membership/dto/membership.dto'
import { MembershipService } from '@libs/interaction/membership/membership.service'
import { ApiPageDoc } from '@libs/platform/decorators'
import { IdDto, UpdateEnabledStatusDto } from '@libs/platform/dto'
import { AuditActionTypeEnum } from '@libs/platform/modules/audit/audit-action.constant'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { ApiAuditDoc } from '../../common/decorators/api-audit-doc.decorator'

@ApiTags('会员管理')
@Controller('admin/membership')
export class MembershipController {
  constructor(private readonly membershipService: MembershipService) {}

  // 分页查询 VIP 套餐。
  @Get('plan/page')
  @ApiPageDoc({
    summary: '分页查询 VIP 套餐',
    model: MembershipPlanItemDto,
  })
  async getMembershipPlanPage(@Query() query: QueryMembershipPlanDto) {
    return this.membershipService.getMembershipPlanPage(query)
  }

  // 创建 VIP 套餐。
  @Post('plan/create')
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
  @ApiPageDoc({
    summary: '分页查询会员权益定义',
    model: BaseMembershipBenefitDefinitionDto,
  })
  async getMembershipBenefitDefinitionPage(
    @Query() query: QueryMembershipBenefitDefinitionDto,
  ) {
    return this.membershipService.getMembershipBenefitDefinitionPage(query)
  }

  // 创建会员权益定义。
  @Post('benefit/create')
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

  // 分页查询 VIP 自动续费协议。
  @Get('auto-renew-agreement/page')
  @ApiPageDoc({
    summary: '分页查询 VIP 自动续费协议',
    model: BaseMembershipAutoRenewAgreementDto,
  })
  async getMembershipAutoRenewAgreementPage(
    @Query() query: QueryMembershipAutoRenewAgreementDto,
  ) {
    return this.membershipService.getMembershipAutoRenewAgreementPage(query)
  }

  // 取消 VIP 自动续费协议。
  @Post('auto-renew-agreement/cancellation/create')
  @ApiAuditDoc({
    summary: '取消 VIP 自动续费协议',
    model: Boolean,
    audit: { actionType: AuditActionTypeEnum.UPDATE },
  })
  async cancelMembershipAutoRenewAgreement(@Body() body: IdDto) {
    return this.membershipService.cancelMembershipAutoRenewAgreement(body.id)
  }
}
