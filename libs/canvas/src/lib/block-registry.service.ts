import { Injectable } from '@angular/core';
import { BlockKind, BlockRenderer } from './block-types';

type FeatureBadgeTone = 'positive' | 'negative' | 'warning' | 'info';

interface FeatureMetric {
  label: string;
  value: string;
  trend?: string;
  trendTone?: FeatureBadgeTone;
}

interface FeatureItem {
  title: string;
  subtitle?: string;
  badge?: string;
  badgeTone?: FeatureBadgeTone;
}

interface FeatureConfig {
  description?: string;
  metrics?: FeatureMetric[];
  items?: FeatureItem[];
  pills?: string[];
  footer?: string;
}

@Injectable({ providedIn: 'root' })
export class BlockRegistry implements BlockRenderer {
  render(kind: BlockKind, data?: any): string {
    switch (kind) {
      case 'kpi':
        return this.kpi(data);
      case 'table':
        return this.table(data);
      case 'chart':
        return this.chart();
      case 'agenda':
        return this.agenda();
      case 'tasks':
        return '<ncs-tasks-block></ncs-tasks-block>';
      case 'subtasks':
        return '<ncs-subtasks-block></ncs-subtasks-block>';
      case 'recents':
        return this.featureBlock({
          description: 'Jump back into the work you touched most recently.',
          items: [
            {
              title: 'Vendor Compliance Dashboard',
              subtitle: 'Dashboard · Viewed 2 hours ago',
            },
            {
              title: 'Q4 Procurement Plan',
              subtitle: 'Doc · Edited yesterday',
            },
            {
              title: 'Inbound Logistics Board',
              subtitle: 'Board · Viewed 3 days ago',
            },
          ],
          footer: 'View all recents',
        });
      case 'my-work':
        return this.featureBlock({
          metrics: [
            { label: 'Open tasks', value: '12', trend: '+3 this week', trendTone: 'warning' },
            { label: 'Due today', value: '2', trend: 'On track', trendTone: 'positive' },
            { label: 'Overdue', value: '1', trend: '-1 vs last week', trendTone: 'positive' },
          ],
          items: [
            {
              title: 'Finalize supplier shortlist',
              subtitle: 'Due today · Logistics',
              badge: 'In Progress',
              badgeTone: 'info',
            },
            {
              title: 'Approve budget requests',
              subtitle: 'Due tomorrow · Finance',
              badge: 'Needs review',
              badgeTone: 'warning',
            },
            {
              title: 'Schedule onboarding',
              subtitle: 'Due Friday · People Ops',
              badge: 'Blocked',
              badgeTone: 'negative',
            },
          ],
          footer: 'Open My Work',
        });
      case 'assigned-to-me':
        return this.featureBlock({
          metrics: [
            { label: 'Assignments', value: '18', trend: '4 new this week', trendTone: 'info' },
            { label: 'Completed', value: '7', trend: '↑2 since Monday', trendTone: 'positive' },
          ],
          items: [
            {
              title: 'Audit vendor SLAs',
              subtitle: 'Supply Chain · Due in 3 days',
              badge: 'High',
              badgeTone: 'warning',
            },
            {
              title: 'Review QA report',
              subtitle: 'Quality · Due in 5 days',
              badge: 'Medium',
              badgeTone: 'info',
            },
            {
              title: 'Close out SOW',
              subtitle: 'Procurement · Due next week',
              badge: 'Low',
              badgeTone: 'positive',
            },
          ],
          footer: 'View assigned items',
        });
      case 'task-statuses':
        return this.featureBlock({
          description: 'Track how work is moving through your workflow.',
          metrics: [
            { label: 'Todo', value: '24' },
            { label: 'In Progress', value: '14', trend: '+2 today', trendTone: 'info' },
            { label: 'Review', value: '6', trend: 'Needs attention', trendTone: 'warning' },
            { label: 'Done', value: '32', trend: '↑5 since yesterday', trendTone: 'positive' },
          ],
          footer: 'Manage statuses',
        });
      case 'priorities':
        return this.featureBlock({
          description: 'See what needs focus first.',
          items: [
            {
              title: 'Fix supplier contract',
              subtitle: 'Due today',
              badge: 'Urgent',
              badgeTone: 'negative',
            },
            {
              title: 'Refresh safety playbook',
              subtitle: 'Due tomorrow',
              badge: 'High',
              badgeTone: 'warning',
            },
            {
              title: 'Archive Q2 assets',
              subtitle: 'Due next week',
              badge: 'Medium',
              badgeTone: 'info',
            },
          ],
          footer: 'Prioritize work',
        });
      case 'views':
        return this.featureBlock({
          description: 'Switch between the views your team relies on.',
          pills: ['List', 'Board', 'Calendar', 'Timeline'],
          items: [
            {
              title: 'Weekly execution board',
              subtitle: 'Board · Operations',
              badge: 'Pinned',
              badgeTone: 'info',
            },
            {
              title: 'Hiring pipeline',
              subtitle: 'List · People',
              badge: 'Automation',
              badgeTone: 'positive',
            },
            {
              title: 'Global events',
              subtitle: 'Calendar · Marketing',
              badge: 'Shared',
              badgeTone: 'info',
            },
          ],
          footer: 'Create a view',
        });
      case 'custom-fields':
        return this.featureBlock({
          description: 'Capture the metadata your process needs.',
          metrics: [
            { label: 'Active fields', value: '36', trend: '5 dropdowns', trendTone: 'info' },
            { label: 'Recently used', value: '14', trend: 'Across 4 teams', trendTone: 'positive' },
          ],
          items: [
            {
              title: 'Vendor tier',
              subtitle: 'Dropdown · Procurement',
              badge: 'High usage',
              badgeTone: 'positive',
            },
            {
              title: 'Risk score',
              subtitle: 'Formula · Compliance',
              badge: 'In review',
              badgeTone: 'warning',
            },
            {
              title: 'Region',
              subtitle: 'Text · Logistics',
              badge: 'Mapped',
              badgeTone: 'info',
            },
          ],
          footer: 'Manage fields',
        });
      case 'automations':
        return this.featureBlock({
          description: 'Automate routine updates and notifications.',
          metrics: [
            { label: 'Runs this week', value: '128', trend: 'Saved 9h', trendTone: 'positive' },
            { label: 'Failures', value: '2', trend: 'Investigate approvals', trendTone: 'warning' },
          ],
          items: [
            {
              title: 'Slack daily summary',
              subtitle: 'Triggers at 09:00 AM',
              badge: 'Active',
              badgeTone: 'positive',
            },
            {
              title: 'Escalate overdue tasks',
              subtitle: 'When due date passes',
              badge: 'Active',
              badgeTone: 'positive',
            },
            {
              title: 'Intake triage',
              subtitle: 'Route by priority',
              badge: 'Paused',
              badgeTone: 'warning',
            },
          ],
          footer: 'Open automations',
        });
      case 'docs':
        return this.featureBlock({
          description: 'Docs that teammates opened recently.',
          items: [
            {
              title: 'Supplier onboarding playbook',
              subtitle: 'Edited by Rana · 3 min ago',
              badge: 'Shared',
              badgeTone: 'info',
            },
            {
              title: 'Q1 retrospectives',
              subtitle: 'Commented by Yara · 1 hour ago',
              badge: 'Comments',
              badgeTone: 'positive',
            },
            {
              title: 'Audit checklist',
              subtitle: 'Viewed by 8 people today',
              badge: 'Template',
              badgeTone: 'info',
            },
          ],
          footer: 'Browse docs',
        });
      case 'whiteboards':
        return this.featureBlock({
          description: 'Whiteboards in active collaboration.',
          items: [
            {
              title: 'Launch planning',
              subtitle: 'Live cursors · 4 collaborators',
              badge: 'Active',
              badgeTone: 'positive',
            },
            {
              title: 'Customer journey mapping',
              subtitle: 'Updated 2 hours ago',
              badge: 'Review',
              badgeTone: 'warning',
            },
            {
              title: 'Process redesign',
              subtitle: 'Last touched yesterday',
              badge: 'Archived soon',
              badgeTone: 'warning',
            },
          ],
          footer: 'Open whiteboards',
        });
      case 'dashboards':
        return this.featureBlock({
          metrics: [
            { label: 'Dashboards', value: '9', trend: '3 shared externally', trendTone: 'info' },
            { label: 'KPIs on track', value: '78%', trend: '↑5% vs last month', trendTone: 'positive' },
            { label: 'Alerts', value: '2', trend: 'Needs review', trendTone: 'warning' },
          ],
          items: [
            {
              title: 'Spend vs budget',
              subtitle: 'Finance · Updated today',
              badge: 'Pinned',
              badgeTone: 'info',
            },
            {
              title: 'Supplier performance',
              subtitle: 'Supply Chain · Updated 2h ago',
              badge: 'AI forecast',
              badgeTone: 'positive',
            },
          ],
          footer: 'View dashboards',
        });
      case 'time-tracking':
        return this.featureBlock({
          metrics: [
            { label: 'Logged this week', value: '142 h', trend: '+12% vs last week', trendTone: 'positive' },
            { label: 'Billable', value: '118 h', trend: '83% billable', trendTone: 'info' },
          ],
          items: [
            {
              title: 'Ali logged 6h on Vendor audit',
              subtitle: 'Today · Procurement',
            },
            {
              title: 'Fatima started timer on Q4 rollout',
              subtitle: 'Running · Product',
              badge: 'Live',
              badgeTone: 'positive',
            },
            {
              title: 'Sara submitted 4h for approval',
              subtitle: 'Pending · Finance',
              badge: 'Needs approval',
              badgeTone: 'warning',
            },
          ],
          footer: 'Track time',
        });
      case 'goals-okrs':
        return this.featureBlock({
          metrics: [
            { label: 'Company goals', value: '12', trend: '4 at risk', trendTone: 'warning' },
            { label: 'Progress', value: '67%', trend: '↑8% this quarter', trendTone: 'positive' },
          ],
          items: [
            {
              title: 'Reduce procurement cycle to 8 days',
              subtitle: 'Key result · 72% complete',
              badge: 'On track',
              badgeTone: 'positive',
            },
            {
              title: 'Launch supplier academy',
              subtitle: 'Key result · 45% complete',
              badge: 'At risk',
              badgeTone: 'warning',
            },
            {
              title: 'Increase NPS to 45',
              subtitle: 'Key result · 30% complete',
              badge: 'Behind',
              badgeTone: 'negative',
            },
          ],
          footer: 'Review goals',
        });
      case 'sprints-boards':
        return this.featureBlock({
          description: 'Stay aligned on sprint delivery.',
          metrics: [
            { label: 'Stories', value: '46', trend: 'Sprint Atlas · Week 5', trendTone: 'info' },
            { label: 'Velocity', value: '38 pts', trend: '↑6 pts vs avg', trendTone: 'positive' },
          ],
          items: [
            {
              title: 'Doing',
              subtitle: '12 items',
              badge: 'Focus',
              badgeTone: 'info',
            },
            {
              title: 'Review',
              subtitle: '5 items',
              badge: 'Needs QA',
              badgeTone: 'warning',
            },
            {
              title: 'Blocked',
              subtitle: '3 items',
              badge: 'Escalate',
              badgeTone: 'negative',
            },
          ],
          footer: 'Open sprint board',
        });
      case 'forms':
        return this.featureBlock({
          description: 'Collect structured requests from teams.',
          items: [
            {
              title: 'Vendor intake form',
              subtitle: '28 submissions this week',
              badge: 'Automation',
              badgeTone: 'positive',
            },
            {
              title: 'IT access request',
              subtitle: '7 pending approvals',
              badge: 'Action required',
              badgeTone: 'warning',
            },
            {
              title: 'Marketing brief',
              subtitle: 'New responses today',
              badge: 'Shared',
              badgeTone: 'info',
            },
          ],
          footer: 'Manage forms',
        });
      case 'integrations':
        return this.featureBlock({
          description: 'Connect your stack to sync work automatically.',
          items: [
            {
              title: 'Slack',
              subtitle: 'Channel alerts · Connected',
              badge: 'Active',
              badgeTone: 'positive',
            },
            {
              title: 'Gmail',
              subtitle: 'Task creation from email',
              badge: 'Needs setup',
              badgeTone: 'warning',
            },
            {
              title: 'SAP',
              subtitle: 'Procurement data sync',
              badge: 'Coming soon',
              badgeTone: 'info',
            },
          ],
          footer: 'Browse integrations',
        });
      default:
        return `<div>Unknown block</div>`;
    }
  }

