import type { BackgroundTaskRetryValidationContext } from '@libs/platform/modules/background-task/types'
import type { ThirdPartyComicImportTaskPayload } from '../third-party-comic-import.type'
import { ThirdPartyComicImportModeEnum } from '@libs/content/work/content/dto/content.dto'
import { THIRD_PARTY_COMIC_IMPORT_TASK_TYPE } from '../third-party-comic-import.constant'

jest.mock('./third-party-comic-import.service', () => ({
  ThirdPartyComicImportService: class ThirdPartyComicImportService {},
}))

const {
  ThirdPartyComicImportBackgroundHandler,
} = require('./third-party-comic-import-background.handler')

describe('ThirdPartyComicImportBackgroundHandler', () => {
  function createHandler() {
    const registry = {
      register: jest.fn(),
    }
    const importService = {
      executeImportTask: jest.fn(),
      rollbackImportTask: jest.fn(),
      validateRetryReservationSnapshot: jest.fn(async () => undefined),
    }

    return {
      handler: new ThirdPartyComicImportBackgroundHandler(
        registry as never,
        importService as never,
      ),
      importService,
      registry,
    }
  }

  function createRetryContext(
    overrides: Partial<
      BackgroundTaskRetryValidationContext<ThirdPartyComicImportTaskPayload>
    > = {},
  ): BackgroundTaskRetryValidationContext<ThirdPartyComicImportTaskPayload> {
    return {
      conflictKeys: ['source-comic:copy:woduzishenji'],
      dedupeKey: 'source-comic:copy:woduzishenji',
      payload: {
        chapters: [],
        comicId: 'woduzishenji',
        mode: ThirdPartyComicImportModeEnum.CREATE_NEW,
        platform: 'copy',
        sourceSnapshot: {
          fetchedAt: '2026-05-11T00:00:00.000Z',
          providerComicId: 'woduzishenji',
          providerGroupPathWord: 'default',
          providerPathWord: 'woduzishenji',
        },
      },
      residue: {},
      retryCount: 0,
      serialKey: 'platform:copy',
      status: 5,
      taskId: 'task-001',
      taskType: THIRD_PARTY_COMIC_IMPORT_TASK_TYPE,
      ...overrides,
    }
  }

  it('registers itself on module init', () => {
    const { handler, registry } = createHandler()

    handler.onModuleInit()

    expect(registry.register).toHaveBeenCalledWith(handler)
  })

  it('accepts retry when reservation snapshot is complete', async () => {
    const { handler } = createHandler()
    const context = createRetryContext()

    await expect(handler.validateRetry(context)).resolves.toBeUndefined()
  })

  it.each([
    ['dedupeKey', { dedupeKey: null }],
    ['serialKey', { serialKey: null }],
    ['conflictKeys', { conflictKeys: [] }],
  ])('passes retry snapshot fields to import service when %s changes', async (
    _label,
    override,
  ) => {
    const { handler, importService } = createHandler()
    const context = createRetryContext(override)

    await handler.validateRetry(context)

    expect(importService.validateRetryReservationSnapshot).toHaveBeenCalledWith(
      context.payload,
      {
        conflictKeys: context.conflictKeys,
        dedupeKey: context.dedupeKey,
        serialKey: context.serialKey,
      },
    )
  })
})
