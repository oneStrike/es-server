import type {
  RoleTypeChangeStatusResponse,
  RoleTypeCreateResponse,
  RoleTypeDeleteResponse,
  RoleTypeListResponse,
  RoleTypeUpdateResponse,
} from './types/roleType.d';

import { requestClient } from '#/utils/request';

/**
 * 获取角色类型列表
 */
export async function roleTypeListApi(): Promise<RoleTypeListResponse> {
  return requestClient.get<RoleTypeListResponse>(
    '/api/admin/work/author/role-type/list',
  );
}

/**
 * 创建角色类型
 */
export async function roleTypeCreateApi(): Promise<RoleTypeCreateResponse> {
  return requestClient.post<RoleTypeCreateResponse>(
    '/api/admin/work/author/role-type/create',
  );
}

/**
 * 删除角色类型
 */
export async function roleTypeDeleteApi(): Promise<RoleTypeDeleteResponse> {
  return requestClient.post<RoleTypeDeleteResponse>(
    '/api/admin/work/author/role-type/delete',
  );
}

/**
 * 更新角色类型
 */
export async function roleTypeUpdateApi(): Promise<RoleTypeUpdateResponse> {
  return requestClient.post<RoleTypeUpdateResponse>(
    '/api/admin/work/author/role-type/update',
  );
}

/**
 * 调整角色类型状态
 */
export async function roleTypeChangeStatusApi(): Promise<RoleTypeChangeStatusResponse> {
  return requestClient.post<RoleTypeChangeStatusResponse>(
    '/api/admin/work/author/role-type/change-status',
  );
}
