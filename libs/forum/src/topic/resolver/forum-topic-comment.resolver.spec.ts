import { AuditStatusEnum, BusinessErrorCode } from '@libs/platform/constant'
import { ForumTopicCommentResolver } from './forum-topic-comment.resolver'

describe('ForumTopicCommentResolver governance visibility handling', () => {
  function createResolver() {
    return new ForumTopicCommentResolver(
      {
        registerResolver: jest.fn(),
      } as never,
      {
        publishInTx: jest.fn(),
      } as never,
      {
        buildTopicCommentedEvent: jest.fn(),
      } as never,
      {} as never,
      {
        createActionLogInTx: jest.fn(),
      } as never,
      {
        isSectionPubliclyAvailable: jest.fn().mockReturnValue(true),
      } as never,
    )
  }

  it('keeps user-facing comment creation blocked for hidden topics', async () => {
    const resolver = createResolver()
    const tx = {
      query: {
        forumTopic: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
      },
    }

    await expect(
      resolver.ensureCanComment(tx as never, 11),
    ).rejects.toMatchObject({
      code: BusinessErrorCode.RESOURCE_NOT_FOUND,
    })
  })

  it('still resolves governance metadata for hidden forum topics', async () => {
    const resolver = createResolver()
    const tx = {
      query: {
        forumTopic: {
          findFirst: jest.fn().mockResolvedValue({
            isLocked: false,
            userId: 7,
            sectionId: 3,
            title: '隐藏主题',
            section: {
              groupId: 3,
              isEnabled: true,
              deletedAt: null,
              group: null,
            },
          }),
        },
      },
    }

    await expect(resolver.resolveMeta(tx as never, 11)).resolves.toEqual({
      ownerUserId: 7,
      sectionId: 3,
      targetDisplayTitle: '隐藏主题',
    })
    expect(tx.query.forumTopic.findFirst).toHaveBeenCalledWith({
      where: {
        id: 11,
        deletedAt: { isNull: true },
      },
      columns: {
        isLocked: true,
        userId: true,
        sectionId: true,
        title: true,
      },
      with: {
        section: {
          columns: {
            groupId: true,
            isEnabled: true,
            deletedAt: true,
          },
          with: {
            group: {
              columns: {
                isEnabled: true,
                deletedAt: true,
              },
            },
          },
        },
      },
    })
  })

  it('requires public visibility when validating comment creation targets', async () => {
    const resolver = createResolver()
    const tx = {
      query: {
        forumTopic: {
          findFirst: jest.fn().mockResolvedValue({
            isLocked: false,
            userId: 7,
            sectionId: 3,
            title: '公开主题',
            section: {
              groupId: 3,
              isEnabled: true,
              deletedAt: null,
              group: null,
            },
          }),
        },
      },
    }

    await expect(resolver.ensureCanComment(tx as never, 11)).resolves.toBe(
      undefined,
    )
    expect(tx.query.forumTopic.findFirst).toHaveBeenCalledWith({
      where: {
        id: 11,
        deletedAt: { isNull: true },
        auditStatus: AuditStatusEnum.APPROVED,
        isHidden: false,
      },
      columns: {
        isLocked: true,
        userId: true,
        sectionId: true,
        title: true,
      },
      with: {
        section: {
          columns: {
            groupId: true,
            isEnabled: true,
            deletedAt: true,
          },
          with: {
            group: {
              columns: {
                isEnabled: true,
                deletedAt: true,
              },
            },
          },
        },
      },
    })
  })

  it('blocks user-facing comment creation when the topic section group is not publicly visible', async () => {
    const resolver = new ForumTopicCommentResolver(
      {
        registerResolver: jest.fn(),
      } as never,
      {
        publishInTx: jest.fn(),
      } as never,
      {
        buildTopicCommentedEvent: jest.fn(),
      } as never,
      {} as never,
      {
        createActionLogInTx: jest.fn(),
      } as never,
      {
        isSectionPubliclyAvailable: jest.fn().mockReturnValue(false),
      } as never,
    )
    const tx = {
      query: {
        forumTopic: {
          findFirst: jest.fn().mockResolvedValue({
            isLocked: false,
            userId: 7,
            sectionId: 3,
            title: '公开主题',
            section: {
              groupId: 3,
              isEnabled: true,
              deletedAt: null,
              group: {
                isEnabled: false,
                deletedAt: null,
              },
            },
          }),
        },
      },
    }

    await expect(
      resolver.ensureCanComment(tx as never, 11),
    ).rejects.toMatchObject({
      code: BusinessErrorCode.RESOURCE_NOT_FOUND,
      message: '帖子不存在',
    })
  })
})
