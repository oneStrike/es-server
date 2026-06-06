/// <reference types="jest" />

import 'reflect-metadata'
import { PATH_METADATA, ROUTE_ARGS_METADATA } from '@nestjs/common/constants'
import { RouteParamtypes } from '@nestjs/common/enums/route-paramtypes.enum'
import { DECORATORS } from '@nestjs/swagger/dist/constants'
import { UserController } from './user.controller'

function routeArgsMetadata(methodName: keyof UserController) {
  return Reflect.getMetadata(
    ROUTE_ARGS_METADATA,
    UserController,
    methodName,
  ) as Record<string, { index: number; data?: unknown }> | undefined
}

describe('App UserController center contract', () => {
  it('registers app user center route and forwards only the current user id', async () => {
    const userService = {
      getUserCenter: jest.fn(() => Promise.resolve({ user: { id: 7 } })),
    }
    const controller = new UserController(userService as any)

    expect(Reflect.getMetadata(PATH_METADATA, UserController)).toBe('app/user')
    expect(
      Reflect.getMetadata(PATH_METADATA, UserController.prototype.getCenter),
    ).toBe('center')

    await expect(
      (controller.getCenter as (...args: any[]) => Promise<unknown>)(7, {
        userId: 8,
      }),
    ).resolves.toEqual({ user: { id: 7 } })
    expect(userService.getUserCenter).toHaveBeenCalledWith(7)
    expect(userService.getUserCenter).toHaveBeenCalledTimes(1)
  })

  it('does not expose a userId query parameter in the center contract', () => {
    const routeArgs = routeArgsMetadata('getCenter') ?? {}
    const routeArgKeys = Object.keys(routeArgs)

    expect(
      routeArgKeys.some((key) => key.startsWith(`${RouteParamtypes.QUERY}:`)),
    ).toBe(false)
    expect(
      Reflect.getMetadata(
        DECORATORS.API_PARAMETERS,
        UserController.prototype.getCenter,
      ),
    ).toBeUndefined()
  })
})
