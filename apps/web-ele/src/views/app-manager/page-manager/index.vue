<script lang="ts" setup>
import type { VxeGridProps } from '#/adapter/vxe-table';
import type {
  BasePageConfigFieldsDto,
  ClientPageConfigPageResponseDto,
  UpdateClientPageConfigDto,
} from '#/apis/types/clientPage';

import { Page, useVbenModal } from '@vben/common-ui';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  clientPageBatchDeleteApi,
  clientPageCreateApi,
  clientPageDetailByIdApi,
  clientPagePageApi,
  clientPageUpdateApi,
} from '#/apis';
import EsModalForm from '#/components/es-modal-form/index.vue';
import { useMessage } from '#/hooks/useFeedback';
import { createSearchFormOptions } from '#/utils/grid-form-config';
import PageDetail from '#/views/app-manager/page-manager/detail.vue';

import {
  accessLevelObj,
  formSchema,
  pageColumns,
  pageFilter,
  pageStatusObj,
} from './shared';

const gridOptions: VxeGridProps<ClientPageConfigPageResponseDto> = {
  columns: pageColumns,
  height: 'auto',
  proxyConfig: {
    ajax: {
      query: async ({ page }, formValues) => {
        return await clientPagePageApi({
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
  formOptions: createSearchFormOptions(pageFilter),
  gridOptions,
});

async function openFormModal(row?: ClientPageConfigPageResponseDto) {
  let record;
  if (row) {
    record = await clientPageDetailByIdApi({ id: row.id });
  }
  formApi.setData({ title: '页面配置', record }).open();
}

async function handleSubmit(
  values: BasePageConfigFieldsDto | UpdateClientPageConfigDto,
) {
  await (values?.id
    ? clientPageUpdateApi(values as UpdateClientPageConfigDto)
    : clientPageCreateApi(values as BasePageConfigFieldsDto));
  formApi.close();
  useMessage.success('操作成功');
  gridApi.reload();
}

async function deletePage(record: ClientPageConfigPageResponseDto) {
  await clientPageBatchDeleteApi({ ids: [record.id] });
  useMessage.success('操作成功');
  gridApi.reload();
}

const [DetailModal, detailApi] = useVbenModal({
  connectedComponent: PageDetail,
});
</script>

<template>
  <Page auto-content-height>
    <Grid>
      <template #toolbar-actions>
        <el-button class="ml-2" type="primary" @click="openFormModal()">
          添加
        </el-button>
      </template>

      <template #accessLevel="{ row }">
        <el-text :style="{ color: accessLevelObj[row.accessLevel]?.color }">
          {{ accessLevelObj[row.accessLevel]?.label }}
        </el-text>
      </template>

      <template #pageStatus="{ row }">
        <el-text :style="{ color: pageStatusObj[row.pageStatus]?.color }">
          {{ pageStatusObj[row.pageStatus]?.label }}
        </el-text>
      </template>

      <template #actions="{ row }">
        <div class="my-1">
          <el-button
            link
            type="primary"
            @click="detailApi.setData({ recordId: row.id }).open()"
          >
            查看
          </el-button>
          <el-divider direction="vertical" />
          <el-button link type="primary" @click="openFormModal(row)">
            编辑
          </el-button>
          <el-divider direction="vertical" />
          <el-popconfirm
            title="确认删除当前项?"
            confirm-button-text="确认"
            cancel-button-text="取消"
            @confirm="deletePage(row)"
          >
            <template #reference>
              <el-button link type="danger">删除</el-button>
            </template>
          </el-popconfirm>
        </div>
      </template>
    </Grid>

    <Form :schema="formSchema" :on-submit="handleSubmit" />

    <DetailModal />
  </Page>
</template>

<style scoped></style>
