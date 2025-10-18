export interface ToolDescriptor {
  id: string;
  name: string;
  icon: string;
  description: string;
  accent: string;
  badge?: string;
}

export const tools: ToolDescriptor[] = [
  {
    id: 'ai-standup',
    name: 'AI StandUp™',
    icon: 'lucideSparkles',
    description: "AI-generated daily standup with NABD's tone.",
    accent: 'linear-gradient(140deg, #7c3aed, #6366f1)',
    badge: 'New',
  },
  {
    id: 'recents',
    name: 'Recents',
    icon: 'lucideClock3',
    description: 'Quick access to recently viewed items.',
    accent: 'linear-gradient(140deg, #0ea5e9, #38bdf8)',
  },
  {
    id: 'agenda',
    name: 'Agenda',
    icon: 'lucideCalendarDays',
    description: 'Visualize events and calendars in one place.',
    accent: 'linear-gradient(140deg, #a855f7, #ec4899)',
  },
  {
    id: 'my-work',
    name: 'My Work',
    icon: 'lucideBriefcase',
    description: 'Your assigned tasks and reminders.',
    accent: 'linear-gradient(140deg, #10b981, #14b8a6)',
  },
  {
    id: 'assigned-to-me',
    name: 'Assigned to Me',
    icon: 'lucideUserCheck',
    description: 'Items assigned to you across spaces.',
    accent: 'linear-gradient(140deg, #6366f1, #3b82f6)',
  },
  {
    id: 'tasks',
    name: 'Tasks',
    icon: 'lucideCheckSquare',
    description: 'Create, assign and track work items.',
    accent: 'linear-gradient(140deg, #fb7185, #f97316)',
  },
  {
    id: 'subtasks',
    name: 'Subtasks',
    icon: 'lucideListOrdered',
    description: 'Break down large tasks into smaller units.',
    accent: 'linear-gradient(140deg, #8b5cf6, #6366f1)',
  },
  {
    id: 'task-statuses',
    name: 'Task Statuses',
    icon: 'lucideTrafficCone',
    description: 'Custom status workflows.',
    accent: 'linear-gradient(140deg, #f59e0b, #f97316)',
  },
  {
    id: 'priorities',
    name: 'Priorities',
    icon: 'lucideFlag',
    description: 'Highlight urgency and manage focus.',
    accent: 'linear-gradient(140deg, #f97316, #ef4444)',
  },
  {
    id: 'views',
    name: 'Views (List/Board/Calendar/Timeline)',
    icon: 'lucideLayoutGrid',
    description: 'Visualize your data your way.',
    accent: 'linear-gradient(140deg, #0ea5e9, #6366f1)',
  },
  {
    id: 'custom-fields',
    name: 'Custom Fields',
    icon: 'lucideTable2',
    description: 'Track what matters for your workflow.',
    accent: 'linear-gradient(140deg, #14b8a6, #0ea5e9)',
  },
  {
    id: 'automations',
    name: 'Automations',
    icon: 'lucideBolt',
    description: 'Trigger actions to save time.',
    accent: 'linear-gradient(140deg, #e11d48, #f97316)',
  },
  {
    id: 'docs',
    name: 'Docs',
    icon: 'lucideFileText',
    description: 'Collaborative knowledge hub.',
    accent: 'linear-gradient(140deg, #6366f1, #2563eb)',
  },
  {
    id: 'whiteboards',
    name: 'Whiteboards',
    icon: 'lucidePenSquare',
    description: 'Brainstorm visually with shapes & tasks.',
    accent: 'linear-gradient(140deg, #f472b6, #ec4899)',
  },
  {
    id: 'dashboards',
    name: 'Dashboards',
    icon: 'lucideBarChart2',
    description: 'KPIs and progress in one view.',
    accent: 'linear-gradient(140deg, #22d3ee, #3b82f6)',
  },
  {
    id: 'time-tracking',
    name: 'Time Tracking',
    icon: 'lucideTimer',
    description: 'Record effort with a timer.',
    accent: 'linear-gradient(140deg, #8b5cf6, #22d3ee)',
  },
  {
    id: 'goals-okrs',
    name: 'Goals & OKRs',
    icon: 'lucideTarget',
    description: 'Track strategic outcomes.',
    accent: 'linear-gradient(140deg, #10b981, #2563eb)',
  },
  {
    id: 'sprints-boards',
    name: 'Sprints/Boards',
    icon: 'lucideKanbanSquare',
    description: 'Agile planning & execution.',
    accent: 'linear-gradient(140deg, #f97316, #ea580c)',
  },
  {
    id: 'forms',
    name: 'Forms',
    icon: 'lucideClipboardList',
    description: 'Intake requests with structured fields.',
    accent: 'linear-gradient(140deg, #3b82f6, #0284c7)',
  },
  {
    id: 'integrations',
    name: 'Integrations',
    icon: 'lucidePlugZap',
    description: 'Connect Slack, Gmail and more.',
    accent: 'linear-gradient(140deg, #6366f1, #a855f7)',
  },
];
