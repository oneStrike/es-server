import {
  CheckInPlanDetailResponseDto,
  CheckInPlanPageItemDto,
  CheckInReconciliationItemDto,
  CheckInService,
  CreateCheckInPlanDto,
  QueryCheckInPlanDto,
  QueryCheckInReconciliationDto,
  RepairCheckInRewardDto,
  RepairCheckInRewardResponseDto,
  UpdateCheckInPlanDto,
  UpdateCheckInPlanStatusDto,
} from '@libs/growth/check-in'
import { ApiDoc, ApiPageDoc, CurrentUser } from '@libs/platform/decorators'
import { IdDto } from '@libs/platform/dto'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { Audit } from '../../common/decorators/audit.decorator'
import { AuditActionTypeEnum } from '../system/audit/audit.constant'

@ApiTags('签到管理/签到计划')
@Controller('admin/check-in')
export class CheckInController {
  constructor(private readonly checkInService: CheckInService) {}

  @Get('plan/page')
  @ApiPageDoc({
    summary: '分页查询签到计划',
    model: CheckInPlanPageItemDto,
  })
  async getPlanPage(@Query() query: QueryCheckInPlanDto) {
    return this.checkInService.getPlanPage(query)
  }

  @Get('plan/detail')
  @ApiDoc({
    summary: '查询签到计划详情',
    model: CheckInPlanDetailResponseDto,
  })
  async getPlanDetail(@Query() query: IdDto) {
    return this.checkInService.getPlanDetail(query)
  }

  @Post('plan/create')
  @ApiDoc({
    summary: '创建签到计划',
    model: Boolean,
  })
  @Audit({
    actionType: AuditActionTypeEnum.CREATE,
    content: '创建签到计划',
  })
  async createPlan(
    @Body() body: CreateCheckInPlanDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.checkInService.createPlan(body, userId)
  }

  @Post('plan/update')
  @ApiDoc({
    summary: '更新签到计划',
    model: Boolean,
  })
  @Audit({
    actionType: AuditActionTypeEnum.UPDATE,
    content: '更新签到计划',
  })
  async updatePlan(
    @Body() body: UpdateCheckInPlanDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.checkInService.updatePlan(body, userId)
  }

  @Post('plan/update-status')
  @ApiDoc({
    summary: '更新签到计划状态',
    model: Boolean,
  })
  @Audit({
    actionType: AuditActionTypeEnum.UPDATE,
    content: '更新签到计划状态',
  })
  async updatePlanStatus(
    @Body() body: UpdateCheckInPlanStatusDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.checkInService.updatePlanStatus(body, userId)
  }

  @Get('reconciliation/page')
  @ApiPageDoc({
    summary: '分页查询签到对账结果',
    model: CheckInReconciliationItemDto,
  })
  async getReconciliationPage(@Query() query: QueryCheckInReconciliationDto) {
    return this.checkInService.getReconciliationPage(query)
  }

  @Post('reconciliation/repair')
  @ApiDoc({
    summary: '补偿签到奖励',
    model: RepairCheckInRewardResponseDto,
  })
  @Audit({
    actionType: AuditActionTypeEnum.UPDATE,
    content: '补偿签到奖励',
  })
  async repairReward(
    @Body() body: RepairCheckInRewardDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.checkInService.repairReward(body, userId)
  }
}
