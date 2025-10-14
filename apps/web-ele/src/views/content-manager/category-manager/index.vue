<script setup lang="ts">
import type { VxeGridProps } from '@vben/plugins/vxe-table';

import type {
  BaseCategoryDto,
  CategoryPageDto,
  CreateCategoryDto,
  UpdateCategoryDto,
} from '#/apis/types/category';

import { Page, useVbenModal } from '@vben/common-ui';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  batchDeleteCategoryApi,
  batchUpdateCategoryStatusApi,
  categoryDetailApi,
  categoryPageApi,
  createCategoryApi,
  updateCategoryApi,
} from '#/apis';
import EsModalForm from '#/components/es-modal-form/index.vue';
import { useMessage } from '#/hooks/useFeedback';
import { createSearchFormOptions } from '#/utils';

import { categoryColumns, categorySearchSchema, formSchema } from './shared';

/**
 * 通用的成功处理：提示 + 刷新（遵循DRY原则封装重复逻辑）
 */
function handleSuccessReload(gridApi: any, message = '操作成功'): void {
  useMessage.success(message);
  gridApi.reload();
}

/**
 * 统一错误处理机制：
 */
function handleError(e: unknown, fallbackMsg = '操作失败，请稍后重试'): void {
  // 可按需扩展为错误上报、日志采集等
  const msg =
    typeof e === 'object' && e && 'message' in e
      ? (e as any).message
      : fallbackMsg;
  useMessage.error(msg);
}

/**
 * VxeGrid 的选项配置：
 */
const gridOptions: VxeGridProps<CategoryPageDto> = {
  columns: categoryColumns,
  height: 'auto',
  proxyConfig: {
    ajax: {
      query: async ({ page }, formValues) => {
        if (Array.isArray(formValues.contentTypes)) {
          formValues.contentTypes = (
            formValues.contentTypes as number[]
          ).reduce(
            (accumulator, currentValue) => accumulator + currentValue,
            0,
          );
        }
        try {
          return await categoryPageApi({
            pageIndex: --page.currentPage,
            pageSize: page.pageSize,
            ...formValues,
          });
        } catch (error) {
          handleError(error, '查询分类列表失败');
          // 出错时返回空数据以保证表格不崩溃
          return {
            pageIndex: page.currentPage,
            pageSize: page.pageSize,
            total: 0,
            list: [],
          };
        }
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

/**
 * 打开表单弹窗
 */
async function openFormModal(row?: CategoryPageDto): Promise<void> {
  try {
    let record: BaseCategoryDto | undefined;
    if (row) {
      record = await categoryDetailApi({ id: row.id });
    }
    formApi
      .setData({
        title: '分类',
        record,
        cols: 1,
        schema: formSchema,
        bitMaskField: ['contentTypes'],
      })
      .open();
  } catch (error) {
    handleError(error, '获取分类详情失败');
  }
}

/**
 * 切换启用状态
 */
async function toggleEnableStatus(row: CategoryPageDto): Promise<void> {
  row.loading = true as any;
  try {
    await batchUpdateCategoryStatusApi({
      ids: [row.id],
      isEnabled: !row.isEnabled,
    });
    handleSuccessReload(gridApi);
  } catch (error) {
    handleError(error, '更新分类状态失败');
  } finally {
    row.loading = false as any;
  }
}

/**
 * 新增或更新分类
 */
type CategoryFormValues = CreateCategoryDto | UpdateCategoryDto;

async function addOrUpdateCategory(values: CategoryFormValues): Promise<void> {
  try {
    await (values.id
      ? updateCategoryApi(values as UpdateCategoryDto)
      : createCategoryApi(values as CreateCategoryDto));
    useMessage.success('操作成功');
    formApi.close();
    gridApi.reload();
  } catch (error) {
    handleError(error, '保存分类失败');
  }
}

/**
 * 删除分类
 */
async function deleteCategory(row: CategoryPageDto): Promise<void> {
  try {
    await batchDeleteCategoryApi({
      ids: [row.id],
    });
    handleSuccessReload(gridApi);
  } catch (error) {
    handleError(error, '删除分类失败');
  }
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

      <template #contentTypes="{ row }">
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
            <el-button link type="danger">删除</el-button>
          </template>
        </el-popconfirm>
      </template>
    </Grid>

    <!-- 复用模块化的表单 schema -->
    <Form :schema="formSchema" :on-submit="addOrUpdateCategory" />
  </Page>
</template>

<style scoped></style>
