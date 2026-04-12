jest.mock('@db/core', () => ({
  buildILikeCondition: jest.fn((_column: unknown, value?: string) =>
    value ? { type: 'ilike', value } : undefined,
  ),
  DrizzleService: class {},
}))

describe('app update service', () => {
  it('rejects updating a published release in place', async () => {
    const { AppUpdateService } = await import('./update.service')

    const service = new AppUpdateService({
      db: {
        query: {
          appUpdateRelease: {
            findFirst: jest.fn().mockResolvedValue({
              id: 1,
              platform: 'ios',
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
      service.update({
        id: 1,
        platform: 'ios',
        versionName: '1.2.0',
        buildCode: 120,
        forceUpdate: false,
        storeLinks: [],
      } as any,
      9),
    ).rejects.toMatchObject({
      message: '已发布版本不允许直接修改，请基于草稿继续维护',
    })
  })

  it('rejects duplicate channel codes after normalization', async () => {
    const { AppUpdateService } = await import('./update.service')

    const service = new AppUpdateService({
      db: {
        query: {
          appUpdateRelease: {
            findFirst: jest.fn().mockResolvedValue(null),
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
      service.create(
        {
          platform: 'android',
          versionName: '1.2.0',
          buildCode: 120,
          forceUpdate: false,
          packageSourceType: 'url',
          packageUrl: 'https://example.com/app-release.apk',
          storeLinks: [
            {
              channelCode: 'Huawei',
              channelName: '华为应用市场',
              storeUrl: 'https://example.com/huawei',
            },
            {
              channelCode: 'huawei',
              channelName: '华为备用',
              storeUrl: 'https://example.com/huawei-backup',
            },
          ],
        } as any,
        9,
      ),
    ).rejects.toMatchObject({
      message: '商店渠道编码不能重复',
    })
  })

  it('publishing a draft unpublishes the previous release on the same platform', async () => {
    const { AppUpdateService } = await import('./update.service')

    const targetRelease = {
      id: 8,
      platform: 'android',
      isPublished: false,
      packageUrl: 'https://example.com/release.apk',
      customDownloadUrl: null,
    }

    const txWhereMock = jest.fn().mockResolvedValue({ rowCount: 1 })
    const txSetMock = jest.fn(() => ({
      where: txWhereMock,
    }))
    const tx = {
      update: jest.fn(() => ({
        set: txSetMock,
      })),
      query: {
        appUpdateStoreLink: {
          findMany: jest.fn().mockResolvedValue([]),
        },
      },
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

  it('returns matched store link and full address set when client needs update', async () => {
    const { AppUpdateService } = await import('./update.service')

    const service = new AppUpdateService({
      db: {
        query: {
          appUpdateRelease: {
            findFirst: jest.fn().mockResolvedValue({
              id: 3,
              platform: 'android',
              versionName: '1.2.0',
              buildCode: 120,
              releaseNotes: '修复已知问题',
              forceUpdate: true,
              packageUrl: 'https://example.com/app-release.apk',
              customDownloadUrl: 'https://download.example.com/app',
              storeLinks: [
                {
                  channelCode: 'default',
                  channelName: '默认渠道',
                  storeUrl: 'https://example.com/default',
                },
                {
                  channelCode: 'huawei',
                  channelName: '华为应用市场',
                  storeUrl: 'https://example.com/huawei',
                },
              ],
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
        platform: 'android',
        channelCode: 'huawei',
        versionName: '1.0.0',
        buildCode: 100,
      } as any),
    ).resolves.toEqual(
      expect.objectContaining({
        hasUpdate: true,
        updateType: 'force',
        latestVersionName: '1.2.0',
        latestBuildCode: 120,
        packageUrl: 'https://example.com/app-release.apk',
        customDownloadUrl: 'https://download.example.com/app',
        matchedStoreLink: expect.objectContaining({
          channelCode: 'huawei',
        }),
        storeLinks: expect.arrayContaining([
          expect.objectContaining({ channelCode: 'default' }),
          expect.objectContaining({ channelCode: 'huawei' }),
        ]),
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
              platform: 'ios',
              versionName: '2.0.0',
              buildCode: 200,
              releaseNotes: '新版本',
              forceUpdate: false,
              storeLinks: [],
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
        platform: 'ios',
        versionName: '2.0.0',
        buildCode: 200,
      } as any),
    ).resolves.toEqual({ hasUpdate: false })
  })
})
