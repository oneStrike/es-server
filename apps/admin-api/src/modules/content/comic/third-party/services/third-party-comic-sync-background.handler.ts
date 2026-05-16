import type { BackgroundTaskHandler } from '@libs/platform/modules/background-task/types'
import type {
  ThirdPartyComicSyncTaskContext,
  ThirdPartyComicSyncTaskPayload,
  ThirdPartyComicSyncTaskResult,
} from '../third-party-comic-sync.type'
import { BackgroundTaskRegistry } from '@libs/platform/modules/background-task/background-task.registry'
import { Injectable, OnModuleInit } from '@nestjs/common'
import { THIRD_PARTY_COMIC_SYNC_TASK_TYPE } from '../third-party-comic-sync.constant'
import { ThirdPartyComicSyncService } from './third-party-comic-sync.service'

/**
 * 第三方漫画最新章节同步后台任务处理器。
 */
@Injectable()
export class ThirdPartyComicSyncBackgroundHandler
  implements
    OnModuleInit,
    BackgroundTaskHandler<
      ThirdPartyComicSyncTaskPayload,
      ThirdPartyComicSyncTaskPayload,
      ThirdPartyComicSyncTaskResult
    >
{
  /** 第三方漫画最新章节同步任务类型。 */
  readonly taskType = THIRD_PARTY_COMIC_SYNC_TASK_TYPE

  // 初始化三方漫画同步后台处理器依赖。
  constructor(
    private readonly registry: BackgroundTaskRegistry,
    private readonly syncService: ThirdPartyComicSyncService,
  ) {}

  // 注册后台任务处理器。
  onModuleInit() {
    this.registry.register(this)
  }

  // 准备第三方漫画同步任务。
  async prepare(context: ThirdPartyComicSyncTaskContext) {
    await context.updateProgress({
      percent: 1,
      message: '第三方漫画最新章节同步任务已开始',
    })
    return context.payload
  }

  // 执行最终同步写入。
  async finalize(
    context: ThirdPartyComicSyncTaskContext,
    prepared: ThirdPartyComicSyncTaskPayload,
  ) {
    return this.syncService.executeSyncTask(prepared, context)
  }

  // 回滚失败或取消的同步任务。
  async rollback(context: ThirdPartyComicSyncTaskContext) {
    await this.syncService.rollbackSyncTask(context)
  }
}
