import * as schema from '@db/schema'
import { TaskExecutionService } from '../task-execution.service'

describe('task reminder dedupe', () => {
  function createService() {
    const publish = jest.fn().mockResolvedValue(undefined)
    const service = new TaskExecutionService(
      {
        db: {},
        schema,
      } as never,
      {} as never,
      { publish } as never,
    )

    return {
      service,
      publish,
    }
  }

  it('命中已发布的 projectionKey 时不会重复发布自动分配提醒', async () => {
    const { service, publish } = createService()

    ;(service as any).queryPublishedTaskReminderProjectionKeys = jest
      .fn()
      .mockResolvedValue(new Set(['task:reminder:auto-assigned:assignment:88']))

    await (service as any).tryNotifyAutoAssignedTask(
      7,
      {
        id: 1,
        code: 'task-1',
        title: '任务 1',
        type: 1,
      },
      {
        id: 88,
      },
      '2026-04-13',
    )

    expect(
      (service as any).queryPublishedTaskReminderProjectionKeys,
    ).toHaveBeenCalledWith(['task:reminder:auto-assigned:assignment:88'])
    expect(publish).not.toHaveBeenCalled()
  })
})
