import 'reflect-metadata'
import { MODULE_METADATA } from '@nestjs/common/constants'
import { InteractionSummaryModule } from '@libs/interaction/summary/interaction-summary.module'
import { ForumTopicModule } from './forum-topic.module'

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid'),
}))

describe('ForumTopicModule dependencies', () => {
  it('imports interaction summary module for auditor summaries', () => {
    const imports = Reflect.getMetadata(
      MODULE_METADATA.IMPORTS,
      ForumTopicModule,
    ) as unknown[]

    expect(imports).toContain(InteractionSummaryModule)
  })
})
