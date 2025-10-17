import { Injectable } from '@angular/core';
import { BlockKind, BlockRenderer } from './block-types';

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
}
