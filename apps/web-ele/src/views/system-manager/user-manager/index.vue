<script lang="ts" setup>
import type { VxeGridProps } from '#/adapter/vxe-table';
import type {
  UpdateUserDto,
  UserDto,
  UserRegisterRequest,
} from '#/apis/types/user';

import { computed } from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';
import { useUserStore } from '@vben/stores';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  userDeleteApi,
  userInfoByIdApi,
  userPageApi,
  userRegisterApi,
  userUpdateInfoApi,
} from '#/apis';
import EsModalForm from '#/components/es-modal-form/index.vue';
import { useMessage } from '#/hooks/useFeedback';
import { createSearchFormOptions } from '#/utils/grid-form-config';

import {
  editFormSchema,
  formSchema,
  lockStatusObj,
  userColumns,
  userFilter,
  userRoleObj,
  userStatusObj,
} from './shared';

const userStore = useUserStore();

// 检查是否为超级管理员 (role: 1)
const isSuperAdmin = computed(() => {
  return userStore.userInfo?.role === 1;
});

const gridOptions: VxeGridProps<UserDto> = {
  columns: userColumns,
  height: 'auto',
  proxyConfig: {
    ajax: {
      query: async ({ page }, formValues) => {
        return await userPageApi({
          pageIndex: --page.currentPage,
          pageSize: page.pageSize,
          ...formValues,
        });
      },
    },
    sort: true,
  },
};

const [Form, formApi] = useVbenModal({
  connectedComponent: EsModalForm,
});

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: createSearchFormOptions(userFilter),
  gridOptions,
});

async function openFormModal(row?: UserDto) {
  if (!isSuperAdmin.value) {
    useMessage.warning('只有超级管理员才能执行此操作');
    return;
  }

  let record;
  if (row) {
    const response = await userInfoByIdApi({ id: row.id });
    record = response;
  }
  formApi.setData({ title: '用户管理', record, schema: editFormSchema }).open();
}

async function handleSubmit(values: UpdateUserDto | UserRegisterRequest) {
  await (values?.id
    ? userUpdateInfoApi(values as UpdateUserDto)
    : userRegisterApi(values as UserRegisterRequest));
  formApi.close();
  useMessage.success('操作成功');
  gridApi.reload();
}

async function deleteUser(record: UserDto) {
  if (!isSuperAdmin.value) {
    useMessage.warning('只有超级管理员才能执行此操作');
    return;
  }

  await userDeleteApi({ id: record.id });
  useMessage.success('删除成功');
  gridApi.reload();
}

async function toggleUserStatus(record: UserDto) {
  if (!isSuperAdmin.value) {
    useMessage.warning('只有超级管理员才能执行此操作');
    return;
  }

  const newStatus = !record.isEnabled;
  await userUpdateInfoApi({
    id: record.id,
    username: record.username,
    mobile: record.mobile,
    avatar: record.avatar,
    role: record.role,
    isEnabled: newStatus,
  });
  useMessage.success(newStatus ? '启用成功' : '禁用成功');
  gridApi.reload();
}
</script>

<template>
  <Page auto-content-height>
    <Grid>
      <template #toolbar-actions>
        <el-button
          v-if="isSuperAdmin"
          class="ml-2"
          type="primary"
          @click="openFormModal()"
        >
          添加用户
        </el-button>
      </template>

      <template #avatar="{ row }">
        <el-avatar
          :size="40"
          :src="row.avatar"
          :icon="row.avatar ? undefined : 'User'"
        >
          {{ row.avatar ? '' : row.username?.charAt(0)?.toUpperCase() }}
        </el-avatar>
      </template>

      <template #role="{ row }">
        <el-text :style="{ color: userRoleObj[row.role]?.color }">
          {{ userRoleObj[row.role]?.label }}
        </el-text>
      </template>

      <template #isEnabled="{ row }">
        <el-text
          :style="{ color: userStatusObj[String(row.isEnabled)]?.color }"
        >
          {{ userStatusObj[String(row.isEnabled)]?.label }}
        </el-text>
      </template>

      <template #isLocked="{ row }">
        <el-text :style="{ color: lockStatusObj[String(row.isLocked)]?.color }">
          {{ lockStatusObj[String(row.isLocked)]?.label }}
        </el-text>
      </template>

      <template #actions="{ row }">
        <div class="my-1">
          <el-button
            v-if="isSuperAdmin"
            link
            type="primary"
            @click="openFormModal(row)"
          >
            编辑
          </el-button>

          <el-divider v-if="isSuperAdmin" direction="vertical" />
          <el-popconfirm
            v-if="isSuperAdmin"
            :title="row.isEnabled ? '确认禁用当前用户?' : '确认启用当前用户?'"
            width="180"
            confirm-button-text="确认"
            cancel-button-text="取消"
            @confirm="toggleUserStatus(row)"
          >
            <template #reference>
              <el-button link :type="row.isEnabled ? 'warning' : 'success'">
                {{ row.isEnabled ? '禁用' : '启用' }}
              </el-button>
            </template>
          </el-popconfirm>

          <el-divider v-if="isSuperAdmin" direction="vertical" />
          <el-popconfirm
            v-if="isSuperAdmin"
            title="确认删除当前用户?"
            confirm-button-text="确认"
            cancel-button-text="取消"
            @confirm="deleteUser(row)"
          >
            <template #reference>
              <el-button link type="danger">删除</el-button>
            </template>
          </el-popconfirm>

          <div v-if="!isSuperAdmin" class="text-gray-400">无操作权限</div>
        </div>
      </template>
    </Grid>

    <Form :schema="formSchema" :on-submit="handleSubmit" />
  </Page>
</template>

<style scoped></style>
