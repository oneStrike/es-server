import { SensitiveWordModule } from '@libs/sensitive-word'
import { SystemConfigModule } from '@libs/system-config'
import { Module } from '@nestjs/common'
import { CounterModule } from '../counter/counter.module'
import { CommentService } from './comment.service'

@Module({
  imports: [CounterModule, SensitiveWordModule, SystemConfigModule],
  providers: [CommentService],
  exports: [CommentService],
})
export class CommentModule {}
