import { BusinessErrorCode } from '@libs/platform/constant'
import { ForumModeratorApplicationService } from './moderator-application.service'
import { ForumModeratorApplicationStatusEnum } from './moderator-application.constant'

describe('ForumModeratorApplicationService', () => {
  function createService() {
    const forumModeratorApplicationFindFirst = jest.fn()
    const forumSectionFindFirst = jest.fn()
    const forumModeratorFindFirst = jest.fn()
    const txUpdateWhere = jest.fn().mockResolvedValue({ rowCount: 1 })
    const tx = {
      query: {
        forumSection: {
          findFirst: forumSectionFindFirst,
        },
        forumModerator: {
          findFirst: forumModeratorFindFirst,
        },
      },
      update: jest.fn(() => ({
        set: jest.fn(() => ({
          where: txUpdateWhere,
        })),
      })),
    }
    const drizzle = {
      db: {
        query: {
          forumModeratorApplication: {
            findFirst: forumModeratorApplicationFindFirst,
          },
        },
        transaction: jest.fn(async (callback: (client: typeof tx) => Promise<void>) =>
          callback(tx),
        ),
      },
      schema: {
        forumModeratorApplication: {},
      },
      withErrorHandling: jest.fn(async (callback: () => Promise<void>) =>
        callback(),
      ),
      assertAffectedRows: jest.fn((result: { rowCount?: number | null }) => {
        if ((result.rowCount ?? 0) === 0) {
          throw new Error('expected affected rows')
        }
      }),
    }
    const forumModeratorService = {
      createSectionModeratorFromApplication: jest.fn().mockResolvedValue(true),
    }

    const service = new ForumModeratorApplicationService(
      drizzle as never,
      forumModeratorService as never,
    )

    return {
      service,
      tx,
      forumModeratorApplicationFindFirst,
      forumModeratorService,
      forumModeratorFindFirst,
      forumSectionFindFirst,
    }
  }

  it('allows rejecting a pending application even when its section is already unavailable', async () => {
    const {
      service,
      forumModeratorApplicationFindFirst,
      forumModeratorService,
      forumSectionFindFirst,
    } = createService()
    forumModeratorApplicationFindFirst.mockResolvedValue({
      id: 11,
      applicantId: 8,
      sectionId: 5,
      status: ForumModeratorApplicationStatusEnum.PENDING,
      permissions: [1, 5],
      remark: '待审核',
      deletedAt: null,
    })

    await expect(
      service.auditApplication(3, {
        id: 11,
        status: ForumModeratorApplicationStatusEnum.REJECTED,
        auditReason: '板块已停用',
      }),
    ).resolves.toBe(true)

    expect(forumSectionFindFirst).not.toHaveBeenCalled()
    expect(
      forumModeratorService.createSectionModeratorFromApplication,
    ).not.toHaveBeenCalled()
  })

  it('creates the moderator grant inside the same transaction before closing the application', async () => {
    const {
      service,
      tx,
      forumModeratorApplicationFindFirst,
      forumModeratorService,
      forumModeratorFindFirst,
      forumSectionFindFirst,
    } = createService()
    forumModeratorApplicationFindFirst.mockResolvedValue({
      id: 12,
      applicantId: 9,
      sectionId: 6,
      status: ForumModeratorApplicationStatusEnum.PENDING,
      permissions: [1, 5],
      remark: '待审核',
      deletedAt: null,
    })
    forumSectionFindFirst.mockResolvedValue({ id: 6 })
    forumModeratorFindFirst.mockResolvedValue(null)

    await expect(
      service.auditApplication(4, {
        id: 12,
        status: ForumModeratorApplicationStatusEnum.APPROVED,
        auditReason: '审核通过',
      }),
    ).resolves.toBe(true)

    expect(
      forumModeratorService.createSectionModeratorFromApplication,
    ).toHaveBeenCalledWith(
      {
        userId: 9,
        sectionId: 6,
        permissions: [1, 5],
      },
      tx,
    )
  })

  it('reports empty application permissions through business codes', async () => {
    const { service } = createService()
    const privateApi = service as unknown as {
      ensureApplicantExists: (applicantId: number) => Promise<void>
      ensureUserNotModerator: (applicantId: number) => Promise<void>
      ensureSectionExists: (sectionId: number) => Promise<void>
    }
    privateApi.ensureApplicantExists = jest.fn().mockResolvedValue(undefined)
    privateApi.ensureUserNotModerator = jest.fn().mockResolvedValue(undefined)
    privateApi.ensureSectionExists = jest.fn().mockResolvedValue(undefined)

    await expect(
      service.createApplication(9, {
        sectionId: 6,
        permissions: [],
        reason: '想参与管理',
      }),
    ).rejects.toMatchObject({
      code: BusinessErrorCode.OPERATION_NOT_ALLOWED,
      message: '申请权限不能为空',
    })
  })
})
