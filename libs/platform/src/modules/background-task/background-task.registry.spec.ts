import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { BackgroundTaskRegistry } from './background-task.registry'

describe('BackgroundTaskRegistry', () => {
  it('rejects duplicate task type registration deterministically', () => {
    const registry = new BackgroundTaskRegistry()
    const handler = {
      taskType: 'content.third-party-comic-import',
      prepare: jest.fn(),
      finalize: jest.fn(),
      rollback: jest.fn(),
    }

    registry.register(handler)

    expect(() => registry.register(handler)).toThrow(BusinessException)
    expect(() => registry.register(handler)).toThrow('后台任务处理器已存在')
  })

  it('rejects unknown task type resolution with shared business code', () => {
    const registry = new BackgroundTaskRegistry()

    try {
      registry.resolve('unknown.task')
      throw new Error('resolve should have failed')
    } catch (error) {
      expect(error).toBeInstanceOf(BusinessException)
      expect((error as BusinessException).code).toBe(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
      )
    }
  })
})
