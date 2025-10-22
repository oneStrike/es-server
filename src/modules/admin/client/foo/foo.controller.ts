import { Controller, Post } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { Public } from '@/common/decorators/public.decorator'
import { FooService } from './foo.service'

@ApiTags('测试模块')
@Controller('admin/foo')
export class FooController {
  constructor(private readonly fooService: FooService) {}

  /**
   * 创建通知
   */
  @Post('/foo')
  @Public()
  async create() {
    return this.fooService.createNotice()
  }
}
