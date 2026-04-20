import { NotificationProjectionService } from './notification-projection.service'

function createProjectionDrizzleStub(options?: {
  comment?: {
    content?: string | null
  } | null
  chapter?: {
    id: number
    title?: string | null
    subtitle?: string | null
    cover?: string | null
    workId?: number | null
    workType?: number | null
    work?: {
      id: number
      name?: string | null
      cover?: string | null
      type?: number | null
    } | null
  } | null
  work?: {
    id: number
    name?: string | null
    cover?: string | null
    type?: number | null
  } | null
  topic?: {
    id: number
    title?: string | null
    sectionId?: number | null
    images?: string[] | null
  } | null
}) {
  const inserted: Array<Record<string, unknown>> = []
  const insertState: {
    value?: Record<string, unknown>
  } = {}

  const insertBuilder = {
    values: jest.fn(),
    onConflictDoNothing: jest.fn(),
    onConflictDoUpdate: jest.fn(),
    returning: jest.fn(),
  }

  insertBuilder.values.mockImplementation((value: Record<string, unknown>) => {
    insertState.value = value
    inserted.push(value)
    return insertBuilder
  })
  insertBuilder.onConflictDoNothing.mockReturnValue(insertBuilder)
  insertBuilder.onConflictDoUpdate.mockReturnValue(insertBuilder)
  insertBuilder.returning.mockImplementation(async () => [
    {
      id: 1,
      ...(insertState.value ?? {}),
    },
  ])

  const drizzle = {
    db: {
      insert: jest.fn().mockReturnValue(insertBuilder),
      query: {
        userNotification: {
          findFirst: jest.fn(),
        },
        userComment: {
          findFirst: jest.fn().mockResolvedValue(options?.comment ?? null),
        },
        workChapter: {
          findFirst: jest.fn().mockResolvedValue(options?.chapter ?? null),
        },
        work: {
          findFirst: jest.fn().mockResolvedValue(options?.work ?? null),
        },
        forumTopic: {
          findFirst: jest.fn().mockResolvedValue(options?.topic ?? null),
        },
      },
    },
    schema: {
      userNotification: {
        id: 'id',
        receiverUserId: 'receiverUserId',
        projectionKey: 'projectionKey',
        categoryKey: 'categoryKey',
        announcementId: 'announcementId',
        actorUserId: 'actorUserId',
        title: 'title',
        content: 'content',
        payload: 'payload',
        expiresAt: 'expiresAt',
      },
    },
  }
  return {
    drizzle,
    inserted,
  }
}

function createProjectionService(
  options?: Parameters<typeof createProjectionDrizzleStub>[0],
) {
  const { drizzle, inserted } = createProjectionDrizzleStub(options)
  const templateService = {
    renderNotificationTemplate: jest.fn().mockImplementation(async (input) => ({
      title: input.title,
      content: input.content,
      categoryKey: input.categoryKey,
      usedTemplate: false,
    })),
  }

  const service = new NotificationProjectionService(
    drizzle as never,
    {
      getEffectiveNotificationPreference: jest.fn(),
    } as never,
    templateService as never,
    {
      getSummary: jest.fn(),
    } as never,
  )

  return {
    service,
    inserted,
    templateService,
  }
}

