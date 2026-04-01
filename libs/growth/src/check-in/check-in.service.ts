import type {
  CreateCheckInPlanInput,
  MakeupCheckInInput,
  QueryCheckInPlanPageInput,
  QueryCheckInReconciliationPageInput,
  QueryMyCheckInRecordPageInput,
  RepairCheckInRewardInput,
  UpdateCheckInPlanInput,
  UpdateCheckInPlanStatusInput,
} from './check-in.type'
import { Injectable } from '@nestjs/common'
import { CheckInDefinitionService } from './check-in-definition.service'
import { CheckInExecutionService } from './check-in-execution.service'
import { CheckInRuntimeService } from './check-in-runtime.service'

/**
 * 签到域正式门面服务。
 *
 * 统一向 app/admin controller 暴露签到配置、执行与运行态查询入口。
 */
@Injectable()
export class CheckInService {
  constructor(
    private readonly checkInDefinitionService: CheckInDefinitionService,
    private readonly checkInExecutionService: CheckInExecutionService,
    private readonly checkInRuntimeService: CheckInRuntimeService,
  ) {}

  /** 读取管理端签到计划分页。 */
  async getPlanPage(query: QueryCheckInPlanPageInput) {
    return this.checkInDefinitionService.getPlanPage(query)
  }

  /** 读取管理端签到计划详情。 */
  async getPlanDetail(id: number) {
    return this.checkInDefinitionService.getPlanDetail(id)
  }

  /** 创建新的签到计划定义。 */
  async createPlan(dto: CreateCheckInPlanInput, adminUserId: number) {
    return this.checkInDefinitionService.createPlan(dto, adminUserId)
  }

  /** 更新签到计划及其版本化规则。 */
  async updatePlan(dto: UpdateCheckInPlanInput, adminUserId: number) {
    return this.checkInDefinitionService.updatePlan(dto, adminUserId)
  }

  /** 更新签到计划状态。 */
  async updatePlanStatus(
    dto: UpdateCheckInPlanStatusInput,
    adminUserId: number,
  ) {
    return this.checkInDefinitionService.updatePlanStatus(dto, adminUserId)
  }

  /** 读取 App 侧当前签到摘要。 */
  async getSummary(userId: number) {
    return this.checkInRuntimeService.getSummary(userId)
  }

  /** 读取 App 侧当前周期签到日历。 */
  async getCalendar(userId: number) {
    return this.checkInRuntimeService.getCalendar(userId)
  }

  /** 分页读取当前用户的签到记录。 */
  async getMyRecords(query: QueryMyCheckInRecordPageInput, userId: number) {
    return this.checkInRuntimeService.getMyRecords(query, userId)
  }

  /** 执行今日签到。 */
  async signToday(userId: number) {
    return this.checkInExecutionService.signToday(userId)
  }

  /** 执行补签。 */
  async makeup(dto: MakeupCheckInInput, userId: number) {
    return this.checkInExecutionService.makeup(dto, userId)
  }

  /** 读取管理端奖励对账分页。 */
  async getReconciliationPage(query: QueryCheckInReconciliationPageInput) {
    return this.checkInRuntimeService.getReconciliationPage(query)
  }

  /** 触发签到奖励补偿。 */
  async repairReward(dto: RepairCheckInRewardInput, adminUserId: number) {
    return this.checkInExecutionService.repairReward(dto, adminUserId)
  }
}
