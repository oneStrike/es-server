import { Module } from '@nestjs/common'
import { SensitiveWordModule } from './sensitive-word/sensitive-word.module'

@Module({
  imports: [SensitiveWordModule],
})
export class ForumManagementModule {}
