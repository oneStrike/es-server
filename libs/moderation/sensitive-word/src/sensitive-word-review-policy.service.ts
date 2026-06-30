import type {
  ContentReviewAction,
  ResolveSensitiveWordReviewDecisionInput,
  SensitiveWordReviewDecision,
} from './sensitive-word.type'
import { AuditStatusEnum } from '@libs/platform/constant'
import { ConfigReader } from '@libs/system-config/config-reader'
import { DEFAULT_CONFIG } from '@libs/system-config/system-config.constant'
import { Injectable, Logger } from '@nestjs/common'
import { SensitiveWordLevelEnum } from './sensitive-word-constant'
import { SensitiveWordDetectService } from './sensitive-word-detect.service'

const TOPIC_REVIEW_POLICY = {
  NONE: 0,
  SEVERE_SENSITIVE_WORD: 1,
  GENERAL_SENSITIVE_WORD: 2,
  MILD_SENSITIVE_WORD: 3,
  MANUAL: 4,
} as const

export const SENSITIVE_WORD_DETECTOR_NOT_READY_FALLBACK_REASON =
  'sensitive_word_detector_not_ready' as const

/**
 * 敏感词业务审核决策服务。
 *
 * 全局 contentReviewPolicy 是敏感词等级到审核动作的唯一来源；
 * topicReviewPolicy 只允许把主题额外推入待审，不能降低全局拒绝/隐藏。
 */
@Injectable()
export class SensitiveWordReviewPolicyService {
  private readonly logger = new Logger(SensitiveWordReviewPolicyService.name)

  constructor(
    private readonly detectService: SensitiveWordDetectService,
    private readonly configReader: ConfigReader,
  ) {}

  resolveContentDecision(content: string) {
    return this.resolveDecision({
      segments: [{ field: 'content', content }],
    })
  }

  resolveTopicDecision(
    title: string,
    content: string,
    topicReviewPolicy: number | null | undefined,
  ) {
    return this.resolveDecision({
      topicReviewPolicy,
      segments: [
        { field: 'title', content: title },
        { field: 'content', content },
      ],
    })
  }

  resolveDecision(input: ResolveSensitiveWordReviewDecisionInput) {
    if (!this.detectService.isReady()) {
      this.logger.warn({
        fallbackReason: SENSITIVE_WORD_DETECTOR_NOT_READY_FALLBACK_REASON,
        message: 'Sensitive word detector is not ready; fail closed.',
        segmentFields: input.segments.map((segment) => segment.field),
      })
      return this.buildDetectorNotReadyDecision()
    }

    const result = this.detectService.getMatchedWordsWithMetadataBySegments(
      input.segments.filter((segment) => segment.content.length > 0),
    )
    const highestLevel = result.highestLevel ?? undefined
    const policy = this.configReader.getContentReviewPolicy()
    const recordHits = policy?.recordHits !== false
    const baseDecision = this.resolveGlobalDecision(highestLevel)
    const auditStatus = this.applyTopicReviewPolicy({
      auditStatus: baseDecision.auditStatus,
      highestLevel,
      topicReviewPolicy: input.topicReviewPolicy,
    })

    return {
      auditStatus,
      detectorReady: true,
      highestLevel,
      isHidden: baseDecision.isHidden,
      publicHits: recordHits ? result.publicHits : [],
      recordHits,
      statisticsHits: recordHits ? result.hits : [],
    } satisfies SensitiveWordReviewDecision
  }

  private buildDetectorNotReadyDecision(): SensitiveWordReviewDecision {
    return {
      auditStatus: AuditStatusEnum.PENDING,
      detectorReady: false,
      fallbackReason: SENSITIVE_WORD_DETECTOR_NOT_READY_FALLBACK_REASON,
      isHidden: true,
      publicHits: [],
      recordHits: false,
      statisticsHits: [],
    }
  }

  private resolveGlobalDecision(highestLevel?: SensitiveWordLevelEnum) {
    if (!highestLevel) {
      return {
        auditStatus: AuditStatusEnum.APPROVED,
        isHidden: false,
      }
    }

    const policy = this.configReader.getContentReviewPolicy()
    if (highestLevel === SensitiveWordLevelEnum.SEVERE) {
      return this.normalizeAction(policy?.severeAction, {
        auditStatus: DEFAULT_CONFIG.contentReviewPolicy.severeAction
          .auditStatus,
        isHidden: DEFAULT_CONFIG.contentReviewPolicy.severeAction.isHidden,
      })
    }
    if (highestLevel === SensitiveWordLevelEnum.GENERAL) {
      return this.normalizeAction(policy?.generalAction, {
        auditStatus: DEFAULT_CONFIG.contentReviewPolicy.generalAction
          .auditStatus,
        isHidden: DEFAULT_CONFIG.contentReviewPolicy.generalAction.isHidden,
      })
    }

    return this.normalizeAction(policy?.lightAction, {
      auditStatus: DEFAULT_CONFIG.contentReviewPolicy.lightAction
        .auditStatus,
      isHidden: DEFAULT_CONFIG.contentReviewPolicy.lightAction.isHidden,
    })
  }

  private normalizeAction(
    action: ContentReviewAction | null | undefined,
    fallback: {
      auditStatus: AuditStatusEnum
      isHidden: boolean
    },
  ) {
    return {
      auditStatus: action?.auditStatus ?? fallback.auditStatus,
      isHidden: action?.isHidden ?? fallback.isHidden,
    }
  }

  private applyTopicReviewPolicy(input: {
    auditStatus: AuditStatusEnum
    highestLevel?: SensitiveWordLevelEnum
    topicReviewPolicy?: number | null
  }) {
    if (
      input.auditStatus !== AuditStatusEnum.APPROVED ||
      !this.shouldTopicRequireAdditionalAudit(
        input.topicReviewPolicy,
        input.highestLevel,
      )
    ) {
      return input.auditStatus
    }

    return AuditStatusEnum.PENDING
  }

  private shouldTopicRequireAdditionalAudit(
    topicReviewPolicy: number | null | undefined,
    highestLevel?: SensitiveWordLevelEnum,
  ) {
    switch (topicReviewPolicy) {
      case undefined:
      case null:
      case TOPIC_REVIEW_POLICY.NONE:
        return false
      case TOPIC_REVIEW_POLICY.MANUAL:
        return true
      case TOPIC_REVIEW_POLICY.SEVERE_SENSITIVE_WORD:
        return highestLevel === SensitiveWordLevelEnum.SEVERE
      case TOPIC_REVIEW_POLICY.GENERAL_SENSITIVE_WORD:
        return (
          highestLevel === SensitiveWordLevelEnum.SEVERE ||
          highestLevel === SensitiveWordLevelEnum.GENERAL
        )
      case TOPIC_REVIEW_POLICY.MILD_SENSITIVE_WORD:
        return highestLevel !== undefined
      default:
        return false
    }
  }
}
