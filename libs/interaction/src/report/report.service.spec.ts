/// <reference types="jest" />
import { userReport } from '@db/schema'
import { SceneTypeEnum } from '@libs/platform/constant'
import {
  ReportReasonEnum,
  ReportStatusEnum,
  ReportTargetTypeEnum,
} from './report.constant'
import { ReportService } from './report.service'

type TargetKeyInput = {
  targetType: number
  targetId: number
}

type SceneKeyInput = {
  sceneType: number
  sceneId: number
}

function createSelectMock(rows: unknown[]) {
  return jest.fn(() => ({
    from: jest.fn(() => ({
      where: jest.fn(() => ({
        limit: jest.fn().mockResolvedValue(rows),
      })),
    })),
  }))
}

function createSummaryServiceMock() {
  return {
    buildTargetSummaryKey: jest.fn(
      (target: TargetKeyInput) => `${target.targetType}:${target.targetId}`,
    ),
    buildSceneSummaryKey: jest.fn(
      (scene: SceneKeyInput) => `${scene.sceneType}:${scene.sceneId}`,
    ),
    buildAdminActorSummaryKey: jest.fn((adminId: number) => `admin:${adminId}`),
    getReportTargetSummaryMap: jest.fn(),
    getSceneSummaryMap: jest.fn(),
    getAppUserSummaryMap: jest.fn(),
    getAdminActorSummaryMap: jest.fn(),
    getReportCommentSummaryMap: jest.fn(),
  }
}

function createReportServiceHarness(options: {
  page?: unknown
  selectRows?: unknown[]
}) {
  const summaryService = createSummaryServiceMock()
  const findPagination = jest.fn().mockResolvedValue(options.page)
  const select = createSelectMock(options.selectRows ?? [])
  const drizzle = {
    db: {
      select,
    },
    schema: {
      userReport,
    },
    ext: {
      findPagination,
    },
  }
  const service = new ReportService(
    { rewardReportHandled: jest.fn() } as never,
    drizzle as never,
    summaryService as never,
  )

  return {
    service,
    summaryService,
    findPagination,
    select,
  }
}

function createBaseReport(overrides: Partial<typeof userReport.$inferSelect>) {
  return {
    id: 31,
    reporterId: 7,
    handlerId: 2,
    targetType: ReportTargetTypeEnum.COMMENT,
    targetId: 9,
    sceneType: SceneTypeEnum.FORUM_TOPIC,
    sceneId: 5,
    commentLevel: null,
    reasonType: ReportReasonEnum.INAPPROPRIATE_CONTENT,
    description: null,
    evidenceUrl: null,
    status: ReportStatusEnum.PENDING,
    handlingNote: null,
    handledAt: null,
    createdAt: new Date('2026-05-01T00:00:00.000Z'),
    updatedAt: new Date('2026-05-01T00:00:00.000Z'),
    deletedAt: null,
    ...overrides,
  }
}

