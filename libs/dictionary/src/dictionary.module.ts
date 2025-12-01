import { Module } from '@nestjs/common'
import { DictionaryService } from './dictionary.service'

/**
 * 数据字典模块
 * 提供数据字典和字典项的管理功能
 */
@Module({
  controllers: [],
  providers: [DictionaryService],
  exports: [DictionaryService],
})
export class DictionaryModule {}
