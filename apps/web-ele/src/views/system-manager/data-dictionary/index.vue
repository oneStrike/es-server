<script setup lang="ts">
import type { VxeGridProps } from '@vben/plugins/vxe-table';

import type { DictionaryDto } from '#/apis/types/dictionary';

import { Page, useVbenModal } from '@vben/common-ui';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  dictionaryBatchUpdateStatusApi,
  dictionaryCreateApi,
  dictionaryDeleteApi,
  dictionaryDetailApi,
  dictionaryPageApi,
  dictionaryUpdateApi,
} from '#/apis';
import EsModalForm from '#/components/es-modal-form/index.vue';
import { useMessage } from '#/hooks/useFeedback';
import { createSearchFormOptions } from '#/utils';

import DictionaryItem from './item.vue';
import {
  dictionaryColumns,
  dictionarySearchSchema,
  formSchema,
} from './shared';

const gridOptions: VxeGridProps<DictionaryDto> = {
  columns: dictionaryColumns,
  height: 'auto',
  proxyConfig: {
    ajax: {
      query: async ({ page }, formValues) => {
        return await dictionaryPageApi({
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
  formOptions: createSearchFormOptions(dictionarySearchSchema, {
    showCollapseButton: false,
  }),
});

async function deleteDictionary(row: DictionaryDto) {
  await dictionaryDeleteApi({ ids: [row.id] });
  useMessage.success('操作成功');
  gridApi.reload();
}

const [Form, formApi] = useVbenModal({
  connectedComponent: EsModalForm,
});
async function openFormModal(row?: DictionaryDto) {
  let record;
  if (row) {
    record = await dictionaryDetailApi({ id: row.id });
  }
  formApi
    .setData({
      title: '数据字典',
      record,
      cols: 1,
    })
    .open();
}

async function toggleEnableStatus(row: DictionaryDto) {
  const newStatus = !row.isEnabled;
  row.loading = true;
  try {
    await dictionaryBatchUpdateStatusApi({
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
async function addDictionary(values: any) {
  await (values.id ? dictionaryUpdateApi(values) : dictionaryCreateApi(values));
  useMessage.success('操作成功');
  formApi.close();
  gridApi.reload();
}

const [Detail, detailApi] = useVbenModal({
  connectedComponent: DictionaryItem,
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
      <template #name="{ row }">
        <el-text
          class="cursor-pointer hover:opacity-50"
          type="primary"
          @click="detailApi.setData({ record: row }).open()"
        >
          {{ row.name }}
        </el-text>
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

      <template #actions="{ row }">
        <el-button link type="primary" @click="openFormModal(row)">
          编辑
        </el-button>
        <el-divider direction="vertical" />
        <el-popconfirm
          title="确认删除当前项?"
          confirm-button-text="确认"
          cancel-button-text="取消"
          @confirm="deleteDictionary(row)"
        >
          <template #reference>
            <el-button link type="danger">删除</el-button>
          </template>
        </el-popconfirm>
      </template>
    </Grid>

    <Form :schema="formSchema" :on-submit="addDictionary" />

    <Detail />
  </Page>
</template>

<style scoped></style>
