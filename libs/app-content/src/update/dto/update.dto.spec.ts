import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'

describe('app update dto validation', () => {
  it('rejects invalid platform in update check dto', async () => {
    const { AppUpdateCheckDto } = await import('./update.dto')

    const dto = plainToInstance(AppUpdateCheckDto, {
      platform: 'windows',
      buildCode: 100,
      versionName: '1.0.0',
    }) as object

    const errors = validateSync(dto)

    expect(errors.some(error => error.property === 'platform')).toBe(true)
  })

  it('rejects invalid download urls in release dto', async () => {
    const { CreateAppUpdateReleaseDto } = await import('./update.dto')

    const dto = plainToInstance(CreateAppUpdateReleaseDto, {
      platform: 'android',
      versionName: '1.0.0',
      buildCode: 100,
      forceUpdate: false,
      customDownloadUrl: 'ftp://example.com/package',
      storeLinks: [
        {
          channelCode: 'default',
          channelName: '默认渠道',
          storeUrl: 'not-a-url',
        },
      ],
    }) as object

    const errors = validateSync(dto, { whitelist: true })

    expect(errors.some(error => error.property === 'customDownloadUrl')).toBe(
      true,
    )
    expect(errors.some(error => error.property === 'storeLinks')).toBe(true)
  })
})
