import * as schema from '@db/schema'
import { TaskExecutionService } from '../task-execution.service'

describe('task reminder dedupe', () => {
  function createService() {
    const publish = jest.fn().mockResolvedValue({
      duplicated: true,
      event: {
        id: 11n,
      },
      dispatches: [],
    })
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

  it('命中稳定幂等键时会依赖发布器去重并返回 false', async () => {
    const { service, publish } = createService()

    const published = await (service as any).publishTaskReminderIfNeeded({
      eventKey: 'task.reminder.auto_assigned',
      subjectType: 'user',
      subjectId: 7,
      targetType: 'task',
      targetId: 1,
      context: {
        projectionKey: 'task:reminder:auto-assigned:assignment:88',
      },
    })

    expect(publish).toHaveBeenCalledWith({
      eventKey: 'task.reminder.auto_assigned',
      subjectType: 'user',
      subjectId: 7,
      targetType: 'task',
      targetId: 1,
      context: {
        projectionKey: 'task:reminder:auto-assigned:assignment:88',
      },
    })
    expect(published).toBe(false)
  })
})
