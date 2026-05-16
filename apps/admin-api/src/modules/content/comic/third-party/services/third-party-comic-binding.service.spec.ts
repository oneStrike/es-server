const {
  ThirdPartyComicBindingService,
} = require('./third-party-comic-binding.service')

describe('ThirdPartyComicBindingService', () => {
  const sourceBindingTable = {
    deletedAt: 'sourceDeletedAt',
    id: 'sourceId',
    platform: 'platform',
    providerComicId: 'providerComicId',
    providerGroupPathWord: 'providerGroupPathWord',
    workId: 'workId',
  }
  const chapterBindingTable = {
    chapterId: 'chapterId',
    deletedAt: 'chapterDeletedAt',
    id: 'chapterBindingId',
    providerChapterId: 'providerChapterId',
    workThirdPartySourceBindingId: 'sourceBindingId',
  }
  const sourceInput = {
    platform: ' copy ',
    providerComicId: ' woduzishenji ',
    providerGroupPathWord: ' default ',
    providerPathWord: ' woduzishenji ',
    sourceSnapshot: { providerComicId: 'woduzishenji' },
    workId: 100,
  }
  const chapterInput = {
    chapterId: 300,
    providerChapterId: ' chapter-001 ',
    remoteSortOrder: 1,
    snapshot: { title: '第1话' },
    workThirdPartySourceBindingId: 10,
  }

  function createLimitSelect(rows: unknown[]) {
    const limit = jest.fn(async () => rows)
    const where = jest.fn(() => ({ limit }))
    const from = jest.fn(() => ({ where }))
    return { from, limit, where }
  }

  function createInsert(returnRows: unknown[] = [{ id: 10 }]) {
    const returning = jest.fn(async () => returnRows)
    const values = jest.fn(() => ({ returning }))
    return { returning, values }
  }

  function createUpdate() {
    const where = jest.fn(async () => undefined)
    const set = jest.fn(() => ({ where }))
    return { set, where }
  }

  function createService(options: { selectRows?: unknown[][] } = {}) {
    const selects = (options.selectRows ?? []).map((rows) =>
      createLimitSelect(rows),
    )
    const insert = createInsert()
    const update = createUpdate()
    const db = {
      insert: jest.fn(() => insert),
      select: jest.fn(() => selects.shift() ?? createLimitSelect([])),
      update: jest.fn(() => update),
    }
    const drizzle = {
      db,
      schema: {
        workThirdPartyChapterBinding: chapterBindingTable,
        workThirdPartySourceBinding: sourceBindingTable,
      },
      withErrorHandling: jest.fn(async (callback) => callback()),
    }

    return {
      db,
      insert,
      service: new ThirdPartyComicBindingService(drizzle as never),
      update,
    }
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('reuses an active same-scope source binding for the same work', async () => {
    const localBinding = {
      id: 10,
      platform: 'copy',
      providerComicId: 'woduzishenji',
      providerGroupPathWord: 'default',
      workId: 100,
    }
    const { db, service } = createService({
      selectRows: [[localBinding], []],
    })

    await expect(
      service.createOrGetSourceBinding(sourceInput),
    ).resolves.toEqual({ created: false, id: 10 })
    expect(db.insert).not.toHaveBeenCalled()
  })

  it('rejects a work that already has another active source binding', async () => {
    const { db, service } = createService({
      selectRows: [
        [
          {
            id: 11,
            platform: 'copy',
            providerComicId: 'other-comic',
            providerGroupPathWord: 'default',
            workId: 100,
          },
        ],
        [],
      ],
    })

    await expect(service.createOrGetSourceBinding(sourceInput)).rejects.toThrow(
      '作品已绑定其他三方来源',
    )
    expect(db.insert).not.toHaveBeenCalled()
  })

  it('rejects a remote source scope already bound to another work', async () => {
    const { db, service } = createService({
      selectRows: [
        [],
        [
          {
            id: 12,
            platform: 'copy',
            providerComicId: 'woduzishenji',
            providerGroupPathWord: 'default',
            workId: 200,
          },
        ],
      ],
    })

    await expect(service.createOrGetSourceBinding(sourceInput)).rejects.toThrow(
      '三方来源已绑定其他作品',
    )
    expect(db.insert).not.toHaveBeenCalled()
  })

  it('creates a normalized source binding when no active binding exists', async () => {
    const { insert, service } = createService({ selectRows: [[], []] })

    await expect(
      service.createOrGetSourceBinding(sourceInput),
    ).resolves.toEqual({ created: true, id: 10 })
    expect(insert.values).toHaveBeenCalledWith(
      expect.objectContaining({
        platform: 'copy',
        providerComicId: 'woduzishenji',
        providerGroupPathWord: 'default',
        providerPathWord: 'woduzishenji',
      }),
    )
  })

  it('reuses an active same provider chapter binding', async () => {
    const { db, service } = createService({
      selectRows: [[{ chapterId: 300, id: 20 }], []],
    })

    await expect(
      service.createOrGetChapterBinding(chapterInput),
    ).resolves.toEqual({ created: false, id: 20 })
    expect(db.insert).not.toHaveBeenCalled()
  })

  it('rejects a provider chapter already bound to another local chapter', async () => {
    const { db, service } = createService({
      selectRows: [[{ chapterId: 301, id: 20 }], []],
    })

    await expect(
      service.createOrGetChapterBinding(chapterInput),
    ).rejects.toThrow('三方章节已绑定其他本地章节')
    expect(db.insert).not.toHaveBeenCalled()
  })

  it('rejects a local chapter already bound to another provider chapter', async () => {
    const { db, service } = createService({
      selectRows: [[], [{ chapterId: 300, id: 21 }]],
    })

    await expect(
      service.createOrGetChapterBinding(chapterInput),
    ).rejects.toThrow('本地章节已绑定其他三方章节')
    expect(db.insert).not.toHaveBeenCalled()
  })

  it('creates a normalized chapter binding when no active binding exists', async () => {
    const { insert, service } = createService({ selectRows: [[], []] })

    await expect(
      service.createOrGetChapterBinding(chapterInput),
    ).resolves.toEqual({ created: true, id: 10 })
    expect(insert.values).toHaveBeenCalledWith(
      expect.objectContaining({
        providerChapterId: 'chapter-001',
        remoteSortOrder: 1,
      }),
    )
  })

  it('soft-deletes active source and chapter bindings by unique ids', async () => {
    const { db, service, update } = createService()

    await service.softDeleteSourceBindings([])
    await service.softDeleteChapterBindings([])
    expect(db.update).not.toHaveBeenCalled()

    await service.softDeleteSourceBindings([10, 10, 11])
    await service.softDeleteChapterBindings([20, 20, 21])

    expect(db.update).toHaveBeenCalledTimes(2)
    expect(update.set).toHaveBeenCalledWith({ deletedAt: expect.any(Date) })
  })
})
