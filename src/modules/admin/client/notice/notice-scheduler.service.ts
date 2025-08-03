import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import * as cron from 'node-cron';
import { PrismaService } from '@/global/services/prisma.service';

/**
 * 公告定时任务服务
 * 负责处理公告的自动过期状态管理
 */
@Injectable()
export class NoticeSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NoticeSchedulerService.name);
  private scheduledTask: cron.ScheduledTask | null = null;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 模块初始化时启动定时任务
   */
  onModuleInit() {
    this.startScheduler();
  }

  /**
   * 模块销毁时停止定时任务
   */
  onModuleDestroy() {
    this.stopScheduler();
  }

  /**
   * 启动定时任务
   * 每天晚上12点执行过期公告检查
   */
  private startScheduler() {
    // 每天晚上12点执行 (0 0 * * *)
    this.scheduledTask = cron.schedule(
      '0 0 * * *',
      async () => {
        await this.checkAndUpdateExpiredNotices();
      },
      {
        timezone: 'Asia/Shanghai',
      }
    );

    // 启动定时任务
    void this.scheduledTask.start();

    this.logger.log('公告自动过期检查定时任务已启动，每天晚上12点执行');
  }

  /**
   * 停止定时任务
   */
  private stopScheduler() {
    if (this.scheduledTask) {
      void this.scheduledTask.stop();
      this.scheduledTask = null;
      this.logger.log('公告自动过期检查定时任务已停止');
    }
  }

  /**
   * 检查并更新过期的公告状态
   */
  private async checkAndUpdateExpiredNotices() {
    try {
      const now = new Date();

      // 查找已发布但已过期的公告
      const expiredNotices = await this.prisma.clientNotice.findMany({
        where: {
          isPublished: true,
          publishEndTime: {
            not: null,
            lt: now, // 结束时间小于当前时间
          },
          deletedAt: null, // 未被软删除
        },
        select: {
          id: true,
          title: true,
          publishEndTime: true,
        },
      });

      if (expiredNotices.length > 0) {
        // 批量更新过期公告的状态为未发布
        const updateResult = await this.prisma.clientNotice.updateMany({
          where: {
            id: {
              in: expiredNotices.map(notice => notice.id),
            },
          },
          data: {
            isPublished: false,
            updatedAt: now,
          },
        });

        this.logger.log(
          `成功将 ${updateResult.count} 个过期公告设置为未发布状态`,
          {
            expiredNotices: expiredNotices.map(notice => ({
              id: notice.id,
              title: notice.title,
              expiredAt: notice.publishEndTime,
            })),
          }
        );
      } else {
        this.logger.log('未发现过期的公告');
      }
    } catch (error) {
      this.logger.error('检查过期公告时发生错误', error);
    }
  }
}
