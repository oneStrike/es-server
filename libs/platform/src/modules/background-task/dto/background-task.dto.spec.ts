import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import {
  BackgroundTaskDto,
  BackgroundTaskIdDto,
  CreateBackgroundTaskDto,
} from './background-task.dto'

describe('BackgroundTask DTO validation ownership', () => {
  it('keeps request taskId validation enabled while output taskId is documentation only', async () => {
    const requestErrors = await validate(
      plainToInstance(BackgroundTaskIdDto, { taskId: 123 }),
    )
    const outputErrors = await validate(
      plainToInstance(BackgroundTaskDto, { taskId: 123 }),
      { forbidUnknownValues: false },
    )

    expect(requestErrors).toEqual([
      expect.objectContaining({ property: 'taskId' }),
    ])
    expect(outputErrors).toHaveLength(0)
  })

  it('keeps create task payload validation enabled', async () => {
    const errors = await validate(
      plainToInstance(CreateBackgroundTaskDto, {
        payload: 'not-object',
        taskType: 123,
      }),
    )

    expect(errors.map((error) => error.property).sort()).toEqual([
      'payload',
      'taskType',
    ])
  })
})
