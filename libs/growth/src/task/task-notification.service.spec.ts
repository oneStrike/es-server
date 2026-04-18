import { TaskNotificationService } from './task-notification.service'
import { TaskTypeEnum } from './task.constant'

describe('task notification service', () => {
  it('builds task reminder payload using the new data contract', () => {
    const service = new TaskNotificationService()

    const event = service.createRewardGrantedReminderEvent({
      bizKey: 'task:reminder:reward:assignment:10',
      receiverUserId: 7,
      assignmentId: 10,
      task: {
        id: 5,
        code: 'daily-comment',
        title: '每日评论',
        type: TaskTypeEnum.DAILY,
      },
      rewardItems: [
        {
          assetType: 1,
          amount: 5,
        } as never,
      ],
      ledgerRecordIds: [101],
    })

    expect(event.eventKey).toBe('task.reminder.reward_granted')
    expect(event.context?.payload).toEqual({
      object: {
        kind: 'task',
        id: 5,
        code: 'daily-comment',
        title: '每日评论',
        sceneType: TaskTypeEnum.DAILY,
      },
      reminder: {
        kind: 'reward_granted',
        assignmentId: 10,
        cycleKey: undefined,
        expiredAt: undefined,
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

  it('builds auto assigned reminder payload without legacy root keys', () => {
    const service = new TaskNotificationService()

    const event = service.createAutoAssignedReminderEvent({
      bizKey: 'task:reminder:auto-assigned:assignment:10',
      receiverUserId: 7,
      assignmentId: 10,
      cycleKey: '2026-04-18',
      task: {
        id: 5,
        code: 'daily-comment',
        title: '每日评论',
        type: TaskTypeEnum.DAILY,
      },
    })

    expect(event.context?.payload).toEqual({
      object: {
        kind: 'task',
        id: 5,
        code: 'daily-comment',
        title: '每日评论',
        sceneType: TaskTypeEnum.DAILY,
      },
      reminder: {
        kind: 'auto_assigned',
        assignmentId: 10,
        cycleKey: '2026-04-18',
        expiredAt: undefined,
      },
      reward: undefined,
    })
    expect(event.context?.payload).not.toHaveProperty('taskId')
    expect(event.context?.payload).not.toHaveProperty('assignmentId')
    expect(event.context?.payload).not.toHaveProperty('reminderKind')
  })
})
