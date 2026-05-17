import { ContentImportModule } from '@libs/content/work/content-import/content-import.module'
import { WorkflowModule } from '@libs/platform/modules/workflow/workflow.module'
import { Module } from '@nestjs/common'
import { AdminWorkflowController } from './workflow.controller'

@Module({
  imports: [WorkflowModule, ContentImportModule],
  controllers: [AdminWorkflowController],
})
export class AdminWorkflowModule {}
