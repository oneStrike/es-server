import * as schema from '@db/schema'
import { SceneTypeEnum } from '@libs/platform/constant'
import { sql } from 'drizzle-orm'
import {
  ReportReasonEnum,
  ReportStatusEnum,
  ReportTargetTypeEnum,
} from './report.constant'
import { ReportService } from './report.service'

function createSelectChain(rows: unknown[]) {
  const chain = {
    from: jest.fn(() => chain),
    limit: jest.fn(() => chain),
    offset: jest.fn(async () => rows),
    orderBy: jest.fn(() => chain),
    where: jest.fn(() => chain),
  }

  return chain
}

function createSubject(rows: unknown[] = [], total = 2) {
  const pageQuery = {
    limit: 1,
    offset: 1,
    pageIndex: 2,
    pageSize: 1,
  }
  const selectChain = createSelectChain(rows)
  const drizzle = {
    buildPage: jest.fn(() => pageQuery),
    buildPageParams: jest.fn(() => ({
      page: pageQuery,
      order: {
        orderByClause: sql.raw('created_at desc'),
        orderBySql: [],
      },
      dateRange: undefined,
    })),
    db: {
      $count: jest.fn(async () => total),
      select: jest.fn(() => selectChain),
    },
    schema,
  }
  const interactionSummaryReadService = {
    buildSceneSummaryKey: jest.fn((item: { id: number }) => `scene:${item.id}`),
    buildTargetSummaryKey: jest.fn(
      (item: { id: number }) => `target:${item.id}`,
    ),
    getReportTargetSummaryMap: jest.fn(
      async () => new Map([['target:101', { title: 'Reported target' }]]),
    ),
    getSceneSummaryMap: jest.fn(
      async () => new Map([['scene:101', { title: 'Reported scene' }]]),
    ),
  }
  const service = new (ReportService as any)(
    {},
    drizzle,
    interactionSummaryReadService,
  ) as ReportService

  return {
    drizzle,
    interactionSummaryReadService,
    pageQuery,
    selectChain,
    service,
  }
}

describe('ReportService app page contract', () => {
  it('returns user reports with summaries and offset pagination', async () => {
    const rows = [
      {
        id: 101,
        reporterId: 33,
        handlerId: null,
        targetType: ReportTargetTypeEnum.COMIC,
        targetId: 201,
        sceneType: SceneTypeEnum.COMIC_WORK,
        sceneId: 201,
        commentLevel: null,
        reasonType: ReportReasonEnum.SPAM,
        description: null,
        evidenceUrl: null,
        status: ReportStatusEnum.PENDING,
        createdAt: new Date('2026-06-02T00:00:00.000Z'),
        updatedAt: new Date('2026-06-02T00:00:00.000Z'),
      },
    ]
    const { drizzle, pageQuery, selectChain, service } = createSubject(rows)

    const page = await service.getUserReports({
      reporterId: 33,
      pageIndex: 2,
      pageSize: 1,
    })

    expect(drizzle.buildPageParams).toHaveBeenCalledWith(
      expect.objectContaining({ reporterId: 33, pageIndex: 2, pageSize: 1 }),
      expect.any(Object),
    )
    expect(selectChain.orderBy).toHaveBeenCalled()
    expect(selectChain.limit).toHaveBeenCalledWith(pageQuery.limit)
    expect(selectChain.offset).toHaveBeenCalledWith(pageQuery.offset)
    expect(drizzle.db.$count).toHaveBeenCalledWith(
      schema.userReport,
      expect.anything(),
    )
    expect(page).toMatchObject({
      total: 2,
      pageIndex: 2,
      pageSize: 1,
      list: [
        {
          id: 101,
          targetSummary: { title: 'Reported target' },
          sceneSummary: { title: 'Reported scene' },
        },
      ],
    })
    expect(page.list.map((item) => item.id)).toEqual([101])
    expect(page).not.toHaveProperty('hasMore')
    expect(page).not.toHaveProperty('nextCursor')
  })

  it('returns empty user reports without summary lookups', async () => {
    const { interactionSummaryReadService, service } = createSubject([])

    const page = await service.getUserReports({
      reporterId: 33,
      pageIndex: 2,
      pageSize: 1,
    })

    expect(page).toEqual({
      list: [],
      total: 2,
      pageIndex: 2,
      pageSize: 1,
    })
    expect(
      interactionSummaryReadService.getReportTargetSummaryMap,
    ).not.toHaveBeenCalled()
    expect(
      interactionSummaryReadService.getSceneSummaryMap,
    ).not.toHaveBeenCalled()
    expect(page).not.toHaveProperty('hasMore')
    expect(page).not.toHaveProperty('nextCursor')
  })
})
