import { requestClient } from '#/utils/request'
import type {
  GetCaptchaResponse,
  UserLoginRequest,
  UserLoginResponse,
  UserLogoutRequest,
  UserLogoutResponse,
  UserRegisterRequest,
  UserRegisterResponse,
  UserRefreshTokenRequest,
  UserRefreshTokenResponse,
  UserUpdatePasswordRequest,
  UserUpdatePasswordResponse,
  UserUpdateInfoRequest,
  UserUpdateInfoResponse,
  UserInfoResponse,
  UserInfoByIdRequest,
  UserInfoByIdResponse,
  UserPageRequest,
  UserPageResponse,
  UserDeleteRequest,
  UserDeleteResponse,
  CaptchaDto,
  UserLoginDto,
  LoginResponseDto,
  TokenDto,
  UserDto,
  UserRegisterDto,
  IdDto,
  RefreshTokenDto,
  RefreshTokenResponseDto,
  UpdatePasswordDto,
  UpdateUserDto
} from './types/user'


  /**
   * 获取验证码
   */
  export async function getCaptchaApi(): Promise<GetCaptchaResponse> {
    return requestClient.get<GetCaptchaResponse>('/api/admin/user/get-captcha');
  }


  /**
   * 管理员登录
   */
  export async function userLoginApi(params: UserLoginRequest): Promise<UserLoginResponse> {
    return requestClient.post<UserLoginResponse>('/api/admin/user/user-login', params);
  }


  /**
   * 管理员登出
   */
  export async function userLogoutApi(params: UserLogoutRequest): Promise<UserLogoutResponse> {
    return requestClient.post<UserLogoutResponse>('/api/admin/user/user-logout', params);
  }


  /**
   * 用户注册
   */
  export async function userRegisterApi(params: UserRegisterRequest): Promise<UserRegisterResponse> {
    return requestClient.post<UserRegisterResponse>('/api/admin/user/user-register', params);
  }


  /**
   * 刷新访问令牌
   */
  export async function userRefreshTokenApi(params: UserRefreshTokenRequest): Promise<UserRefreshTokenResponse> {
    return requestClient.post<UserRefreshTokenResponse>('/api/admin/user/user-refresh-token', params);
  }


  /**
   * 修改密码
   */
  export async function userUpdatePasswordApi(params: UserUpdatePasswordRequest): Promise<UserUpdatePasswordResponse> {
    return requestClient.post<UserUpdatePasswordResponse>('/api/admin/user/user-update-password', params);
  }


  /**
   * 更新用户信息
   */
  export async function userUpdateInfoApi(params: UserUpdateInfoRequest): Promise<UserUpdateInfoResponse> {
    return requestClient.post<UserUpdateInfoResponse>('/api/admin/user/user-update-info', params);
  }


  /**
   * 获取当前用户信息
   */
  export async function userInfoApi(): Promise<UserInfoResponse> {
    return requestClient.get<UserInfoResponse>('/api/admin/user/user-Info');
  }


  /**
   * 根据ID获取用户信息
   */
  export async function userInfoByIdApi(params: UserInfoByIdRequest): Promise<UserInfoByIdResponse> {
    return requestClient.get<UserInfoByIdResponse>('/api/admin/user/user-info-by-id', { params });
  }


  /**
   * 获取管理端用户分页列表
   */
  export async function userPageApi(params: UserPageRequest): Promise<UserPageResponse> {
    return requestClient.get<UserPageResponse>('/api/admin/user/user-page', { params });
  }


  /**
   * 删除用户
   */
  export async function userDeleteApi(params: UserDeleteRequest): Promise<UserDeleteResponse> {
    return requestClient.post<UserDeleteResponse>('/api/admin/user/user-delete', params);
  }
