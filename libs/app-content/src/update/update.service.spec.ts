jest.mock('@db/core', () => ({
  buildILikeCondition: jest.fn((_column: unknown, value?: string) =>
    value ? { type: 'ilike', value } : undefined,
  ),
  DrizzleService: class {},
}))

describe('app update service', () => {
  it('creates a release without persisting app store fields', async () => {
    const { AppUpdateService } = await import('./update.service')

    const releaseTable = { id: 'id' }
    const insertValuesMock = jest.fn().mockResolvedValue(undefined)
    const tx = {
      insert: jest.fn((table) => {
        if (table === releaseTable) {
          return {
            values: jest.fn((values) => {
              insertValuesMock(values)
              return {
                returning: jest.fn().mockResolvedValue([{ id: 1 }]),
              }
            }),
          }
        }

        return {
          values: jest.fn().mockResolvedValue(undefined),
        }
      }),
    }

    const service = new AppUpdateService({
      db: { query: {} },
      schema: {
        appUpdateRelease: releaseTable,
      },
      withErrorHandling: jest.fn(async (callback) => callback()),
      withTransaction: jest.fn(async (callback) => callback(tx)),
    } as any)

    await expect(
      service.create(
        {
          platform: 2,
          versionName: '1.2.0',
          buildCode: 120,
          forceUpdate: false,
          packageSourceType: 2,
          packageUrl: 'https://example.com/app-release.apk',
        } as any,
        9,
      ),
    ).resolves.toBe(true)

    expect(insertValuesMock).toHaveBeenCalledWith(
      expect.not.objectContaining({
        storeLinks: expect.anything(),
      }),
    )
  })

  it('rejects updating a published release in place', async () => {
    const { AppUpdateService } = await import('./update.service')

    const service = new AppUpdateService({
      db: {
        query: {
          appUpdateRelease: {
            findFirst: jest.fn().mockResolvedValue({
              id: 1,
              platform: 1,
              isPublished: true,
            }),
          },
        },
      },
      schema: {
        appUpdateRelease: { id: 'id' },
      },
      withErrorHandling: jest.fn(async (callback) => callback()),
      withTransaction: jest.fn(async (callback) => callback({})),
    } as any)

    await expect(
      service.update(
        {
          id: 1,
          platform: 1,
          versionName: '1.2.0',
          buildCode: 120,
          forceUpdate: false,
        } as any,
        9,
      ),
    ).rejects.toMatchObject({
      message: '已发布版本不允许直接修改，请基于草稿继续维护',
    })
  })

  it('persists popup background fields when creating a release', async () => {
    const { AppUpdateService } = await import('./update.service')

    const releaseTable = { id: 'id' }
    const insertValuesMock = jest.fn().mockResolvedValue(undefined)
    const tx = {
      insert: jest.fn(() => ({
        values: insertValuesMock,
      })),
    }

    const service = new AppUpdateService({
      db: { query: {} },
      schema: {
        appUpdateRelease: releaseTable,
      },
      withErrorHandling: jest.fn(async (callback) => callback()),
      withTransaction: jest.fn(async (callback) => callback(tx)),
    } as any)

    await service.create(
      {
        platform: 2,
        versionName: '1.2.0',
        buildCode: 120,
        forceUpdate: false,
        packageSourceType: 2,
        packageUrl: 'https://example.com/app-release.apk',
        popupBackgroundImage: 'https://cdn.example.com/app-update/bg.png',
        popupBackgroundPosition: 'top center',
      } as any,
      9,
    )

    expect(insertValuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        popupBackgroundImage: 'https://cdn.example.com/app-update/bg.png',
        popupBackgroundPosition: 'top center',
      }),
    )
  })

  it('publishing a draft unpublishes the previous release on the same platform', async () => {
    const { AppUpdateService } = await import('./update.service')

    const targetRelease = {
      id: 8,
      platform: 2,
      isPublished: false,
      packageUrl: 'https://example.com/release.apk',
    }

    const txWhereMock = jest.fn().mockResolvedValue({ rowCount: 1 })
    const txSetMock = jest.fn(() => ({
      where: txWhereMock,
    }))
    const tx = {
      update: jest.fn(() => ({
        set: txSetMock,
      })),
    }

    const service = new AppUpdateService({
      db: {
        query: {
          appUpdateRelease: {
            findFirst: jest.fn().mockResolvedValue(targetRelease),
          },
        },
      },
      schema: {
        appUpdateRelease: {
          id: 'id',
          platform: 'platform',
          isPublished: 'isPublished',
        },
      },
      withErrorHandling: jest.fn(async (callback) => callback()),
      withTransaction: jest.fn(async (callback) => callback(tx)),
      assertAffectedRows: jest.fn(),
    } as any)

    await expect(
      service.updatePublishStatus({ id: 8, isPublished: true }, 5),
    ).resolves.toBe(true)

    expect(tx.update).toHaveBeenCalledTimes(2)
    expect((txSetMock.mock.calls as any)[0][0]).toEqual({
      isPublished: false,
      updatedById: 5,
    })
    expect((txSetMock.mock.calls as any)[1][0]).toEqual(
      expect.objectContaining({
        isPublished: true,
        updatedById: 5,
      }),
    )
    expect((txSetMock.mock.calls as any)[1][0].publishedAt).toBeInstanceOf(Date)
  })

  it('returns release detail without app store fields', async () => {
    const { AppUpdateService } = await import('./update.service')

    const service = new AppUpdateService({
      db: {
        query: {
          appUpdateRelease: {
            findFirst: jest.fn().mockResolvedValue({
              id: 3,
              platform: 2,
              versionName: '1.2.0',
              buildCode: 120,
              releaseNotes: '修复已知问题',
              forceUpdate: false,
              packageUrl: 'https://example.com/app-release.apk',
              popupBackgroundImage:
                'https://cdn.example.com/app-update/detail-bg.png',
              popupBackgroundPosition: 'top center',
              isPublished: false,
              publishedAt: null,
              createdAt: new Date('2026-04-12T10:30:00.000Z'),
              updatedAt: new Date('2026-04-12T10:30:00.000Z'),
            }),
          },
        },
      },
      schema: {
        appUpdateRelease: { id: 'id' },
      },
      withErrorHandling: jest.fn(async (callback) => callback()),
      withTransaction: jest.fn(async (callback) => callback({})),
    } as any)

    await expect(service.findDetail({ id: 3 })).resolves.toEqual(
      expect.objectContaining({
        id: 3,
        popupBackgroundImage:
          'https://cdn.example.com/app-update/detail-bg.png',
        popupBackgroundPosition: 'top center',
      }),
    )

    const detail = await service.findDetail({ id: 3 })
    expect(detail).not.toHaveProperty('storeLinks')
    expect(detail).not.toHaveProperty('customDownloadUrl')
  })

  it('returns update info without app store payload and does not require version name', async () => {
    const { AppUpdateService } = await import('./update.service')

    const service = new AppUpdateService({
      db: {
        query: {
          appUpdateRelease: {
            findFirst: jest.fn().mockResolvedValue({
              id: 3,
              platform: 2,
              versionName: '1.2.0',
              buildCode: 120,
              releaseNotes: '修复已知问题',
              forceUpdate: true,
              packageUrl: 'https://example.com/app-release.apk',
              popupBackgroundImage:
                'https://cdn.example.com/app-update/check-bg.png',
              popupBackgroundPosition: 'bottom center',
            }),
          },
        },
      },
      schema: {
        appUpdateRelease: { id: 'id' },
      },
      withErrorHandling: jest.fn(async (callback) => callback()),
      withTransaction: jest.fn(async (callback) => callback({})),
    } as any)

    const result = await service.checkUpdate({
      platform: 2,
      buildCode: 100,
    } as any)

    expect(result).toEqual(
      expect.objectContaining({
        hasUpdate: true,
        updateType: 'force',
        latestVersionName: '1.2.0',
        latestBuildCode: 120,
        packageUrl: 'https://example.com/app-release.apk',
        popupBackgroundImage: 'https://cdn.example.com/app-update/check-bg.png',
        popupBackgroundPosition: 'bottom center',
      }),
    )
    expect(result).not.toHaveProperty('customDownloadUrl')
  })

  it('allows custom package source to reuse packageUrl', async () => {
    const { AppUpdateService } = await import('./update.service')

    const releaseTable = { id: 'id' }
    const insertValuesMock = jest.fn().mockResolvedValue(undefined)
    const tx = {
      insert: jest.fn(() => ({
        values: insertValuesMock,
      })),
    }

    const service = new AppUpdateService({
      db: { query: {} },
      schema: {
        appUpdateRelease: releaseTable,
      },
      withErrorHandling: jest.fn(async (callback) => callback()),
      withTransaction: jest.fn(async (callback) => callback(tx)),
    } as any)

    await expect(
      service.create(
        {
          platform: 2,
          versionName: '1.3.0',
          buildCode: 130,
          forceUpdate: false,
          packageSourceType: 3,
          packageUrl: 'https://download.example.com/landing-page',
        } as any,
        9,
      ),
    ).resolves.toBe(true)

    expect(insertValuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        packageSourceType: 3,
        packageUrl: 'https://download.example.com/landing-page',
      }),
    )
  })

  it('returns no update when build code is already latest', async () => {
    const { AppUpdateService } = await import('./update.service')

    const service = new AppUpdateService({
      db: {
        query: {
          appUpdateRelease: {
            findFirst: jest.fn().mockResolvedValue({
              id: 4,
              platform: 1,
              versionName: '2.0.0',
              buildCode: 200,
              releaseNotes: '新版本',
              forceUpdate: false,
            }),
          },
        },
      },
      schema: {
        appUpdateRelease: { id: 'id' },
      },
      withErrorHandling: jest.fn(async (callback) => callback()),
      withTransaction: jest.fn(async (callback) => callback({})),
    } as any)

    await expect(
      service.checkUpdate({
        platform: 1,
        buildCode: 200,
      } as any),
    ).resolves.toEqual({ hasUpdate: false })
  })
})
