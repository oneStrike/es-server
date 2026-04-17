import type { DrizzleService } from '@db/core'
import { MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM } from './notification.constant'
import { MessageNotificationTemplateService } from './notification-template.service'

function createTemplateDrizzleStub(template?: {
  id: number
  titleTemplate: string
  contentTemplate: string
}) {
  const inserted: Array<Record<string, unknown>> = []

  const drizzle = {
    db: {
      insert: jest.fn().mockReturnValue({
        values: jest
          .fn()
          .mockImplementation((value: Record<string, unknown>) => {
            inserted.push(value)
            return Promise.resolve(value)
          }),
      }),
      query: {
        notificationTemplate: {
          findFirst: jest.fn().mockResolvedValue(template),
        },
      },
    },
    schema: {
      notificationTemplate: {},
    },
    withErrorHandling: jest
      .fn()
      .mockImplementation(async (fn: () => Promise<unknown>) => fn()),
    isUniqueViolation: jest.fn().mockReturnValue(false),
  } as unknown as DrizzleService

  return {
    drizzle,
    inserted,
  }
}

describe('MessageNotificationTemplateService', () => {
  it('accepts root title/content placeholders for destructive template migration', async () => {
    const { drizzle, inserted } = createTemplateDrizzleStub()
    const service = new MessageNotificationTemplateService(drizzle)

    await expect(
      service.createNotificationTemplate({
        categoryKey: MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.TASK_REMINDER,
        titleTemplate: '{{title}}',
        contentTemplate: '{{content}}',
      }),
    ).resolves.toBe(true)

    expect(inserted).toHaveLength(1)
    expect(inserted[0]).toMatchObject({
      categoryKey: MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.TASK_REMINDER,
      titleTemplate: '{{title}}',
      contentTemplate: '{{content}}',
    })
  })

  it('renders root title/content placeholders without falling back', async () => {
    const { drizzle } = createTemplateDrizzleStub({
      id: 1,
      titleTemplate: '{{title}}',
      contentTemplate: '{{content}}',
    })
    const service = new MessageNotificationTemplateService(drizzle)

    const rendered = await service.renderNotificationTemplate({
      categoryKey: MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.SYSTEM_ANNOUNCEMENT,
      receiverUserId: 1,
      title: '公告标题',
      content: '公告摘要',
      payload: {
        subject: {
          kind: 'announcement',
          id: 7,
          title: '公告标题',
        },
      },
    })

    expect(rendered).toEqual({
      title: '公告标题',
      content: '公告摘要',
      categoryKey: MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.SYSTEM_ANNOUNCEMENT,
      templateId: 1,
      usedTemplate: true,
    })
  })
})
