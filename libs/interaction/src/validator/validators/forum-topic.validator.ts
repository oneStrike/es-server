import { Injectable } from '@nestjs/common'
import { PrismaClient } from '@libs/base/database'
import { InteractionTargetType } from '../../interaction.constant'
import { BaseTargetValidator } from './base.validator'

/**
 * 论坛主题校验器
 */
@Injectable()
export class ForumTopicValidator extends BaseTargetValidator {
  readonly targetType = InteractionTargetType.FORUM_TOPIC
  protected readonly modelName = 'forumTopic'

  constructor(prisma: PrismaClient) {
    super(prisma)
  }

  protected getTargetName(): string {
    return '论坛主题'
  }
}
