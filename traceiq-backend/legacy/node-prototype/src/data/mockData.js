export const database = {
  suppliers: [
    { id: 'SUP-01', name: 'Apex Materials Ltd.', riskScore: 12, country: 'Germany', category: 'Active Pharmaceutical Ingredients' },
    { id: 'SUP-02', name: 'Global Synthetics Inc.', riskScore: 45, country: 'United States', category: 'Excipients & Chemical Polymers' },
    { id: 'SUP-03', name: 'Naturals Co.', riskScore: 5, country: 'India', category: 'Organic Botanical Solvents' }
  ],
  lots: [
    { id: 'RAW-1041', type: 'RAW', supplierId: 'SUP-01', name: 'Sodium Chloride USP / Pure Salt Matrix', qty: 1000, uom: 'kg', status: 'OK' },
    { id: 'RAW-1042', type: 'RAW', supplierId: 'SUP-01', name: 'Bio-Active Solvent 99% (Defective Solvent)', qty: 2000, uom: 'kg', status: 'WARNING' },
    { id: 'FG-3001', type: 'FG', name: 'NutriShield Oral Suspension 100ml', qty: 500, uom: 'units', status: 'OK' }
  ],
  productionOrders: [
    { id: 'PO-2001', inputLots: [{ id: 'RAW-1042', qty: 500 }], outputLot: 'FG-3001', productName: 'NutriShield Oral Suspension 100ml', status: 'COMPLETED', facility: 'Plant Delta (Austin, TX)' }
  ],
  warehouses: [
    { id: 'WH-East', name: 'Eastern Distribution Center', location: 'Boston, MA (Hub 01)' }
  ],
  inventory: [
    { id: 'INV-1', lotId: 'FG-3001', warehouseId: 'WH-East', qty: 200, status: 'OK', bay: 'Bay-E04' }
  ],
  customers: [
    { id: 'CUST-A', name: 'Alpha Retail Corp', location: 'Woonsocket, RI' }
  ],
  shipments: [
    { id: 'SHP-001', lotId: 'FG-3001', customerId: 'CUST-A', qty: 200, status: 'IN_TRANSIT', date: '2026-10-20', tracking: 'TRK-1001', recallStatus: 'NOTIFIED' }
  ],
  auditEvents: [
    { id: 'AUD-001', timestamp: '2026-10-20T09:00:00Z', actor: 'Ops Team', action: 'Lot flagged', target: 'RAW-1042', details: 'Lot was flagged for solvent quality review.' }
  ]
};

export const dashboardSummary = {
  suppliers: 3,
  rawLots: 2,
  finishedGoods: 1,
  incidents: 1
};

export const traceabilityGraph = {
  targetId: 'RAW-1042',
  suppliers: ['SUP-01'],
  rawLots: ['RAW-1042'],
  pos: ['PO-2001'],
  fgLots: ['FG-3001'],
  inventory: ['INV-1'],
  shipments: ['SHP-001'],
  customers: ['CUST-A'],
  missingLots: [],
  edges: [
    {
      id: 'e-SUP-01-RAW-1042',
      source: 'SUP-01',
      target: 'RAW-1042',
      sourceType: 'supplier',
      targetType: 'raw',
      label: 'supplier -> raw',
      status: 'WARNING',
      isAnomaly: true
    }
  ]
};