describe('notification projection service', () => {
  it('keeps task reminder payload on the new contract only', async () => {
    const { service, inserted, templateService } = createProjectionService()

    await service.applyCommand(
      {
        mode: 'append',
        receiverUserId: 7,
        projectionKey: 'task:reminder:reward:assignment:10',
        categoryKey: 'task_reminder',
        mandatory: true,
        title: '奖励到账',
        content: '你获得了 5 积分',
        payload: {
          object: {
            kind: 'task',
            id: 5,
            code: 'daily-comment',
            title: '每日评论',
            type: 2,
          },
          reminder: {
            kind: 'reward_granted',
            assignmentId: 10,
          },
          reward: {
            items: [
              {
                assetType: 1,
                amount: 5,
              },
            ],
            ledgerRecordIds: [101],
          },
        },
      },
      {} as never,
      {} as never,
    )

    expect(templateService.renderNotificationTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          object: {
            kind: 'task',
            id: 5,
            code: 'daily-comment',
            title: '每日评论',
            type: 2,
          },
          reminder: {
            kind: 'reward_granted',
            assignmentId: 10,
          },
          reward: {
            items: [
              {
                assetType: 1,
                amount: 5,
              },
            ],
            ledgerRecordIds: [101],
          },
        },
      }),
    )
    expect(inserted[0].payload).toEqual({
      object: {
        kind: 'task',
        id: 5,
        code: 'daily-comment',
        title: '每日评论',
        type: 2,
      },
      reminder: {
        kind: 'reward_granted',
        assignmentId: 10,
      },
      reward: {
        items: [
          {
            assetType: 1,
            amount: 5,
          },
        ],
        ledgerRecordIds: [101],
      },
    })
  })

  it('enriches chapter comment notifications with parent work snapshots', async () => {
    const { service, inserted, templateService } = createProjectionService({
      comment: {
        content: '这条评论很关键',
      },
      chapter: {
        id: 17,
        title: '第 17 话',
        subtitle: '暴雨将至',
        cover: null,
        workId: 8,
        workType: 1,
        work: {
          id: 8,
          name: '作品标题',
          cover: 'https://example.com/work-cover.png',
          type: 1,
        },
      },
    })

    await service.applyCommand(
      {
        mode: 'append',
        receiverUserId: 7,
        projectionKey: 'comment:reply:101:to:7',
        categoryKey: 'comment_reply',
        mandatory: true,
        title: '小光 回复了你的评论',
        content: '这条评论很关键',
        payload: {
          object: {
            kind: 'comment',
            id: 101,
          },
          container: {
            kind: 'chapter',
            id: 17,
            title: '旧章节标题',
          },
        },
      },
      {} as never,
      {} as never,
    )

    expect(templateService.renderNotificationTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          object: {
            kind: 'comment',
            id: 101,
            snippet: '这条评论很关键',
          },
          container: {
            kind: 'chapter',
            id: 17,
            title: '第 17 话',
            subtitle: '暴雨将至',
            cover: 'https://example.com/work-cover.png',
            workId: 8,
            workType: 1,
          },
          parentContainer: {
            kind: 'work',
            id: 8,
            title: '作品标题',
            cover: 'https://example.com/work-cover.png',
            workType: 1,
          },
        },
      }),
    )
    expect(inserted[0].payload).toEqual({
      object: {
        kind: 'comment',
        id: 101,
        snippet: '这条评论很关键',
      },
      container: {
        kind: 'chapter',
        id: 17,
        title: '第 17 话',
        subtitle: '暴雨将至',
        cover: 'https://example.com/work-cover.png',
        workId: 8,
        workType: 1,
      },
      parentContainer: {
        kind: 'work',
        id: 8,
        title: '作品标题',
        cover: 'https://example.com/work-cover.png',
        workType: 1,
      },
    })
  })

  it('stores typed announcement lookup fields for system announcements', async () => {
    const { service, inserted } = createProjectionService()

    await service.applyCommand(
      {
        mode: 'upsert',
        receiverUserId: 7,
        projectionKey: 'announcement:notify:42:user:7',
        categoryKey: 'system_announcement',
        mandatory: true,
        title: '版本更新',
        content: '公告内容',
        payload: {
          object: {
            kind: 'announcement',
            id: 42,
            title: '版本更新',
          },
        },
      },
      {} as never,
      {} as never,
    )

    expect(inserted[0]).toMatchObject({
      announcementId: 42,
    })
  })

  it('rejects system announcements without typed lookup id', async () => {
    const { service } = createProjectionService()

    await expect(
      service.applyCommand(
        {
          mode: 'upsert',
          receiverUserId: 7,
          projectionKey: 'announcement:notify:42:user:7',
          categoryKey: 'system_announcement',
          mandatory: true,
          title: '版本更新',
          content: '公告内容',
          payload: {
            object: {
              kind: 'announcement',
              title: '版本更新',
            },
          },
        },
        {} as never,
        {} as never,
      ),
    ).rejects.toThrow(
      'system_announcement notification must provide payload.object.id',
    )
  })
})
