import { Module } from '@nestjs/common'
import { WorkAuthorController } from './author.controller'
import { WorkAuthorService } from './author.service'
import { WorkAuthorRoleTypeController } from './role-type.controller'
import { WorkAuthorRoleTypeService } from './role-type.service'

/**
 * 作者管理模块
 * 提供作者相关的功能模块
 */
@Module({
  controllers: [WorkAuthorController, WorkAuthorRoleTypeController],
  providers: [WorkAuthorService, WorkAuthorRoleTypeService],
  exports: [WorkAuthorService, WorkAuthorRoleTypeService], // 导出服务供其他模块使用
})
export class WorkAuthorModule {}
