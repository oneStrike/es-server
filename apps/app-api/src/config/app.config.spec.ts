import { AppConfigRegister } from './app.config'

describe('app api config', () => {
  const originalEnv = { ...process.env }

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('prefers APP_API_PORT over the legacy APP_PORT', () => {
    process.env.APP_API_PORT = '18081'
    process.env.APP_PORT = '19090'

    expect(AppConfigRegister().port).toBe(18081)
  })

  it('falls back to APP_PORT for backward compatibility', () => {
    delete process.env.APP_API_PORT
    process.env.APP_PORT = '19090'

    expect(AppConfigRegister().port).toBe(19090)
  })
})
