import type {
  UserChangePasswordRequest,
  UserChangePasswordResponse,
  UserDeleteRequest,
  UserDeleteResponse,
  UserInfoByIdRequest,
  UserInfoByIdResponse,
  UserInfoResponse,
  UserPageRequest,
  UserPageResponse,
  UserRegisterRequest,
  UserRegisterResponse,
  UserUnlockRequest,
  UserUnlockResponse,
  UserUpdateInfoRequest,
  UserUpdateInfoResponse,
} from './types/user.d';

import { requestClient } from '#/utils/request';

/**
 * 用户注册
 */
export async function userRegisterApi(
  params: UserRegisterRequest,
): Promise<UserRegisterResponse> {
  return requestClient.post<UserRegisterResponse>(
    '/api/admin/user/register',
    params,
  );
}

/**
 * 更新用户信息
 */
export async function userUpdateInfoApi(
  params: UserUpdateInfoRequest,
): Promise<UserUpdateInfoResponse> {
  return requestClient.post<UserUpdateInfoResponse>(
    '/api/admin/user/update-info',
    params,
  );
}

/**
 * 获取当前用户信息
 */
export async function userInfoApi(): Promise<UserInfoResponse> {
  return requestClient.get<UserInfoResponse>('/api/admin/user/info');
}

/**
 * 根据ID获取用户信息
 */
export async function userInfoByIdApi(
  params: UserInfoByIdRequest,
): Promise<UserInfoByIdResponse> {
  return requestClient.get<UserInfoByIdResponse>('/api/admin/user/info-by-id', {
    params,
  });
}

/**
 * 获取管理端用户分页列表
 */
export async function userPageApi(
  params?: UserPageRequest,
): Promise<UserPageResponse> {
  return requestClient.get<UserPageResponse>('/api/admin/user/page', {
    params,
  });
}

/**
 * 删除用户
 */
export async function userDeleteApi(
  params: UserDeleteRequest,
): Promise<UserDeleteResponse> {
  return requestClient.post<UserDeleteResponse>(
    '/api/admin/user/delete',
    params,
  );
}

/**
 * 修改密码
 */
export async function userChangePasswordApi(
  params: UserChangePasswordRequest,
): Promise<UserChangePasswordResponse> {
  return requestClient.post<UserChangePasswordResponse>(
    '/api/admin/user/change-password',
    params,
  );
}

/**
 * 解锁指定用户的锁定状态
 */
export async function userUnlockApi(
  params: UserUnlockRequest,
): Promise<UserUnlockResponse> {
  return requestClient.post<UserUnlockResponse>(
    '/api/admin/user/unlock',
    params,
  );
}
