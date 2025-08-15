export interface EsEditorProps {
  placeholder?: string;
  enabled?: boolean;
  height?: number;
  readonly?: boolean;
  editableRoot?: boolean;
  plugins?: string | string[];
  toolbar?: boolean | string | string[];
}
