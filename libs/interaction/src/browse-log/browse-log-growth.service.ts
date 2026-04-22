import { createDefinedEventEnvelope } from '@libs/growth/event-definition/event-envelope.type';
import { GrowthEventBridgeService } from '@libs/growth/growth-reward/growth-event-bridge.service';
import { GrowthRuleTypeEnum } from '@libs/growth/growth-rule.constant';
import { Injectable, Logger } from '@nestjs/common'
import { BrowseLogTargetTypeEnum } from './browse-log.constant'

/**
 * 浏览日志成长服务
 * 处理浏览记录相关的积分和经验奖励
 */
@Injectable()
export class BrowseLogGrowthService {
  private readonly logger = new Logger(BrowseLogGrowthService.name)
  private readonly browseGrowthRuleMap: Partial<
    Record<BrowseLogTargetTypeEnum, GrowthRuleTypeEnum>
  > = {
    [BrowseLogTargetTypeEnum.COMIC]: GrowthRuleTypeEnum.COMIC_WORK_VIEW,
    [BrowseLogTargetTypeEnum.NOVEL]: GrowthRuleTypeEnum.NOVEL_WORK_VIEW,
    [BrowseLogTargetTypeEnum.FORUM_TOPIC]: GrowthRuleTypeEnum.TOPIC_VIEW,
  }

  constructor(
    /** 成长奖励服务 */
    private readonly growthEventBridgeService: GrowthEventBridgeService,
  ) {}

  /**
   * 奖励浏览记录
   * 根据目标类型发放对应的积分和经验奖励
   *
   * @param targetType - 浏览目标类型
   * @param targetId - 目标ID
   * @param userId - 用户ID
   */
  async rewardBrowseLogRecorded(
    targetType: BrowseLogTargetTypeEnum,
    targetId: number,
    userId: number,
  ): Promise<void> {
    const ruleType = this.browseGrowthRuleMap[targetType] ?? null
    if (!ruleType) {
      return
    }

    const baseBizKey = `view:${targetType}:${targetId}:user:${userId}`
    const browseRecordedEvent = createDefinedEventEnvelope({
      code: ruleType,
      subjectId: userId,
      targetId,
      context: {
        browseTargetType: targetType,
      },
    })

    try {
      await this.growthEventBridgeService.dispatchDefinedEvent({
        eventEnvelope: browseRecordedEvent,
        bizKey: baseBizKey,
        source: 'browse_log',
        targetType,
      })
    } catch (error) {
      this.logger.warn(
        `reward_browse_log_failed userId=${userId} targetType=${targetType} targetId=${targetId} ruleType=${ruleType} error=${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
  }
}
