import { TaskTypeEnum } from '../task.constant'

describe('task notification service', () => {
  it('builds reward reminder payload with the stable task notification contract', async () => {
    const { TaskNotificationService } = await import('../task-notification.service')

    const service = new TaskNotificationService()
    const event = service.createRewardGrantedReminderEvent({
      bizKey: 'task:reminder:reward:assignment:18',
      receiverUserId: 9,
      task: {
        id: 7,
        code: 'complete_profile',
        title: '完善资料',
        type: TaskTypeEnum.DAILY,
      },
      assignmentId: 18,
      points: 10,
      experience: 5,
      ledgerRecordIds: [101, 102],
    })

    expect(event).toEqual(
      expect.objectContaining({
        bizKey: 'task:reminder:reward:assignment:18',
        payload: expect.objectContaining({
          receiverUserId: 9,
          payload: expect.objectContaining({
            payloadVersion: 1,
            reminderKind: 'task_reward_granted',
            taskId: 7,
            taskCode: 'complete_profile',
            title: '完善资料',
            sceneType: TaskTypeEnum.DAILY,
            actionUrl: '/task/my',
            rewardSummary: {
              points: 10,
              experience: 5,
              ledgerRecordIds: [101, 102],
            },
          }),
        }),
      }),
    )
  })
})
