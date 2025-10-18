export type BlockKind =
  | 'kpi'
  | 'table'
  | 'chart'
  | 'agenda'
  | 'tasks'
  | 'subtasks'
  | 'recents'
  | 'my-work'
  | 'assigned-to-me'
  | 'task-statuses'
  | 'priorities'
  | 'views'
  | 'custom-fields'
  | 'automations'
  | 'docs'
  | 'whiteboards'
  | 'dashboards'
  | 'time-tracking'
  | 'goals-okrs'
  | 'sprints-boards'
  | 'forms'
  | 'integrations';

export interface BlockRenderer {
  render(kind: BlockKind, data?: unknown): string;
}
