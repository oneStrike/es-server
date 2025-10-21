<script setup lang="ts">
import type { VxeGridProps } from '@vben/plugins/vxe-table';

import type {
  BaseCategoryDto,
  CreateCategoryDto,
  UpdateCategoryDto,
} from '#/apis/types/category';

import { Page, useVbenModal } from '@vben/common-ui';

import { queryParams, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  batchDeleteCategoryApi,
  batchUpdateCategoryStatusApi,
  categoryDetailApi,
  categoryOrderApi,
  categoryPageApi,
  contentTypeListApi,
  createCategoryApi,
  updateCategoryApi,
} from '#/apis';
import EsModalForm from '#/components/es-modal-form/index.vue';
import { useMessage } from '#/hooks/useFeedback';
import { useForm } from '#/hooks/useForm';
import { createSearchFormOptions } from '#/utils';

import { categoryColumns, categorySearchSchema, formSchema } from './shared';

/**
 * 通用的成功处理：提示 + 刷新（遵循DRY原则封装重复逻辑）
 */
function handleSuccessReload(gridApi: any, message = '操作成功'): void {
  useMessage.success(message);
  gridApi.reload();
}

const contentTypeMap: Record<number, string> = {};

/**
 * VxeGrid 的选项配置：
 */
const gridOptions: VxeGridProps<BaseCategoryDto> = {
  columns: categoryColumns,
  height: 'auto',
  sortConfig: {
    remote: true,
    multiple: true,
  },
  rowConfig: {
    drag: true,
  },
  rowDragConfig: {
    async dragEndMethod(params) {
      await categoryOrderApi({
        dragId: params.dragRow.id,
        targetId: params.newRow.id,
      });
      await gridApi.reload();
      return true;
    },
  },
  proxyConfig: {
    ajax: {
      query: async ({ page, sorts }, formValues) => {
        if (Array.isArray(formValues.contentType)) {
          formValues.contentType = JSON.stringify(formValues.contentType);
        }
        const gridData = await categoryPageApi(
          queryParams({ page, formValues, sorts }),
        );
        gridData.list?.map((item) => {
          item.contentType = item.categoryContentTypes.map(
            (item) => item.contentType.name,
          );
          return item;
        });
        return gridData;
      },
    },
    sort: true,
  },
};

const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions,
  formOptions: createSearchFormOptions(categorySearchSchema, {
    showCollapseButton: false,
  }),
});

/**
 * 新建/编辑弹窗
 */
const [Form, formApi] = useVbenModal({
  connectedComponent: EsModalForm,
});
contentTypeListApi().then((res) => {
  const options = res.map((item) => {
    contentTypeMap[item.id] = item.name;
    return {
      label: contentTypeMap[item.id]!,
      value: item.code,
    };
  });
  useForm.setOptions(formSchema, {
    contentType: options,
  });
  useForm.setOptions(categorySearchSchema, {
    contentType: options,
  });
  gridApi.formApi.updateSchema(categorySearchSchema);
});
/**
 * 打开表单弹窗
 */
async function openFormModal(row?: BaseCategoryDto): Promise<void> {
  let record: BaseCategoryDto | undefined;
  if (row) {
    record = await categoryDetailApi({ id: row.id });
    record.contentType = record.categoryContentTypes.map(
      (item) => item.contentType.code,
    );
  }
  formApi
    .setData({
      title: '分类',
      record,
      schema: formSchema,
    })
    .open();
}

/**
 * 切换启用状态
 */
async function toggleEnableStatus(row: BaseCategoryDto): Promise<void> {
  row.loading = true as any;
  await batchUpdateCategoryStatusApi({
    ids: [row.id],
    isEnabled: !row.isEnabled,
  });
  handleSuccessReload(gridApi);
  row.loading = false as any;
}

/**
 * 新增或更新分类
 */
type CategoryFormValues = CreateCategoryDto | UpdateCategoryDto;

async function addOrUpdateCategory(values: CategoryFormValues): Promise<void> {
  await (values.id
    ? updateCategoryApi(values as UpdateCategoryDto)
    : createCategoryApi(values as CreateCategoryDto));
  useMessage.success('操作成功');
  await gridApi.reload();
}

/**
 * 删除分类
 */
async function deleteCategory(row: BaseCategoryDto): Promise<void> {
  await batchDeleteCategoryApi({
    ids: [row.id],
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

      <template #contentType="{ row }">
        <el-text>
          {{
            row.categoryContentTypes
              .map((item) => item.contentType.name)
              .join('、')
          }}
        </el-text>
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
          @confirm="deleteCategory(row)"
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
    <Form :schema="formSchema" :on-submit="addOrUpdateCategory" />
  </Page>
</template>

<style scoped></style>
