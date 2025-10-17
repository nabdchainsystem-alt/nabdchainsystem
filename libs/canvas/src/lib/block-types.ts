export type BlockKind = 'kpi' | 'table' | 'chart';

export interface BlockRenderer {
  render(kind: BlockKind, data?: unknown): string;
}
