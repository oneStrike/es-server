import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'

describe('app update dto validation', () => {
  it('uses numeric enums for platform and package source', async () => {
    const { AppUpdatePackageSourceEnum, AppUpdatePlatformEnum } =
      await import('../update.constant')

    expect(AppUpdatePlatformEnum.IOS).toBe(1)
    expect(AppUpdatePlatformEnum.ANDROID).toBe(2)
    expect(AppUpdatePackageSourceEnum.UPLOAD).toBe(1)
    expect(AppUpdatePackageSourceEnum.URL).toBe(2)
  })

  it('rejects invalid platform in update check dto', async () => {
    const { AppUpdateCheckDto } = await import('./update.dto')

    const dto = plainToInstance(AppUpdateCheckDto, {
      platform: 9,
      buildCode: 100,
    }) as object

    const errors = validateSync(dto)

    expect(errors.some((error) => error.property === 'platform')).toBe(true)
  })

  it('rejects legacy string platform values in update check dto', async () => {
    const { AppUpdateCheckDto } = await import('./update.dto')

    const dto = plainToInstance(AppUpdateCheckDto, {
      platform: 'android',
      buildCode: 100,
    }) as object

    const errors = validateSync(dto)

    expect(errors.some((error) => error.property === 'platform')).toBe(true)
  })

  it('allows omitting version name in update check dto', async () => {
    const { AppUpdateCheckDto } = await import('./update.dto')

    const dto = plainToInstance(AppUpdateCheckDto, {
      platform: 2,
      buildCode: 100,
    }) as object

    const errors = validateSync(dto)

    expect(errors.some((error) => error.property === 'versionName')).toBe(false)
  })

  it('rejects invalid download urls and popup positions in release dto', async () => {
    const { CreateAppUpdateReleaseDto } = await import('./update.dto')

    const dto = plainToInstance(CreateAppUpdateReleaseDto, {
      platform: 2,
      versionName: '1.0.0',
      buildCode: 100,
      forceUpdate: false,
      packageSourceType: 9,
      customDownloadUrl: 'ftp://example.com/package',
      popupBackgroundPosition: 'middle',
    }) as object

    const errors = validateSync(dto, { whitelist: true })

    expect(errors.some((error) => error.property === 'customDownloadUrl')).toBe(
      true,
    )
    expect(errors.some((error) => error.property === 'packageSourceType')).toBe(
      true,
    )
    expect(
      errors.some((error) => error.property === 'popupBackgroundPosition'),
    ).toBe(true)
  })
})
