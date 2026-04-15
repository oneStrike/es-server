import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'
import { UpdateSystemConfigDto } from './config.dto'

describe('system config dto validation', () => {
  it('更新系统配置时必须携带快照 id', () => {
    const dto = plainToInstance(UpdateSystemConfigDto, {
      siteConfig: {
        siteName: '示例站点',
      },
    }) as object

    const errors = validateSync(dto)

    expect(errors.some((error) => error.property === 'id')).toBe(true)
  })

  it('允许携带 id 后按顶层配置块做局部更新', () => {
    const dto = plainToInstance(UpdateSystemConfigDto, {
      id: 7,
      maintenanceConfig: {
        enableMaintenanceMode: true,
      },
    }) as object

    const errors = validateSync(dto)

    expect(errors.some((error) => error.property === 'id')).toBe(false)
  })
})
