import type { UserInfo } from '@vben/types';

import type { UserLoginDto } from '#/apis/types/user';

import { ref } from 'vue';
import { useRouter } from 'vue-router';

import { LOGIN_PATH } from '@vben/constants';
import { preferences } from '@vben/preferences';
import { resetAllStores, useAccessStore, useUserStore } from '@vben/stores';

import { notification } from 'ant-design-vue';
import forge from 'node-forge';
import { defineStore } from 'pinia';

import { logoutApi } from '#/api';
import { publicKeyApi, userInfoApi, userLoginApi } from '#/apis';
import { $t } from '#/locales';

export const useAuthStore = defineStore('auth', () => {
  const accessStore = useAccessStore();
  const userStore = useUserStore();
  const router = useRouter();

  const loginLoading = ref(false);

  /**
   * 异步处理登录操作
   * Asynchronously handle the login process
   * @param params 登录表单数据
   */
  async function authLogin(
    params: UserLoginDto,
    onSuccess?: () => Promise<void> | void,
  ) {
    let userInfo: null | UserInfo = null;
    try {
      loginLoading.value = true;
      const { publicKey } = await publicKeyApi();

      const publicKeyPem = forge.pki.publicKeyFromPem(publicKey);
      const encrypted = publicKeyPem.encrypt(params.password, 'RSA-OAEP', {
        md: forge.md.sha256.create(), // 使用SHA-256作为哈希函数
        mgf1: {
          md: forge.md.sha256.create(), // 使用SHA-256作为MGF1的哈希函数
        },
      });
      params.password = forge.util.encode64(encrypted);
      const { tokens } = await userLoginApi(params);

      // 如果成功获取到 accessToken
      if (tokens.accessToken) {
        accessStore.setAccessToken(tokens.accessToken);
        accessStore.setRefreshToken(tokens.refreshToken);
        userInfo = await fetchUserInfo();
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
          notification.success({
            description: `${$t('authentication.loginSuccessDesc')}:${userInfo?.realName}`,
            duration: 3,
            message: $t('authentication.loginSuccess'),
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
    try {
      await logoutApi();
    } catch {
      // 不做任何处理
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

  function $reset() {
    loginLoading.value = false;
  }

  return {
    $reset,
    authLogin,
    fetchUserInfo,
    loginLoading,
    logout,
  };
});
