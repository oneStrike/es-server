import { getCanonicalNotificationTemplateContract } from './notification-template-contract'
import { MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM } from './notification.constant'

describe('getCanonicalNotificationTemplateContract', () => {
  it('uses actor/data placeholders for topic templates', () => {
    expect(
      getCanonicalNotificationTemplateContract(
        MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.TOPIC_LIKE,
      ),
    ).toEqual({
      titleTemplate: '{{actor.nickname}} 点赞了你的主题',
      contentTemplate: '{{data.object.title}}',
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
