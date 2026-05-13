import type {
  BackgroundTaskHandler,
  BackgroundTaskObject,
} from '@libs/platform/modules/background-task/types'
import type {
  ThirdPartyComicImportTaskContext,
  ThirdPartyComicImportTaskPayload,
} from '../third-party-comic-import.type'
import { BackgroundTaskRegistry } from '@libs/platform/modules/background-task/background-task.registry'
import { Injectable, OnModuleInit } from '@nestjs/common'
import { THIRD_PARTY_COMIC_IMPORT_TASK_TYPE } from '../third-party-comic-import.constant'
import { ThirdPartyComicImportService } from './third-party-comic-import.service'

/**
 * 第三方漫画导入后台任务处理器。
 * 将业务处理注册到通用后台任务模块，核心任务模块不反向依赖内容域。
 */
@Injectable()
export class ThirdPartyComicImportBackgroundHandler
  implements
    OnModuleInit,
    BackgroundTaskHandler<
      ThirdPartyComicImportTaskPayload,
      ThirdPartyComicImportTaskPayload,
      BackgroundTaskObject
    >
{
  /** 第三方漫画导入任务类型。 */
  readonly taskType = THIRD_PARTY_COMIC_IMPORT_TASK_TYPE

  // 初始化三方漫画导入后台处理器依赖。
  constructor(
    private readonly registry: BackgroundTaskRegistry,
    private readonly importService: ThirdPartyComicImportService,
  ) {}

  // 注册后台任务处理器。
  onModuleInit() {
    this.registry.register(this)
  }

  // 准备第三方漫画导入任务。
  async prepare(context: ThirdPartyComicImportTaskContext) {
    await context.updateProgress({
      percent: 1,
      message: '第三方漫画导入任务已开始',
    })
    return context.payload
  }

  // 执行最终导入写入。
  async finalize(
    context: ThirdPartyComicImportTaskContext,
    prepared: ThirdPartyComicImportTaskPayload,
  ) {
    return this.importService.executeImportTask(prepared, context)
  }

  // 回滚失败或取消的导入任务。
  async rollback(context: ThirdPartyComicImportTaskContext, error: unknown) {
    await this.importService.rollbackImportTask(context, error)
  }
}
