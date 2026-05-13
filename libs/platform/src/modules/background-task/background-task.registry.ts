import type { BackgroundTaskHandler, BackgroundTaskObject } from './types'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { Injectable } from '@nestjs/common'

/**
 * 后台任务处理器注册表。
 * 只维护 taskType 到处理器的映射，不依赖任何业务模块。
 */
@Injectable()
export class BackgroundTaskRegistry {
  private readonly handlers = new Map<string, unknown>()

  // 注册后台任务处理器。
  /* eslint-disable antfu/consistent-list-newline -- Prettier keeps the generic handler parameter single-line; keep typed without any. */
  register<
    TPayload extends BackgroundTaskObject,
    TPrepared,
    TResult extends BackgroundTaskObject,
    TResidue extends BackgroundTaskObject,
  >(handler: BackgroundTaskHandler<TPayload, TPrepared, TResult, TResidue>) {
    if (this.handlers.has(handler.taskType)) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        `后台任务处理器已存在: ${handler.taskType}`,
      )
    }

    this.handlers.set(handler.taskType, handler)
  }
  /* eslint-enable antfu/consistent-list-newline */

  // 判断任务类型是否已注册。
  has(taskType: string) {
    return this.handlers.has(taskType)
  }

  // 解析任务处理器，不存在时按业务异常返回。
  resolve<
    TPayload extends BackgroundTaskObject = BackgroundTaskObject,
    TPrepared = unknown,
    TResult extends BackgroundTaskObject = BackgroundTaskObject,
    TResidue extends BackgroundTaskObject = BackgroundTaskObject,
  >(
    taskType: string,
  ): BackgroundTaskHandler<TPayload, TPrepared, TResult, TResidue> {
    const handler = this.handlers.get(taskType)
    if (!handler) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        `后台任务处理器不存在: ${taskType}`,
      )
    }
    return handler as BackgroundTaskHandler<
      TPayload,
      TPrepared,
      TResult,
      TResidue
    >
  }

  // 返回已注册任务类型列表。
  listTaskTypes() {
    return [...this.handlers.keys()]
  }
}
