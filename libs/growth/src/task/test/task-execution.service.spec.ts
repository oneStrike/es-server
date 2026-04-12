import * as schema from '@db/schema'
import { BadRequestException } from '@nestjs/common'
import { TaskExecutionService } from '../task-execution.service'

describe('task execution service', () => {
  function createService() {
    return new TaskExecutionService(
      {
        db: {},
        schema,
      } as any,
      {} as any,
      {} as any,
    )
  }

  it('会拒绝非正整数进度增量', async () => {
    const service = createService()
    const findAvailableTaskSpy = jest.spyOn(service as any, 'findAvailableTask')

    await expect(
      service.reportProgress({ taskId: 1, delta: 1.5 }, 9),
    ).rejects.toThrow(
      new BadRequestException('进度增量必须是大于0的整数'),
    )

    expect(findAvailableTaskSpy).not.toHaveBeenCalled()
  })

  it('会拒绝 0 和负数进度增量', async () => {
    const service = createService()
    const findAvailableTaskSpy = jest.spyOn(service as any, 'findAvailableTask')

    await expect(
      service.reportProgress({ taskId: 1, delta: 0 }, 9),
    ).rejects.toThrow(
      new BadRequestException('进度增量必须是大于0的整数'),
    )
    await expect(
      service.reportProgress({ taskId: 1, delta: -1 }, 9),
    ).rejects.toThrow(
      new BadRequestException('进度增量必须是大于0的整数'),
    )

    expect(findAvailableTaskSpy).not.toHaveBeenCalled()
  })

  it('允许合法正整数继续进入后续执行链路', async () => {
    const service = createService()
    const sentinelError = new Error('find-available-task-called')

    jest
      .spyOn(service as any, 'findAvailableTask')
      .mockRejectedValue(sentinelError)

    await expect(
      service.reportProgress({ taskId: 1, delta: 1 }, 9),
    ).rejects.toBe(sentinelError)
  })
})
