import type { DrizzleService } from '@db/core'
import { MessageNotificationTemplateService } from './notification-template.service'

function createNotificationTemplateService() {
  const findNotificationTemplate = jest.fn()
  const findAppUser = jest.fn()
  const drizzle = {
    db: {
      query: {
        appUser: {
          findFirst: findAppUser,
        },
        notificationTemplate: {
          findFirst: findNotificationTemplate,
        },
      },
    },
  } as unknown as DrizzleService

  return {
    service: new MessageNotificationTemplateService(drizzle),
    mocks: {
      findAppUser,
      findNotificationTemplate,
    },
  }
}

describe('notification-template.service', () => {
  it('rejects placeholders that do not belong to the selected category', async () => {
    const { service, mocks } = createNotificationTemplateService()

    await expect(
      service.createNotificationTemplate({
        categoryKey: 'user_followed',
        titleTemplate: '{{data.object.title}}',
        contentTemplate: '{{actor.nickname}} 关注了你',
      }),
    ).rejects.toThrow(
      'titleTemplate 存在当前通知分类不支持的占位符: data.object.title',
    )

    expect(mocks.findNotificationTemplate).not.toHaveBeenCalled()
  })

  it('queries the enabled template on each render so admin changes are not hidden by local cache', async () => {
    const { service, mocks } = createNotificationTemplateService()
    mocks.findAppUser.mockResolvedValue({
      id: 7,
      nickname: '测试用户',
      avatarUrl: null,
    })
    mocks.findNotificationTemplate.mockResolvedValue({
      id: 11,
      titleTemplate: '{{actor.nickname}} 关注了你',
      contentTemplate: '{{actor.nickname}} 关注了你',
    })

    const input = {
      categoryKey: 'user_followed' as const,
      receiverUserId: 9,
      actorUserId: 7,
      title: 'fallback title',
      content: 'fallback content',
    }

    await expect(
      service.renderNotificationTemplate(input),
    ).resolves.toMatchObject({
      title: '测试用户 关注了你',
      content: '测试用户 关注了你',
      templateId: 11,
      usedTemplate: true,
    })
    await service.renderNotificationTemplate(input)

    expect(mocks.findNotificationTemplate).toHaveBeenCalledTimes(2)
  })
})
