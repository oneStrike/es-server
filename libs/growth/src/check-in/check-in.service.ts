import type { PageDto } from '@libs/platform/dto'
import type { CheckInRuleIdQuery } from './check-in.type'
import type {
  QueryAdminCheckInSignedUserPageDto,
  QueryAdminUserCheckInCalendarDetailDto,
  QueryCheckInCalendarDetailDto,
} from './dto/check-in-calendar-query.dto'
import type {
  PublishCheckInStreakRuleDto,
  QueryCheckInStreakRuleHistoryPageDto,
  QueryCheckInStreakRulePageDto,
  UpdateCheckInConfigDto,
  UpdateCheckInEnabledDto,
} from './dto/check-in-definition.dto'
import type {
  MakeupCheckInDto,
  RepairCheckInRewardDto,
} from './dto/check-in-execution.dto'
import type {
  QueryCheckInLeaderboardDto,
  QueryCheckInReconciliationDto,
} from './dto/check-in-runtime.dto'
import { Injectable } from '@nestjs/common'
import { CheckInCalendarReadModelService } from './check-in-calendar-read-model.service'
import { CheckInDefinitionService } from './check-in-definition.service'
import { CheckInExecutionService } from './check-in-execution.service'
import { CheckInRuntimeService } from './check-in-runtime.service'

/**
 * 签到域对外门面服务。
 *
 * 统一向 app/admin controller 暴露签到模块公开用例。
 */
@Injectable()
export class CheckInService {
  // 注入签到定义、执行和读模型三个子服务，统一对外暴露门面。
  constructor(
    private readonly checkInDefinitionService: CheckInDefinitionService,
    private readonly checkInExecutionService: CheckInExecutionService,
    private readonly checkInRuntimeService: CheckInRuntimeService,
    private readonly checkInCalendarReadModelService: CheckInCalendarReadModelService,
  ) {}

  // 查询当前全局签到配置详情。
  async getConfigDetail() {
    return this.checkInDefinitionService.getConfigDetail()
  }

  // 更新全局签到配置。
  async updateConfig(dto: UpdateCheckInConfigDto, adminUserId: number) {
    return this.checkInDefinitionService.updateConfig(dto, adminUserId)
  }

  // 仅更新签到功能开关状态。
  async updateEnabled(dto: UpdateCheckInEnabledDto, adminUserId: number) {
    return this.checkInDefinitionService.updateEnabled(dto, adminUserId)
  }

  // 分页查询连续签到规则代表版本。
  async getStreakRulePage(query: QueryCheckInStreakRulePageDto) {
    return this.checkInDefinitionService.getStreakRulePage(query)
  }

  // 查询单条连续签到规则详情。
  async getStreakRuleDetail(query: CheckInRuleIdQuery) {
    return this.checkInDefinitionService.getStreakRuleDetail(query)
  }

  // 分页查询某个连续签到规则的历史版本。
  async getStreakRuleHistoryPage(query: QueryCheckInStreakRuleHistoryPageDto) {
    return this.checkInDefinitionService.getStreakRuleHistoryPage(query)
  }

  // 查询某个连续签到规则的历史详情。
  async getStreakRuleHistoryDetail(query: CheckInRuleIdQuery) {
    return this.checkInDefinitionService.getStreakRuleHistoryDetail(query)
  }

  // 发布新的连续签到规则版本。
  async publishStreakRule(
    dto: PublishCheckInStreakRuleDto,
    adminUserId: number,
  ) {
    return this.checkInDefinitionService.publishStreakRule(dto, adminUserId)
  }

  // 终止当前仍可终止的连续签到规则版本。
  async terminateStreakRule(query: CheckInRuleIdQuery, adminUserId: number) {
    return this.checkInDefinitionService.terminateStreakRule(query, adminUserId)
  }

  // 查询 app 侧签到摘要。
  async getSummary(userId: number) {
    return this.checkInRuntimeService.getSummary(userId)
  }

  // 查询 app 侧连续签到详情。
  async getStreakDetail(userId: number) {
    return this.checkInRuntimeService.getStreakDetail(userId)
  }

  // 查询 app 侧当前周期签到日历。
  async getCalendar(userId: number) {
    return this.checkInRuntimeService.getCalendar(userId)
  }

  // 查询 app 侧目标日期所属周期的签到日历。
  async getCalendarDetail(query: QueryCheckInCalendarDetailDto, userId: number) {
    return this.checkInCalendarReadModelService.getCurrentUserCalendarByTargetDate(
      userId,
      query.targetDate,
    )
  }

  // 分页查询当前用户的签到记录。
  async getMyRecords(query: PageDto, userId: number) {
    return this.checkInRuntimeService.getMyRecords(query, userId)
  }

  // 分页查询当前连续签到排行榜。
  async getLeaderboardPage(query: QueryCheckInLeaderboardDto) {
    return this.checkInRuntimeService.getLeaderboardPage(query)
  }

  // 执行今日签到。
  async signToday(userId: number) {
    return this.checkInExecutionService.signToday(userId)
  }

  // 执行补签。
  async makeup(dto: MakeupCheckInDto, userId: number) {
    return this.checkInExecutionService.makeup(dto, userId)
  }

  // 查询 admin 侧签到奖励对账结果。
  async getReconciliationPage(query: QueryCheckInReconciliationDto) {
    return this.checkInRuntimeService.getReconciliationPage(query)
  }

  // 查询 admin 侧目标日期所属周期的全局签到日历。
  async getAdminCalendarDetail(query: QueryCheckInCalendarDetailDto) {
    return this.checkInCalendarReadModelService.getAdminCalendarByTargetDate(
      query.targetDate,
    )
  }

  // 查询 admin 侧指定用户目标日期所属周期的签到日历。
  async getAdminUserCalendarDetail(query: QueryAdminUserCheckInCalendarDetailDto) {
    return this.checkInCalendarReadModelService.getSpecifiedUserCalendarByTargetDate(
      query.userId,
      query.targetDate,
    )
  }

  // 分页查询 admin 侧某日已签用户列表。
  async getAdminSignedUserPage(query: QueryAdminCheckInSignedUserPageDto) {
    return this.checkInCalendarReadModelService.getAdminSignedUserPageByTargetDate(
      query,
    )
  }

  // 触发签到奖励补偿重试。
  async repairReward(dto: RepairCheckInRewardDto, adminUserId: number) {
    return this.checkInExecutionService.repairReward(dto, adminUserId)
  }
}
