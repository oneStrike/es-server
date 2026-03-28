import type { EventEnvelope } from '@libs/growth/event-definition'
import {
  canConsumeEventEnvelopeByConsumer,
  EventDefinitionConsumerEnum,
} from '@libs/growth/event-definition'
import { GrowthRuleTypeEnum } from '@libs/growth/growth'
import { UserGrowthRewardService } from '@libs/growth/growth-reward'
import { Injectable, Logger } from '@nestjs/common'
import { ReportStatusEnum, ReportTargetTypeEnum } from './report.constant'

@Injectable()
export class ReportGrowthService {
  private readonly logger = new Logger(ReportGrowthService.name)

  constructor(
    private readonly userGrowthRewardService: UserGrowthRewardService,
  ) {}

  /**
   * 按举报裁决结果发放奖励。
   * 统一使用裁决状态作为正式奖励口径，复用成长域既有 bizKey 幂等保护。
   */
  async rewardReportHandled(params: {
    eventEnvelope: EventEnvelope<GrowthRuleTypeEnum>
  }): Promise<void> {
    try {
      const { eventEnvelope } = params
      if (
        !canConsumeEventEnvelopeByConsumer(
          eventEnvelope,
          EventDefinitionConsumerEnum.GROWTH,
        )
      ) {
        return
      }

      const context = this.parseHandledReportContext(eventEnvelope.context)

      await this.userGrowthRewardService.tryRewardByRule({
        userId: eventEnvelope.subjectId,
        ruleType: eventEnvelope.code,
        bizKey: `report:handle:${eventEnvelope.targetId}:status:${context.reportStatus}`,
        source: 'report_handle',
        remark:
          eventEnvelope.code === GrowthRuleTypeEnum.REPORT_VALID
            ? `举报裁决有效 #${eventEnvelope.targetId}`
            : `举报裁决无效 #${eventEnvelope.targetId}`,
        targetType: context.reportedTargetType,
        targetId: context.reportedTargetId,
      })
    } catch (error) {
      this.logger.warn(
        `reward_report_handled_failed eventCode=${params.eventEnvelope.code} reportId=${params.eventEnvelope.targetId} error=${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
  }

  private parseHandledReportContext(context: unknown) {
    const record =
      context && typeof context === 'object' && !Array.isArray(context)
        ? (context as Record<string, unknown>)
        : {}

    const reportStatus = Number(record.reportStatus)
    const reportedTargetType = Number(record.reportedTargetType)
    const reportedTargetId = Number(record.reportedTargetId)

    if (
      !Object.values(ReportStatusEnum).includes(reportStatus)
      || !Object.values(ReportTargetTypeEnum).includes(reportedTargetType)
      || !Number.isInteger(reportedTargetId)
      || reportedTargetId <= 0
    ) {
      throw new Error('举报裁决事件上下文缺失或非法')
    }

    return {
      reportStatus: reportStatus as ReportStatusEnum,
      reportedTargetType: reportedTargetType as ReportTargetTypeEnum,
      reportedTargetId,
    }
  }
}
