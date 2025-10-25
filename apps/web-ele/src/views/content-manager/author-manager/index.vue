<script setup lang="ts">
import type { VxeGridProps } from '@vben/plugins/vxe-table';

import type {
  AuthorPageResponseDto,
  CreateAuthorDto,
  UpdateAuthorDto,
} from '#/apis/types/author';

import { Page, useVbenModal } from '@vben/common-ui';

import { queryParams, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  authorBatchUpdateFeaturedApi,
  authorBatchUpdateStatusApi,
  authorCreateApi,
  authorDeleteApi,
  authorDetailApi,
  authorPageApi,
  authorUpdateApi,
} from '#/apis';
import EsModalForm from '#/components/es-modal-form/index.vue';
import { useMessage } from '#/hooks/useFeedback';
import { createSearchFormOptions } from '#/utils';

import { authorColumns, authorSearchSchema, formSchema } from './shared';

/**
 * 通用的成功处理：提示 + 刷新（遵循DRY原则封装重复逻辑）
 */
function handleSuccessReload(gridApi: any, message = '操作成功'): void {
  useMessage.success(message);
  gridApi.reload();
}

/**
 * VxeGrid 的选项配置
 */
const gridOptions: VxeGridProps<AuthorPageResponseDto> = {
  columns: authorColumns,
  height: 'auto',
  sortConfig: {
    remote: true,
    multiple: true,
  },
  proxyConfig: {
    ajax: {
      query: async ({ page, sorts }, formValues) => {
        const gridData = await authorPageApi(
          queryParams({ page, formValues, sorts }),
        );
        return gridData;
      },
    },
    sort: true,
  },
};

const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions,
  formOptions: createSearchFormOptions(authorSearchSchema, {
    showCollapseButton: false,
  }),
});

/**
 * 新建/编辑弹窗
 */
const [Form, formApi] = useVbenModal({
  connectedComponent: EsModalForm,
});

/**
 * 将角色名称数组转换为位运算值
 */
function rolesToBitmask(roles?: number[]): number {
  if (!roles || roles.length === 0) return 0;
  return roles.reduce((acc, role) => acc | role, 0);
}

/**
 * 将位运算值转换为角色数组
 */
function bitmaskToRoles(bitmask?: number): number[] {
  if (!bitmask) return [];
  const roleValues = [1, 2, 4, 8];
  return roleValues.filter((role) => bitmask & role);
}

/**
 * 打开表单弹窗
 */
async function openFormModal(row?: AuthorPageResponseDto): Promise<void> {
  let record: any;
  if (row) {
    record = await authorDetailApi({ id: row.id });
    // 将位运算值转换为数组供复选框使用
    record.roles = bitmaskToRoles(record.roles);
  }
  formApi
    .setData({
      title: '作者',
      record,
      schema: formSchema,
    })
    .open();
}

/**
 * 切换启用状态
 */
async function toggleEnableStatus(row: AuthorPageResponseDto): Promise<void> {
  row.loading = true as any;
  await authorBatchUpdateStatusApi({
    ids: [row.id],
    isEnabled: !row.isEnabled,
  });
  handleSuccessReload(gridApi);
  row.loading = false as any;
}

/**
 * 切换推荐状态
 */
async function toggleFeaturedStatus(row: AuthorPageResponseDto): Promise<void> {
  row.loading = true as any;
  await authorBatchUpdateFeaturedApi({
    ids: [row.id],
    featured: !row.featured,
  });
  handleSuccessReload(gridApi);
  row.loading = false as any;
}

/**
 * 新增或更新作者
 */
type AuthorFormValues = CreateAuthorDto | UpdateAuthorDto;

async function addOrUpdateAuthor(values: AuthorFormValues): Promise<void> {
  // 将角色数组转换为位运算值
  if (Array.isArray(values.roles)) {
    values.roles = rolesToBitmask(values.roles);
  }

  await (values.id
    ? authorUpdateApi(values as UpdateAuthorDto)
    : authorCreateApi(values as CreateAuthorDto));
  useMessage.success('操作成功');
  await gridApi.reload();
}

/**
 * 删除作者
 */
async function deleteAuthor(row: AuthorPageResponseDto): Promise<void> {
  await authorDeleteApi({
    id: row.id,
  });
  handleSuccessReload(gridApi);
}
</script>

<template>
  <Page auto-content-height>
    <Grid>
      <template #toolbar-actions>
        <el-button class="ml-2" type="primary" @click="openFormModal()">
          添加
        </el-button>
      </template>

      <template #isEnabled="{ row }">
        <el-switch
          :active-value="true"
          :inactive-value="row.isEnabled"
          :loading="row.loading"
          :model-value="row.isEnabled"
          @change="toggleEnableStatus(row)"
        />
      </template>

      <template #featured="{ row }">
        <el-switch
          :active-value="true"
          :inactive-value="row.featured"
          :loading="row.loading"
          :model-value="row.featured"
          @change="toggleFeaturedStatus(row)"
        />
      </template>

      <template #actions="{ row }">
        <el-button link type="primary" @click="openFormModal(row)">
          编辑
        </el-button>
        <el-divider direction="vertical" />
        <el-popconfirm
          title="确认删除当前项?"
          confirm-button-text="确认"
          cancel-button-text="取消"
          @confirm="deleteAuthor(row)"
        >
          <template #reference>
            <el-button link type="danger" :disabled="row.isEnabled">
              删除
            </el-button>
          </template>
        </el-popconfirm>
      </template>
    </Grid>

    <!-- 复用模块化的表单 schema -->
    <Form :schema="formSchema" :on-submit="addOrUpdateAuthor" />
  </Page>
</template>

<style scoped></style>
