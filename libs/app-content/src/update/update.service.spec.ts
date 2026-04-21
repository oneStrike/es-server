import type { DrizzleService } from '@db/core'
import {
  AppUpdatePackageSourceEnum,
  AppUpdatePlatformEnum,
} from './update.constant'
import { AppUpdateService } from './update.service'

function createUpdateService() {
  const tx = {
    insert: jest.fn(() => ({
      values: jest.fn().mockResolvedValue(undefined),
    })),
  }
  const withTransaction = jest.fn(async (fn: (db: typeof tx) => unknown) =>
    fn(tx),
  )

  const drizzle = {
    db: {
      query: {
        appUpdateRelease: {
          findFirst: jest.fn(),
        },
      },
    },
    withErrorHandling: jest.fn(async (fn: () => unknown) => fn()),
    withTransaction,
    ext: {
      findPagination: jest.fn(),
    },
    schema: {
      appUpdateRelease: {
        platform: 'platform',
        versionName: 'versionName',
        buildCode: 'buildCode',
        forceUpdate: 'forceUpdate',
        isPublished: 'isPublished',
        publishedAt: 'publishedAt',
        createdAt: 'createdAt',
        updatedAt: 'updatedAt',
        id: 'id',
      },
    },
  } as unknown as DrizzleService

  return {
    service: new AppUpdateService(drizzle),
    mocks: {
      withTransaction,
    },
  }
}

describe('AppUpdateService', () => {
  it('rejects plain HTTP package URLs for external distributions', async () => {
    const { service, mocks } = createUpdateService()

    await expect(
      service.create(
        {
          platform: AppUpdatePlatformEnum.ANDROID,
          versionName: '1.2.3',
          buildCode: 123,
          forceUpdate: false,
          packageSourceType: AppUpdatePackageSourceEnum.URL,
          packageUrl: 'http://example.com/release.apk',
        },
        1,
      ),
    ).rejects.toMatchObject({
      message: '外部安装包地址必须是合法的 HTTPS URL',
    })

    expect(mocks.withTransaction).not.toHaveBeenCalled()
  })
})
