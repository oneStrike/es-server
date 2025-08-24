<script setup lang="ts">
import type { VxeGridProps } from '#/adapter/vxe-table';
import type { DictionaryDto, DictionaryItemDto } from '#/apis/types/dictionary';

import { useVbenModal } from '@vben/common-ui';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  createDictionaryItemApi,
  deleteDictionaryItemApi,
  dictionaryItemsApi,
  updateDictionaryItemApi,
  updateDictionaryItemStatusApi,
} from '#/apis';
import EsModalForm from '#/components/es-modal-form/index.vue';
import { useMessage } from '#/hooks/useFeedback';
import { createSearchFormOptions } from '#/utils';

import {
  dictionaryItemColumns,
  dictionarySearchSchema,
  itemFormSchema,
} from './shared';

type ShareData = {
  record: DictionaryDto;
};

defineOptions({
  name: 'DictionaryItem',
});

const shareData = ref<ShareData>();

const gridOptions: VxeGridProps<DictionaryItemDto> = {
  columns: dictionaryItemColumns,
  height: 'auto',
  proxyConfig: {
    ajax: {
      query: async ({ page }, formValues) => {
        const data = await dictionaryItemsApi({
          pageIndex: --page.currentPage,
          pageSize: page.pageSize,
          dictionaryCode: shareData.value?.record.code,
          ...formValues,
        });
        return {
          list: data,
          total: data.length,
        };
      },
    },
    sort: true,
  },
};

const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions,
  formOptions: createSearchFormOptions(dictionarySearchSchema, {
    wrapperClass: 'grid-cols-3 gap-4',
    showCollapseButton: false,
  }),
});

const [Modal, modalApi] = useVbenModal({
  onOpenChange(isOpen) {
    if (isOpen) {
      shareData.value = modalApi.getData<ShareData>();
      modalApi.setState({
        title: shareData.value.record.name,
      });
    }
  },
});

const [Form, formApi] = useVbenModal({
  connectedComponent: EsModalForm,
});

async function addDictionaryItem(values: any) {
  if (!values.dictionaryCode) {
    values.dictionaryCode = shareData.value!.record.code;
  }
  await (values.id
    ? updateDictionaryItemApi(values)
    : createDictionaryItemApi(values));

  formApi.close();
  useMessage.success('操作成功');
  gridApi.reload();
}

async function toggleEnableStatus(row: DictionaryDto) {
  const newStatus = !row.isEnabled;
  row.loading = true;
  try {
    await updateDictionaryItemStatusApi({
      ids: [row.id],
      isEnabled: newStatus,
    });
    useMessage.success('操作成功');
    gridApi.reload();
  } finally {
    row.loading = false;
  }
}

async function openFormModal(row?: DictionaryDto) {
  formApi
    .setData({
      title: '数据字典子项',
      record: row || null,
      cols: 1,
    })
    .open();
}

async function deleteDictionary(row: DictionaryDto) {
  await deleteDictionaryItemApi({ ids: [row.id] });
  useMessage.success('操作成功');
  gridApi.reload();
}
</script>

<template>
  <Modal class="h-[1000px] w-[1200px]" v-if="shareData">
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

    <Form :schema="itemFormSchema" :on-submit="addDictionaryItem" />
  </Modal>
</template>
