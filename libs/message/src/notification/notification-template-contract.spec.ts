import { MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM } from './notification.constant'
import { getCanonicalNotificationTemplateContract } from './notification-template-contract'

describe('getCanonicalNotificationTemplateContract', () => {
  it('migrates topic templates to payload.subject.title', () => {
    expect(
      getCanonicalNotificationTemplateContract(
        MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.TOPIC_LIKE,
      ),
    ).toEqual({
      titleTemplate: '{{payload.actorNickname}} 点赞了你的主题',
      contentTemplate: '{{payload.subject.title}}',
      remark: 'canonical notification template: 主题点赞',
    })
  })

  it('migrates announcement templates to root title/content placeholders', () => {
    expect(
      getCanonicalNotificationTemplateContract(
        MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.SYSTEM_ANNOUNCEMENT,
      ),
    ).toEqual({
      titleTemplate: '{{title}}',
      contentTemplate: '{{content}}',
      remark: 'canonical notification template: 系统公告',
    })
  })

  it('migrates task reminder templates to root title/content placeholders', () => {
    expect(
      getCanonicalNotificationTemplateContract(
        MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.TASK_REMINDER,
      ),
    ).toEqual({
      titleTemplate: '{{title}}',
      contentTemplate: '{{content}}',
      remark: 'canonical notification template: 任务提醒',
    })
  })
})
