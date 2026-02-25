import { Injectable } from '@nestjs/common'
import { InteractionTargetType } from '../../interaction.constant'
import { BaseTargetValidator } from './base.validator'

@Injectable()
export class ForumTopicValidator extends BaseTargetValidator {
  readonly targetType = InteractionTargetType.FORUM_TOPIC
  protected readonly modelName = 'forumTopic'

  protected getTargetName(): string {
    return '论坛主题'
  }
}
