import { AuditStatusEnum } from '@libs/platform/constant'
import { ForumHashtagService } from './forum-hashtag.service'

function createHotPageQuery(rows: unknown[]) {
  return {
    from: jest.fn(() => ({
      where: jest.fn(() => ({
        orderBy: jest.fn(() => ({
          limit: jest.fn(() => ({
            offset: jest.fn().mockResolvedValue(rows),
          })),
        })),
      })),
    })),
  }
}

describe('ForumHashtagService public contracts', () => {
  it('returns only public detail DTO fields', async () => {
    const service = new ForumHashtagService(
      {
        db: {
          query: {
            forumHashtag: {
              findFirst: jest.fn().mockResolvedValue({
                id: 77,
                slug: 'typescript',
                displayName: 'TypeScript',
                description: '类型系统',
                topicRefCount: 12,
                commentRefCount: 8,
                followerCount: 5,
                lastReferencedAt: new Date('2026-04-28T00:00:00.000Z'),
                manualBoost: 99,
                auditStatus: AuditStatusEnum.APPROVED,
                isHidden: false,
                deletedAt: null,
              }),
            },
          },
        },
        schema: {},
      } as never,
      {} as never,
      {
        checkStatusBatch: jest.fn().mockResolvedValue(new Map([[77, true]])),
      } as never,
      {} as never,
      {} as never,
    )

    await expect(service.getPublicHashtagDetail(77, 9)).resolves.toEqual({
      id: 77,
      slug: 'typescript',
      displayName: 'TypeScript',
      description: '类型系统',
      topicRefCount: 12,
      commentRefCount: 8,
      followerCount: 5,
      lastReferencedAt: new Date('2026-04-28T00:00:00.000Z'),
      isFollowed: true,
    })
  })

  it('strips internal fields from hot page items', async () => {
    const service = new ForumHashtagService(
      {
        db: {
          select: jest.fn(() =>
            createHotPageQuery([
              {
                id: 77,
                slug: 'typescript',
                displayName: 'TypeScript',
                description: '类型系统',
                topicRefCount: 12,
                commentRefCount: 8,
                followerCount: 5,
                lastReferencedAt: new Date('2026-04-28T00:00:00.000Z'),
                createdAt: new Date('2026-04-01T00:00:00.000Z'),
                updatedAt: new Date('2026-04-02T00:00:00.000Z'),
                manualBoost: 99,
                hotScore: 123,
              },
            ]),
          ),
          $count: jest.fn().mockResolvedValue(1),
        },
        buildPage: jest.fn(() => ({
          pageIndex: 1,
          pageSize: 10,
          limit: 10,
          offset: 0,
        })),
        schema: {
          forumHashtag: {
            id: 'id',
            slug: 'slug',
            displayName: 'displayName',
            description: 'description',
            manualBoost: 'manualBoost',
            topicRefCount: 'topicRefCount',
            commentRefCount: 'commentRefCount',
            followerCount: 'followerCount',
            lastReferencedAt: 'lastReferencedAt',
            auditStatus: 'auditStatus',
            isHidden: 'isHidden',
            deletedAt: 'deletedAt',
          },
        },
      } as never,
      {} as never,
      {
        checkStatusBatch: jest.fn().mockResolvedValue(new Map([[77, false]])),
      } as never,
      {} as never,
      {} as never,
    )

    await expect(
      service.getHotHashtagPage({
        pageIndex: 1,
        pageSize: 10,
        userId: 9,
      }),
    ).resolves.toEqual({
      list: [
        {
          id: 77,
          slug: 'typescript',
          displayName: 'TypeScript',
          description: '类型系统',
          topicRefCount: 12,
          commentRefCount: 8,
          followerCount: 5,
          lastReferencedAt: new Date('2026-04-28T00:00:00.000Z'),
          hotScore: 123,
          isFollowed: false,
        },
      ],
      total: 1,
      pageIndex: 1,
      pageSize: 10,
    })
  })
})
