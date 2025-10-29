import type { RoleTypeListResponse } from './types/roleType.d';

import { requestClient } from '#/utils/request';

/**
 * 获取角色类型列表
 */
export async function roleTypeListApi(): Promise<RoleTypeListResponse> {
  return requestClient.get<RoleTypeListResponse>(
    '/api/admin/work/author/role-type/list',
  );
}
