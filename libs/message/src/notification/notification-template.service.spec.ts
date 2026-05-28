import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { MessageNotificationTemplateService } from './notification-template.service'

describe('MessageNotificationTemplateService database error handling', () => {
  it('maps caught unknown unique violations to category-specific business errors with cause', async () => {
    const source = { code: '23505', constraint: 'notification_template_key' }
    const service = new MessageNotificationTemplateService({
      schema: {
        notificationTemplate: {},
      },
      db: {
        insert: jest.fn(() => ({
          values: jest.fn(() => Promise.reject(source)),
        })),
      },
      withErrorHandling: jest.fn((fn: () => Promise<unknown>) => fn()),
      isUniqueViolation: jest.fn((error: unknown) => error === source),
    } as never)

    await expect(
      service.createNotificationTemplate({
        categoryKey: 'comment_reply',
        titleTemplate: '{{actor.nickname}} 回复了你',
        contentTemplate: '{{data.object.snippet}}',
      }),
    ).rejects.toMatchObject({
      code: BusinessErrorCode.RESOURCE_ALREADY_EXISTS,
      message: '该通知分类的模板已存在',
      cause: source,
    } satisfies Partial<BusinessException>)
  })
})
