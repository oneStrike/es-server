import { requestClient } from '#/utils/request';

/**
 * FooController_create
 */
export async function fooApi(): Promise<FooResponse> {
  return requestClient.post<FooResponse>('/api/admin/foo/foo');
}
