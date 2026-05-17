import { Module } from '@nestjs/common'
import { ContentImportService } from './content-import.service'

@Module({
  providers: [ContentImportService],
  exports: [ContentImportService],
})
export class ContentImportModule {}