describe('ReportService summary decoration', () => {
  it('adds target and scene summaries to user report pages', async () => {
    const report = createBaseReport({ handlerId: null })
    const page = {
      list: [report],
      pageIndex: 1,
      pageSize: 20,
      total: 1,
    }
    const targetSummary = {
      targetId: 9,
      targetType: ReportTargetTypeEnum.COMMENT,
      targetTypeName: '评论',
      contentExcerpt: '被举报评论',
    }
    const sceneSummary = {
      sceneId: 5,
      sceneType: SceneTypeEnum.FORUM_TOPIC,
      sceneTypeName: '论坛主题',
      title: '主题标题',
    }
    const { service, summaryService } = createReportServiceHarness({ page })
    summaryService.getReportTargetSummaryMap.mockResolvedValue(
      new Map([['6:9', targetSummary]]),
    )
    summaryService.getSceneSummaryMap.mockResolvedValue(
      new Map([['3:5', sceneSummary]]),
    )

    const result = await service.getUserReports({
      reporterId: 7,
      pageIndex: 1,
      pageSize: 20,
    } as never)

    expect(result.list[0]).toMatchObject({
      targetSummary,
      sceneSummary,
    })
    expect(summaryService.getReportTargetSummaryMap).toHaveBeenCalledWith(
      page.list,
    )
    expect(summaryService.getSceneSummaryMap).toHaveBeenCalledWith(page.list)
  })

  it('adds reporter, handler, target, and scene summaries to admin report pages', async () => {
    const report = createBaseReport({})
    const page = {
      list: [report],
      pageIndex: 1,
      pageSize: 20,
      total: 1,
    }
    const reporterSummary = {
      id: 7,
      nickname: '举报人',
      avatarUrl: 'https://example.com/reporter.png',
      status: 1,
      isEnabled: true,
    }
    const handlerSummary = {
      id: 2,
      username: 'admin',
      nickname: 'admin',
      avatar: undefined,
      roleName: '普通管理员',
    }
    const targetSummary = {
      targetId: 9,
      targetType: ReportTargetTypeEnum.COMMENT,
      targetTypeName: '评论',
      contentExcerpt: '被举报评论',
    }
    const sceneSummary = {
      sceneId: 5,
      sceneType: SceneTypeEnum.FORUM_TOPIC,
      sceneTypeName: '论坛主题',
      title: '主题标题',
    }
    const { service, summaryService } = createReportServiceHarness({ page })
    summaryService.getAppUserSummaryMap.mockResolvedValue(
      new Map([[7, reporterSummary]]),
    )
    summaryService.getAdminActorSummaryMap.mockResolvedValue(
      new Map([['admin:2', handlerSummary]]),
    )
    summaryService.getReportTargetSummaryMap.mockResolvedValue(
      new Map([['6:9', targetSummary]]),
    )
    summaryService.getSceneSummaryMap.mockResolvedValue(
      new Map([['3:5', sceneSummary]]),
    )

    const result = await service.getAdminReportPage({
      pageIndex: 1,
      pageSize: 20,
    } as never)

    expect(result.list[0]).toMatchObject({
      reporterSummary,
      handlerSummary,
      targetSummary,
      sceneSummary,
    })
    expect(summaryService.getAppUserSummaryMap).toHaveBeenCalledWith([7])
    expect(summaryService.getAdminActorSummaryMap).toHaveBeenCalledWith([2])
  })

  it('adds detail summaries and comment summary for user report detail comment targets', async () => {
    const report = createBaseReport({})
    const targetSummary = {
      targetId: 9,
      targetType: ReportTargetTypeEnum.COMMENT,
      targetTypeName: '评论',
      contentExcerpt: '被举报评论',
      authorNickname: '作者',
    }
    const sceneSummary = {
      sceneId: 5,
      sceneType: SceneTypeEnum.FORUM_TOPIC,
      sceneTypeName: '论坛主题',
      title: '主题标题',
    }
    const commentSummary = {
      commentId: 9,
      contentExcerpt: '被举报评论',
      commentLevel: 1,
      isHidden: false,
      auditStatus: 1,
    }
    const { service, summaryService } = createReportServiceHarness({
      selectRows: [report],
    })
    summaryService.getReportTargetSummaryMap.mockResolvedValue(
      new Map([['6:9', targetSummary]]),
    )
    summaryService.getSceneSummaryMap.mockResolvedValue(
      new Map([['3:5', sceneSummary]]),
    )
    summaryService.getReportCommentSummaryMap.mockResolvedValue(
      new Map([[9, commentSummary]]),
    )

    const result = await service.getReportDetail(31, 7)

    expect(result).toMatchObject({
      targetSummary,
      sceneSummary,
      commentSummary,
    })
    expect(summaryService.getReportTargetSummaryMap).toHaveBeenCalledWith(
      [report],
      { detail: true },
    )
    expect(summaryService.getReportCommentSummaryMap).toHaveBeenCalledWith([9])
  })

  it('adds all admin detail summaries for comment targets', async () => {
    const report = createBaseReport({})
    const reporterSummary = {
      id: 7,
      nickname: '举报人',
      avatarUrl: 'https://example.com/reporter.png',
      status: 1,
      isEnabled: true,
    }
    const handlerSummary = {
      id: 2,
      username: 'admin',
      nickname: 'admin',
      avatar: undefined,
      roleName: '普通管理员',
    }
    const targetSummary = {
      targetId: 9,
      targetType: ReportTargetTypeEnum.COMMENT,
      targetTypeName: '评论',
      contentExcerpt: '被举报评论',
      authorNickname: '作者',
    }
    const sceneSummary = {
      sceneId: 5,
      sceneType: SceneTypeEnum.FORUM_TOPIC,
      sceneTypeName: '论坛主题',
      title: '主题标题',
    }
    const commentSummary = {
      commentId: 9,
      contentExcerpt: '被举报评论',
      commentLevel: 1,
      isHidden: false,
      auditStatus: 1,
    }
    const { service, summaryService } = createReportServiceHarness({
      selectRows: [report],
    })
    summaryService.getAppUserSummaryMap.mockResolvedValue(
      new Map([[7, reporterSummary]]),
    )
    summaryService.getAdminActorSummaryMap.mockResolvedValue(
      new Map([['admin:2', handlerSummary]]),
    )
    summaryService.getReportTargetSummaryMap.mockResolvedValue(
      new Map([['6:9', targetSummary]]),
    )
    summaryService.getSceneSummaryMap.mockResolvedValue(
      new Map([['3:5', sceneSummary]]),
    )
    summaryService.getReportCommentSummaryMap.mockResolvedValue(
      new Map([[9, commentSummary]]),
    )

    const result = await service.getAdminReportDetail(31)

    expect(result).toMatchObject({
      reporterSummary,
      handlerSummary,
      targetSummary,
      sceneSummary,
      commentSummary,
    })
    expect(summaryService.getAppUserSummaryMap).toHaveBeenCalledWith([7])
    expect(summaryService.getAdminActorSummaryMap).toHaveBeenCalledWith([2])
  })
})
