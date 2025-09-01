<script setup lang="ts">
import type { VxeGridProps } from '@vben/plugins/vxe-table';

import type { EsTableProps } from './types';

import type { DictionaryDto } from '#/apis/types/dictionary';

import { Page, useVbenModal } from '@vben/common-ui';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import EsModalForm from '#/components/es-modal-form/index.vue';
import { useMessage } from '#/hooks/useFeedback';
import { createSearchFormOptions } from '#/utils';

const props = withDefaults(defineProps<EsTableProps>(), {});

const gridOptions: VxeGridProps = {
  columns: props.columns,
  height: 'auto',
  proxyConfig: {
    ajax: {
      query: async ({ page }, formValues) => {
        return await props.listApi({
          pageIndex: --page.currentPage,
          pageSize: page.pageSize,
          ...formValues,
        });
      },
    },
    sort: true,
  },
};

const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions,
  formOptions: createSearchFormOptions(props.searchSchema),
});

async function deleteRecord(row: DictionaryDto) {
  await props.deleteApi({ ids: [row.id] });
  useMessage.success('操作成功');
  gridApi.reload();
}

const [Form, formApi] = useVbenModal({
  connectedComponent: EsModalForm,
});
async function openFormModal(row?: DictionaryDto) {
  let record;
  if (row) {
    record = props.detailApi ? await props.detailApi({ id: row.id }) : row;
  }
  formApi
    .setData({
      record,
      cols: 1,
    })
    .open();
}

async function toggleEnableStatus(row: DictionaryDto) {
  const newStatus = !row.isEnabled;
  row.loading = true;
  try {
    await props.statusApi({
      ids: [row.id],
      isEnabled: newStatus,
    });
    useMessage.success('操作成功');
    gridApi.reload();
  } finally {
    row.loading = false;
  }
}

// 添加数据字典
async function handleForm(values: any) {
  await (values.id ? props.updateApi(values) : props.createApi(values));
  useMessage.success('操作成功');
  formApi.close();
  gridApi.reload();
}
</script>

<template>
  <Page auto-content-height>
    <Grid>
      <template #toolbar-actions v-if="createApi">
        <el-button class="ml-2" type="primary" @click="openFormModal()">
          添加
        </el-button>
      </template>
      <template #isEnabled="{ row }" v-if="statusApi">
        <el-switch
          :active-value="true"
          :inactive-value="row.isEnabled"
          :loading="row.loading"
          :model-value="row.isEnabled"
          @change="toggleEnableStatus(row)"
        />
      </template>

      <template #actions="{ row }">
        <el-button
          link
          type="primary"
          @click="openFormModal(row)"
          v-if="createApi"
        >
          编辑
        </el-button>
        <el-divider direction="vertical" />
        <el-popconfirm
          v-if="deleteApi"
          title="确认删除当前项?"
          confirm-button-text="确认"
          cancel-button-text="取消"
          @confirm="deleteRecord(row)"
        >
          <template #reference>
            <el-button link type="danger">删除</el-button>
          </template>
        </el-popconfirm>
      </template>
    </Grid>

    <Form :schema="formSchema" :on-submit="handleForm" />
  </Page>
</template>

<style scoped></style>
