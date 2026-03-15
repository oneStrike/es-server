import type { PrismaTransactionClientType } from '@libs/platform/database'
import {
  BrowseLogService,
  BrowseLogTargetTypeEnum,
  IBrowseLogTargetResolver,
} from '@libs/interaction'
import { PlatformService } from '@libs/platform/database'
import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common'

/**
 * 论坛帖子浏览日志解析器
 * 处理论坛帖子的浏览记录相关操作
 */
@Injectable()
export class ForumTopicBrowseLogResolver
  extends PlatformService
  implements IBrowseLogTargetResolver, OnModuleInit
{
  /** 目标类型：论坛帖子 */
  readonly targetType = BrowseLogTargetTypeEnum.FORUM_TOPIC

  constructor(private readonly browseLogService: BrowseLogService) {
    super()
  }

  /**
   * 模块初始化时注册解析器
   */
  onModuleInit() {
    this.browseLogService.registerResolver(this)
  }

  /**
   * 应用浏览计数增量
   * 更新帖子的浏览数
   *
   * @param tx - Prisma 事务客户端
   * @param targetId - 目标帖子ID
   * @param delta - 变更量
   */
  applyCountDelta: (
    tx: PrismaTransactionClientType,
    targetId: number,
    delta: number,
  ) => Promise<void> = async (tx, targetId, delta) => {
    if (delta === 0) {
      return
    }

    await tx.forumTopic.applyCountDelta(
      {
        id: targetId,
        deletedAt: null,
      },
      'viewCount',
      delta,
    )
  }

  /**
   * 校验帖子是否有效
   *
   * @param tx - Prisma 事务客户端
   * @param targetId - 目标帖子ID
   * @throws 当帖子不存在时抛出 BadRequestException
   */
  ensureTargetValid: (
    tx: PrismaTransactionClientType,
    targetId: number,
  ) => Promise<void> = async (tx, targetId) => {
    const topic = await tx.forumTopic.findUnique({
      where: { id: targetId },
      select: { deletedAt: true },
    })

    if (!topic || topic.deletedAt !== null) {
      throw new BadRequestException('帖子不存在')
    }
  }
}
