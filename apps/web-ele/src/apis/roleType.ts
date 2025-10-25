import { requestClient } from '#/utils/request';
import type {
  RoleTypeListResponse,
  RoleTypeListResponseDto,
} from './types/roleType.d';

/**
 * 获取角色类型列表
 */
export async function roleTypeListApi(): Promise<RoleTypeListResponse> {
  return requestClient.get<RoleTypeListResponse>(
    '/api/admin/work/author/role-type/list',
  );
}
