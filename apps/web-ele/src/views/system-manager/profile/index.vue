<script setup lang="ts">
import type { VxeGridProps } from '#/adapter/vxe-table';
import type {
  RequestLogDto,
  RequestLogPageRequest,
} from '#/apis/types/requestLog';
import type {
  UserDto,
  UserUpdateInfoRequest,
  UserUpdatePasswordRequest,
} from '#/apis/types/user';

import { onMounted, ref } from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';
import { useUserStore } from '@vben/stores';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { requestLogPageApi } from '#/apis/requestLog';
import {
  userInfoApi,
  userUpdateInfoApi,
  userUpdatePasswordApi,
} from '#/apis/user';
import EsModalForm from '#/components/es-modal-form/index.vue';
import { useMessage } from '#/hooks/useFeedback';

import {
  editFormSchema,
  loginHistortColumn,
  passwordFormSchema,
} from './shared';

const userStore = useUserStore();

// 用户信息
const userInfo = ref<null | UserDto>(null);
const loading = ref(false);

// 登录历史表格配置
const gridOptions: VxeGridProps<RequestLogDto> = {
  columns: loginHistortColumn,
  height: 'auto',
  proxyConfig: {
    ajax: {
      query: async ({ page }) => {
        if (!userInfo.value) return { list: [], total: 0 };
        const params: RequestLogPageRequest = {
          pageIndex: --page.currentPage,
          pageSize: page.pageSize,
          userId: userInfo.value.id,
          requestPath: '/api/admin/user/user-login',
        };

        const data = await requestLogPageApi(params);
        return {
          list: data.list || [],
          total: data.total || 0,
        };
      },
    },
  },
};

// 创建表格和表单实例
const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions,
});

const [EditForm, editFormApi] = useVbenModal({
  connectedComponent: EsModalForm,
});

const [PasswordForm, passwordFormApi] = useVbenModal({
  connectedComponent: EsModalForm,
});

// 获取用户信息
const fetchUserInfo = async () => {
  try {
    loading.value = true;
    const data = await userInfoApi();
    userInfo.value = data;
  } catch {
    useMessage.error('获取用户信息失败');
  } finally {
    loading.value = false;
  }
};

// 提交：编辑用户信息
async function handleEditSubmit(values: UserUpdateInfoRequest) {
  try {
    await userUpdateInfoApi({ ...values, id: userInfo.value!.id });
    useMessage.success('用户信息更新成功');
    await fetchUserInfo();
    // 更新全局用户信息
    if (userInfo.value) {
      userStore.setUserInfo({
        ...userStore.userInfo,
        username: userInfo.value.username,
        avatar: userInfo.value.avatar || '',
        realName: userInfo.value.username,
        userId: String(userInfo.value.id),
      });
    }
    editFormApi.close();
  } catch {
    useMessage.error('更新用户信息失败');
  }
}

// 提交：修改密码
async function handlePasswordSubmit(values: UserUpdatePasswordRequest) {
  if (values.newPassword !== values.confirmPassword) {
    useMessage.error('新密码和确认密码不一致');
    return;
  }
  try {
    await userUpdatePasswordApi(values);
    useMessage.success('密码修改成功');
    passwordFormApi.close();
  } catch {
    useMessage.error('密码修改失败');
  }
}

// 打开编辑对话框
const openEditDialog = async () => {
  if (!userInfo.value) return;

  editFormApi
    .setData({ width: 500, title: '用户信息', record: userInfo.value })
    .open();
};

// 打开修改密码对话框
const openPasswordDialog = async () => {
  passwordFormApi.setData({ width: 500, title: '密码' }).open();
};

// 刷新登录历史
const refreshHistory = () => {
  gridApi.reload();
};

// 格式化时间
const formatTime = (time: string) => {
  return new Date(time).toLocaleString('zh-CN');
};

// 格式化角色
const formatRole = (role: number) => {
  return role === 1 ? '超级管理员' : '普通管理员';
};

