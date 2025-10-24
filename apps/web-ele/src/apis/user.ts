import type {
  ChangePasswordRequest,
  ChangePasswordResponse,
  DeleteRequest,
  DeleteResponse,
  InfoByIdRequest,
  InfoByIdResponse,
  InfoResponse,
  PageRequest,
  PageResponse,
  RegisterRequest,
  RegisterResponse,
  UpdateInfoRequest,
  UpdateInfoResponse,
} from './types/user.d';

import { requestClient } from '#/utils/request';

/**
 * 用户注册
 */
export async function registerApi(
  params: RegisterRequest,
): Promise<RegisterResponse> {
  return requestClient.post<RegisterResponse>(
    '/api/admin/user/register',
    params,
  );
}

/**
 * 更新用户信息
 */
export async function updateInfoApi(
  params: UpdateInfoRequest,
): Promise<UpdateInfoResponse> {
  return requestClient.post<UpdateInfoResponse>(
    '/api/admin/user/update-info',
    params,
  );
}

/**
 * 获取当前用户信息
 */
export async function infoApi(): Promise<InfoResponse> {
  return requestClient.get<InfoResponse>('/api/admin/user/info');
}

/**
 * 根据ID获取用户信息
 */
export async function infoByIdApi(
  params: InfoByIdRequest,
): Promise<InfoByIdResponse> {
  return requestClient.get<InfoByIdResponse>('/api/admin/user/info-by-id', {
    params,
  });
}

/**
 * 获取管理端用户分页列表
 */
export async function pageApi(params?: PageRequest): Promise<PageResponse> {
  return requestClient.get<PageResponse>('/api/admin/user/page', { params });
}

/**
 * 删除用户
 */
export async function deleteApi(
  params: DeleteRequest,
): Promise<DeleteResponse> {
  return requestClient.post<DeleteResponse>('/api/admin/user/delete', params);
}

/**
 * 修改密码
 */
export async function changePasswordApi(
  params: ChangePasswordRequest,
): Promise<ChangePasswordResponse> {
  return requestClient.post<ChangePasswordResponse>(
    '/api/admin/user/change-password',
    params,
  );
}
