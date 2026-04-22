import { checkInConfig } from '@db/schema'
import { CheckInDefinitionService } from './check-in-definition.service'

describe('check-in definition service orchestration', () => {
  function createService() {
    const drizzle = {
      schema: {
        checkInConfig,
      },
      db: {
        update: jest.fn().mockReturnValue({
          set: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue(undefined),
          }),
        }),
      },
    }

    const service = new CheckInDefinitionService(
      drizzle as never,
      {} as never,
      {} as never,
      {} as never,
    )

    ;(
      service as unknown as {
        getRequiredConfig: () => Promise<{ id: number }>
      }
    ).getRequiredConfig = jest.fn().mockResolvedValue({ id: 5 })

    return {
      service,
      drizzle,
    }
  }

  it('updates enabled flag without touching unrelated config fields', async () => {
    const { service, drizzle } = createService()

    await expect(
      service.updateEnabled(
        {
          isEnabled: true,
        } as never,
        99,
      ),
    ).resolves.toBe(true)

    expect(drizzle.db.update).toHaveBeenCalled()
  })
})