// 格式化状态
const formatStatus = (isEnabled: boolean, isLocked: boolean) => {
  if (isLocked) return '已锁定';
  return isEnabled ? '正常' : '禁用';
};

// 获取状态颜色
const getStatusColor = (isEnabled: boolean, isLocked: boolean) => {
  if (isLocked) return 'danger';
  return isEnabled ? 'success' : 'warning';
};

onMounted(async () => {
  await fetchUserInfo();
});
</script>

<template>
  <Page auto-content-height>
    <div class="grid h-full grid-cols-1 gap-6 lg:grid-cols-5">
      <!-- 左侧用户信息 -->
      <div class="h-full lg:col-span-2">
        <div
          v-loading="loading"
          class="border-border bg-background rounded-lg border p-6 shadow-sm"
        >
          <div class="mb-6 flex items-center justify-between">
            <h2 class="text-foreground text-lg font-semibold">个人信息</h2>
            <div class="flex gap-2">
              <el-button type="primary" @click="openEditDialog">
                编辑信息
              </el-button>
              <el-button type="warning" @click="openPasswordDialog">
                修改密码
              </el-button>
            </div>
          </div>

          <div v-if="userInfo">
            <!-- 头像区域 -->
            <div class="mb-4 flex flex-col items-center">
              <el-avatar :size="120" :src="userInfo.avatar" class="mb-4" />
              <h3 class="text-foreground mb-2 text-xl font-semibold">
                {{ userInfo.username }}
              </h3>
            </div>

            <!-- 详细信息区域 -->
            <el-descriptions :column="1" border>
              <el-descriptions-item label="用户ID">
                <span class="text-foreground font-mono">{{ userInfo.id }}</span>
              </el-descriptions-item>
              <el-descriptions-item label="用户名">
                {{ userInfo.username }}
              </el-descriptions-item>
              <el-descriptions-item label="手机号">
                {{ userInfo.mobile }}
              </el-descriptions-item>
              <el-descriptions-item label="角色">
                <el-tag :type="userInfo.role === 1 ? 'danger' : 'primary'">
                  {{ formatRole(userInfo.role) }}
                </el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="账户状态">
                <el-tag
                  :type="getStatusColor(userInfo.isEnabled, userInfo.isLocked)"
                >
                  {{ formatStatus(userInfo.isEnabled, userInfo.isLocked) }}
                </el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="最后登录时间">
                {{
                  userInfo.lastLoginAt
                    ? formatTime(userInfo.lastLoginAt)
                    : '从未登录'
                }}
              </el-descriptions-item>
              <el-descriptions-item label="最后登录IP">
                {{ userInfo.lastLoginIp || '未知' }}
              </el-descriptions-item>
              <el-descriptions-item label="创建时间">
                {{ formatTime(userInfo.createdAt) }}
              </el-descriptions-item>
            </el-descriptions>
          </div>
        </div>
      </div>

      <!-- 右侧登录历史 -->
      <div class="h-full lg:col-span-3">
        <div
          class="border-border bg-background h-full rounded-lg border p-6 shadow-sm"
        >
          <div class="flex items-center justify-between">
            <h2 class="text-foreground text-lg font-semibold">登录历史记录</h2>
            <el-button @click="refreshHistory"> 刷新 </el-button>
          </div>

          <div class="h-[93%]">
            <Grid />
          </div>
        </div>
      </div>
    </div>

    <!-- 表单弹窗 -->
    <EditForm :schema="editFormSchema" :on-submit="handleEditSubmit" />
    <PasswordForm
      :schema="passwordFormSchema"
      :on-submit="handlePasswordSubmit"
    />
  </Page>
</template>

<style scoped>
.el-descriptions :deep(.el-descriptions__label) {
  font-weight: 600;
  color: hsl(var(--foreground));
}

.el-descriptions :deep(.el-descriptions__content) {
  color: hsl(var(--foreground));
}

.font-mono {
  font-family: 'Courier New', monospace;
}
</style>
