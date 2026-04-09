import { CheckInService } from '@libs/growth/check-in/check-in.service';
import { CheckInPlanDetailResponseDto, CheckInPlanPageItemDto, CreateCheckInPlanDto, QueryCheckInPlanDto, UpdateCheckInPlanDto, UpdateCheckInPlanStatusDto } from '@libs/growth/check-in/dto/check-in-definition.dto';
import { RepairCheckInRewardDto, RepairCheckInRewardResponseDto } from '@libs/growth/check-in/dto/check-in-execution.dto';
import { CheckInReconciliationItemDto, QueryCheckInReconciliationDto } from '@libs/growth/check-in/dto/check-in-runtime.dto';
import { ApiDoc, ApiPageDoc } from '@libs/platform/decorators/api-doc.decorator';
import { CurrentUser } from '@libs/platform/decorators/current-user.decorator';
import { IdDto } from '@libs/platform/dto/base.dto';
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { AuditActionTypeEnum } from '../../common/audit/audit-action.constant'
import { ApiAuditDoc } from '../../common/decorators/api-audit-doc.decorator'

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
  @ApiAuditDoc({
    summary: '创建签到计划',
    model: IdDto,
    audit: {
      actionType: AuditActionTypeEnum.CREATE,
    },
  })
  async createPlan(
    @Body() body: CreateCheckInPlanDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.checkInService.createPlan(body, userId)
  }

  @Post('plan/update')
  @ApiAuditDoc({
    summary: '更新签到计划',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async updatePlan(
    @Body() body: UpdateCheckInPlanDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.checkInService.updatePlan(body, userId)
  }

  @Post('plan/update-status')
  @ApiAuditDoc({
    summary: '更新签到计划状态',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
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
  @ApiAuditDoc({
    summary: '补偿签到奖励',
    model: RepairCheckInRewardResponseDto,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async repairReward(
    @Body() body: RepairCheckInRewardDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.checkInService.repairReward(body, userId)
  }
}
