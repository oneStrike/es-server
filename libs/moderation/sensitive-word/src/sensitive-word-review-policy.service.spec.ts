import { AuditStatusEnum } from '@libs/platform/constant'
import {
  SensitiveWordLevelEnum,
  SensitiveWordTypeEnum,
} from './sensitive-word-constant'
import {
  SENSITIVE_WORD_DETECTOR_NOT_READY_FALLBACK_REASON,
  SensitiveWordReviewPolicyService,
} from './sensitive-word-review-policy.service'

function createService(options?: {
  detectorReady?: boolean
  recordHits?: boolean
  highestLevel?: SensitiveWordLevelEnum
  topicReviewPolicy?: number
}) {
  const hit = {
    sensitiveWordId: 1,
    word: 'bad',
    start: 0,
    end: 2,
    level: options?.highestLevel ?? SensitiveWordLevelEnum.SEVERE,
    type: SensitiveWordTypeEnum.OTHER,
    replaceWord: null,
    matchMode: 1,
    field: 'content' as const,
  }
  const detectService = {
    isReady: jest.fn(() => options?.detectorReady ?? true),
    getMatchedWordsWithMetadataBySegments: jest.fn(() => ({
      highestLevel: options?.highestLevel,
      hits: options?.highestLevel ? [hit] : [],
      publicHits: options?.highestLevel ? [hit] : [],
    })),
  }
  const configReader = {
    getContentReviewPolicy: jest.fn(() => ({
      severeAction: {
        auditStatus: AuditStatusEnum.REJECTED,
        isHidden: true,
      },
      generalAction: {
        auditStatus: AuditStatusEnum.PENDING,
        isHidden: false,
      },
      lightAction: {
        auditStatus: AuditStatusEnum.APPROVED,
        isHidden: false,
      },
      recordHits: options?.recordHits ?? true,
    })),
  }

  return {
    configReader,
    detectService,
    service: new SensitiveWordReviewPolicyService(
      detectService as never,
      configReader as never,
    ),
  }
}

describe('SensitiveWordReviewPolicyService', () => {
  it('fails closed when detector is not ready', () => {
    const { detectService, service } = createService({ detectorReady: false })

    const decision = service.resolveContentDecision('content')

    expect(decision).toEqual({
      auditStatus: AuditStatusEnum.PENDING,
      detectorReady: false,
      fallbackReason: SENSITIVE_WORD_DETECTOR_NOT_READY_FALLBACK_REASON,
      isHidden: true,
      publicHits: [],
      recordHits: false,
      statisticsHits: [],
    })
    expect(
      detectService.getMatchedWordsWithMetadataBySegments,
    ).not.toHaveBeenCalled()
  })

  it('uses global content review policy as the base decision', () => {
    const { service } = createService({
      highestLevel: SensitiveWordLevelEnum.SEVERE,
    })

    const decision = service.resolveContentDecision('bad')

    expect(decision.auditStatus).toBe(AuditStatusEnum.REJECTED)
    expect(decision.isHidden).toBe(true)
    expect(decision.recordHits).toBe(true)
    expect(decision.publicHits).toHaveLength(1)
    expect(decision.statisticsHits).toHaveLength(1)
  })

  it('disables public and statistics hits when recordHits is false', () => {
    const { service } = createService({
      highestLevel: SensitiveWordLevelEnum.GENERAL,
      recordHits: false,
    })

    const decision = service.resolveContentDecision('bad')

    expect(decision.auditStatus).toBe(AuditStatusEnum.PENDING)
    expect(decision.publicHits).toEqual([])
    expect(decision.statisticsHits).toEqual([])
    expect(decision.recordHits).toBe(false)
  })

  it('allows topic policy to tighten approved content only', () => {
    const approvedLight = createService({
      highestLevel: SensitiveWordLevelEnum.LIGHT,
    }).service.resolveTopicDecision('title', 'bad', 3)
    const rejectedSevere = createService({
      highestLevel: SensitiveWordLevelEnum.SEVERE,
    }).service.resolveTopicDecision('title', 'bad', 0)
    const manualWithoutHits = createService().service.resolveTopicDecision(
      'title',
      'clean',
      4,
    )

    expect(approvedLight.auditStatus).toBe(AuditStatusEnum.PENDING)
    expect(rejectedSevere.auditStatus).toBe(AuditStatusEnum.REJECTED)
    expect(rejectedSevere.isHidden).toBe(true)
    expect(manualWithoutHits.auditStatus).toBe(AuditStatusEnum.PENDING)
  })
})