  private kpi(data: any) {
    const title = data?.title ?? 'Total Spend';
    const value = data?.value ?? 'SAR 1.25M';
    const delta = data?.delta ?? '+4.7%';
    return `
      <div style="display:grid;grid-template-columns:1fr auto;align-items:center;height:100%;">
        <div><div style="font-size:12px;color:#6b7280">${title}</div>
        <div style="font-size:28px;font-weight:800;color:#111827">${value}</div></div>
        <div style="font-size:11px;color:#059669;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:4px 8px;">${delta}</div>
      </div>`;
  }

  private table(data: any) {
    const rows =
      (data?.rows ?? [])
        .map(
          (row: any) => `
      <tr><td style="padding:6px 4px;">${row.po}</td><td style="padding:6px 4px;">${row.vendor}</td><td style="padding:6px 4px;">${row.amount}</td></tr>
    `,
        )
        .join('') ||
      `<tr><td colspan="3" style="padding:10px;color:#6b7280;">No data</td></tr>`;
    return `
      <div style="overflow:auto;">
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr>
            <th style="text-align:left;border-bottom:1px solid #e5e7eb;padding:6px 4px;">PO</th>
            <th style="text-align:left;border-bottom:1px solid #e5e7eb;padding:6px 4px;">Vendor</th>
            <th style="text-align:left;border-bottom:1px solid #e5e7eb;padding:6px 4px;">Amount</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  private chart() {
    return `<div style="height:100%;display:grid;place-items:center;color:#6b7280;">Chart Placeholder</div>`;
  }

  private agenda() {
    return `<ncs-agenda-block></ncs-agenda-block>`;
  }

  private featureBlock(config: FeatureConfig) {
    const description = config.description
      ? `<p class="feature-block__description">${config.description}</p>`
      : '';
    const metrics = Array.isArray(config.metrics) && config.metrics.length > 0
      ? `<div class="feature-block__metrics">${config.metrics
          .map((metric) => {
            const trend =
              metric.trend != null && metric.trend.length > 0
                ? `<span class="feature-block__trend feature-block__trend--${metric.trendTone ?? 'info'}">${metric.trend}</span>`
                : '';
            return `<div class="feature-block__metric"><div class="feature-block__metric-value">${metric.value}</div><div class="feature-block__metric-label">${metric.label}</div>${trend}</div>`;
          })
          .join('')}</div>`
      : '';
    const pills = Array.isArray(config.pills) && config.pills.length > 0
      ? `<div class="feature-block__pills">${config.pills
          .map((pill) => `<span class="feature-block__pill">${pill}</span>`)
          .join('')}</div>`
      : '';
    const items = Array.isArray(config.items) && config.items.length > 0
      ? `<ul class="feature-block__list">${config.items
          .map((item) => {
            const badge =
              item.badge != null && item.badge.length > 0
                ? `<span class="feature-block__badge${
                    item.badgeTone ? ` feature-block__badge--${item.badgeTone}` : ''
                  }">${item.badge}</span>`
                : '';
            const subtitle =
              item.subtitle != null && item.subtitle.length > 0
                ? `<span class="feature-block__item-subtitle">${item.subtitle}</span>`
                : '';
            return `<li class="feature-block__item"><div class="feature-block__item-text"><span class="feature-block__item-title">${item.title}</span>${subtitle}</div>${badge}</li>`;
          })
          .join('')}</ul>`
      : '';
    const footer =
      config.footer != null && config.footer.length > 0
        ? `<button type="button" class="feature-block__cta">${config.footer}</button>`
        : '';
    return `<div class="feature-block">${description}${metrics}${pills}${items}${footer}</div>`;
  }
}
