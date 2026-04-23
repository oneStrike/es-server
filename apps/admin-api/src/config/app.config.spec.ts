import { AppConfigRegister } from './app.config'

describe('admin app config', () => {
  const originalEnv = { ...process.env }

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('prefers ADMIN_API_PORT over the legacy APP_PORT', () => {
    process.env.ADMIN_API_PORT = '18080'
    process.env.APP_PORT = '19090'

    expect(AppConfigRegister().port).toBe(18080)
  })

  it('falls back to APP_PORT for backward compatibility', () => {
    delete process.env.ADMIN_API_PORT
    process.env.APP_PORT = '19090'

    expect(AppConfigRegister().port).toBe(19090)
  })
})
