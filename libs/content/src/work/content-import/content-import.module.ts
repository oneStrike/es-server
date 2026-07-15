import { DrizzleModule } from '@db/core'
import { Module } from '@nestjs/common'
import { ContentImportService } from './content-import.service'

@Module({
  imports: [DrizzleModule],
  providers: [ContentImportService],
  exports: [ContentImportService],
})
export class ContentImportModule {}
