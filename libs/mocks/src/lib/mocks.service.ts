import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class MocksService {
  getKpi() {
    return { title: 'Total Spend (YTD)', value: 'SAR 1.25M', delta: '+4.7%' };
  }

  getTable() {
    const rows = [
      { po: 'PO-1024', vendor: 'ABC Plastics', amount: 42800, status: 'Approved', date: '2025-09-12' },
      { po: 'PO-1025', vendor: 'Zahra Caps', amount: 19300, status: 'Pending', date: '2025-09-18' },
      { po: 'PO-1026', vendor: 'Gulf Labels', amount: 77250, status: 'Received', date: '2025-10-01' },
      { po: 'PO-1027', vendor: 'Oasis Bottling', amount: 153400, status: 'Shipped', date: '2025-10-07' },
      { po: 'PO-1028', vendor: 'Preform Co.', amount: 64800, status: 'Approved', date: '2025-10-10' },
    ];
    return { rows };
  }

  getMonthlyFlow() {
    return {
      months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      inbound: [120, 150, 180, 160, 210, 190, 220, 205, 230, 240, 260, 275],
      outbound: [100, 130, 170, 150, 190, 175, 205, 198, 215, 225, 245, 260],
    };
  }
}
