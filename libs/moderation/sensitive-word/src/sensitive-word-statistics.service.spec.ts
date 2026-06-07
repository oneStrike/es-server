import { AuditStatusEnum } from '@libs/platform/constant'
import {
  SensitiveWordHitEntityTypeEnum,
  SensitiveWordHitLogEntityStatusEnum,
} from './sensitive-word-constant'
import { SensitiveWordStatisticsService } from './sensitive-word-statistics.service'

type HitLogEntitySummaryRow = {
  commentAuditStatus: number | null
  commentContent: string | null
  commentDeletedAt: Date | null
  commentId: number | null
  commentIsHidden: boolean | null
  commentTargetId: number | null
  commentTargetType: number | null
  entityType: number
  topicAuditStatus: number | null
  topicContent: string | null
  topicDeletedAt: Date | null
  topicId: number | null
  topicIsHidden: boolean | null
  topicTitle: string | null
}

type StatisticsServiceTestHarness = {
  buildEntitySummary(row: HitLogEntitySummaryRow): {
    canNavigate: boolean
    status: SensitiveWordHitLogEntityStatusEnum
  }
}

const baseRow = {
  commentAuditStatus: null,
  commentContent: null,
  commentDeletedAt: null,
  commentId: null,
  commentIsHidden: null,
  commentTargetId: null,
  commentTargetType: null,
  topicAuditStatus: null,
  topicContent: null,
  topicDeletedAt: null,
  topicId: null,
  topicIsHidden: null,
  topicTitle: null,
}

function createService() {
  return new SensitiveWordStatisticsService(
    {} as never,
  ) as never as StatisticsServiceTestHarness
}

describe('SensitiveWordStatisticsService', () => {
  it('keeps hidden and rejected topic hit logs open for admin disposition', () => {
    const service = createService()

    const hiddenSummary = service.buildEntitySummary({
      ...baseRow,
      entityType: SensitiveWordHitEntityTypeEnum.TOPIC,
      topicAuditStatus: AuditStatusEnum.PENDING,
      topicContent: 'hidden topic content',
      topicId: 1,
      topicIsHidden: true,
      topicTitle: 'Hidden topic',
    })
    const rejectedSummary = service.buildEntitySummary({
      ...baseRow,
      entityType: SensitiveWordHitEntityTypeEnum.TOPIC,
      topicAuditStatus: AuditStatusEnum.REJECTED,
      topicContent: 'rejected topic content',
      topicId: 2,
      topicIsHidden: false,
      topicTitle: 'Rejected topic',
    })

    expect(hiddenSummary).toMatchObject({
      canNavigate: true,
      status: SensitiveWordHitLogEntityStatusEnum.HIDDEN,
    })
    expect(rejectedSummary).toMatchObject({
      canNavigate: true,
      status: SensitiveWordHitLogEntityStatusEnum.FORBIDDEN,
    })
  })

  it('keeps hidden and rejected comment hit logs open for admin disposition', () => {
    const service = createService()

    const hiddenSummary = service.buildEntitySummary({
      ...baseRow,
      commentAuditStatus: AuditStatusEnum.PENDING,
      commentContent: 'hidden comment content',
      commentId: 1,
      commentIsHidden: true,
      entityType: SensitiveWordHitEntityTypeEnum.COMMENT,
    })
    const rejectedSummary = service.buildEntitySummary({
      ...baseRow,
      commentAuditStatus: AuditStatusEnum.REJECTED,
      commentContent: 'rejected comment content',
      commentId: 2,
      commentIsHidden: false,
      entityType: SensitiveWordHitEntityTypeEnum.COMMENT,
    })

    expect(hiddenSummary).toMatchObject({
      canNavigate: true,
      status: SensitiveWordHitLogEntityStatusEnum.HIDDEN,
    })
    expect(rejectedSummary).toMatchObject({
      canNavigate: true,
      status: SensitiveWordHitLogEntityStatusEnum.FORBIDDEN,
    })
  })

  it('disables admin navigation for deleted or missing hit-log entities', () => {
    const service = createService()

    const deletedSummary = service.buildEntitySummary({
      ...baseRow,
      commentAuditStatus: AuditStatusEnum.APPROVED,
      commentDeletedAt: new Date('2026-06-07T00:00:00.000Z'),
      commentId: 1,
      commentIsHidden: false,
      entityType: SensitiveWordHitEntityTypeEnum.COMMENT,
    })
    const missingSummary = service.buildEntitySummary({
      ...baseRow,
      entityType: SensitiveWordHitEntityTypeEnum.TOPIC,
    })

    expect(deletedSummary).toMatchObject({
      canNavigate: false,
      status: SensitiveWordHitLogEntityStatusEnum.DELETED,
    })
    expect(missingSummary).toMatchObject({
      canNavigate: false,
      status: SensitiveWordHitLogEntityStatusEnum.MISSING,
    })
  })
})
