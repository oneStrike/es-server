import type { UserInfo } from '@vben/types';

import type { UserLoginRequest } from '#/apis/types/user';

import { LOGIN_PATH } from '@vben/constants';
import { preferences } from '@vben/preferences';
import { resetAllStores, useAccessStore, useUserStore } from '@vben/stores';

import { ElNotification } from 'element-plus';
import forge from 'node-forge';
import { defineStore } from 'pinia';

import { publicKeyApi, userInfoApi, userLoginApi, userLogoutApi } from '#/apis';
import { $t } from '#/locales';

export const useAuthStore = defineStore('auth', () => {
  const accessStore = useAccessStore();
  const userStore = useUserStore();
  const router = useRouter();

  const loginLoading = ref(false);
  const publicKey = ref('');
  const refreshToken = ref('');

  /**
   * 异步处理登录操作
   * Asynchronously handle the login process
   * @param params 登录表单数据
   */
  async function authLogin(
    params: UserLoginRequest,
    onSuccess?: () => Promise<void> | void,
  ) {
    // 异步处理用户登录操作并获取 accessToken
    let userInfo: null | UserInfo = null;
    try {
      loginLoading.value = true;
      const publicKeyPem = forge.pki.publicKeyFromPem(await getRsaPublicKey());
      // 使用OAEP填充进行加密
      const encrypted = publicKeyPem.encrypt(params.password, 'RSA-OAEP', {
        md: forge.md.sha256.create(), // 使用SHA-256作为哈希函数
        mgf1: {
          md: forge.md.sha256.create(), // 使用SHA-256作为MGF1的哈希函数
        },
      });
      // 使用加密后的密码
      params.password = forge.util.encode64(encrypted);
      const { tokens } = await userLoginApi(params);

      // 如果成功获取到 accessToken
      if (tokens.accessToken && tokens.refreshToken) {
        accessStore.setAccessToken(tokens.accessToken);
        accessStore.setRefreshToken(tokens.refreshToken);

        // 获取用户信息并存储到 accessStore 中
        userInfo = await fetchUserInfo();
        userInfo.token = tokens.accessToken;

        userStore.setUserInfo(userInfo);

        if (accessStore.loginExpired) {
          accessStore.setLoginExpired(false);
        } else {
          onSuccess
            ? await onSuccess?.()
            : await router.push(
                userInfo.homePath || preferences.app.defaultHomePath,
              );
        }

        if (userInfo?.realName) {
          ElNotification.success({
            message: `${$t('authentication.loginSuccessDesc')}:${userInfo?.realName}`,
            duration: 3000,
            title: $t('authentication.loginSuccess'),
          });
        }
      }
    } finally {
      loginLoading.value = false;
    }

    return {
      userInfo,
    };
  }

  async function logout(redirect: boolean = true) {
    const accessToken = accessStore.accessToken as string;
    const refreshToken = accessStore.refreshToken as string;
    if (accessToken && refreshToken) {
      accessStore.setAccessToken(null);
      accessStore.setRefreshToken(null);
      try {
        await userLogoutApi({
          accessToken,
          refreshToken,
        });
      } catch {
        // 不做任何处理
      }
    }

    resetAllStores();
    accessStore.setLoginExpired(false);

    // 回登录页带上当前路由地址
    await router.replace({
      path: LOGIN_PATH,
      query: redirect
        ? {
            redirect: encodeURIComponent(router.currentRoute.value.fullPath),
          }
        : {},
    });
  }

  async function fetchUserInfo() {
    let userInfo: null | UserInfo = null;
    const user = await userInfoApi();
    userInfo = {
      ...user,
      userId: String(user.id),
      realName: user.username,
      avatar: user.avatar || '',
      desc: '',
      homePath: preferences.app.defaultHomePath,
      token: '',
    };
    userStore.setUserInfo(userInfo);
    return userInfo;
  }

  /**
   * 获取公钥key
   */
  async function getRsaPublicKey() {
    if (publicKey.value) {
      return publicKey.value;
    }
    const res = await publicKeyApi();
    publicKey.value = res.publicKey;
    return publicKey.value;
  }

  function $reset() {
    loginLoading.value = false;
  }

  return {
    $reset,
    authLogin,
    fetchUserInfo,
    loginLoading,
    logout,
    getRsaPublicKey,
    refreshToken,
  };
});
