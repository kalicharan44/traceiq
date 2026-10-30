import { DatabaseState, STATUS } from '../types/nexusChain';

export const INITIAL_DATA: DatabaseState = {
  suppliers: [
    {
      id: 'SUP-01',
      name: 'Apex Materials Ltd.',
      riskScore: 12,
      country: 'Germany',
      category: 'Active Pharmaceutical Ingredients'
    },
    {
      id: 'SUP-02',
      name: 'Global Synthetics Inc.',
      riskScore: 45,
      country: 'United States',
      category: 'Excipients & Chemical Polymers'
    },
    {
      id: 'SUP-03',
      name: 'Naturals Co.',
      riskScore: 5,
      country: 'India',
      category: 'Organic Botanical Solvents'
    }
  ],
  lots: [
    {
      id: 'RAW-1041',
      type: 'RAW',
      supplierId: 'SUP-01',
      name: 'Sodium Chloride USP / Pure Salt Matrix',
      qty: 1000,
      uom: 'kg',
      status: STATUS.OK,
      receivedDate: '2026-10-01'
    },
    {
      id: 'RAW-1042',
      type: 'RAW',
      supplierId: 'SUP-01',
      name: 'Bio-Active Solvent 99% (Defective Solvent)',
      qty: 2000,
      uom: 'kg',
      status: STATUS.WARNING, // Target for recall protocol
      receivedDate: '2026-10-04'
    },
    {
      id: 'RAW-1043',
      type: 'RAW',
      supplierId: 'SUP-02',
      name: 'SoluPol Stabilizing Excipient Granules',
      qty: 500,
      uom: 'kg',
      status: STATUS.OK,
      receivedDate: '2026-10-06'
    },
    {
      id: 'RAW-9999',
      type: 'RAW',
      supplierId: 'SUP-03',
      name: 'Purified Botanical Glycerin Buffer',
      qty: 100,
      uom: 'kg',
      status: STATUS.OK,
      receivedDate: '2026-10-08'
    },
    {
      id: 'FG-3001',
      type: 'FG',
      name: 'NutriShield Oral Suspension 100ml',
      qty: 500,
      uom: 'units',
      status: STATUS.OK,
      receivedDate: '2026-10-12'
    },
    {
      id: 'FG-3002',
      type: 'FG',
      name: 'VitalBoost Sterile Injectable 50ml',
      qty: 1000,
      uom: 'units',
      status: STATUS.OK,
      receivedDate: '2026-10-14'
    },
    {
      id: 'FG-3003',
      type: 'FG',
      name: 'CardioGuard Extended-Release 60ct',
      qty: 800,
      uom: 'units',
      status: STATUS.OK,
      receivedDate: '2026-10-16'
    },
    {
      id: 'FG-4001',
      type: 'FG',
      name: 'DermaCare Clinical Ointment 75g',
      qty: 200,
      uom: 'units',
      status: STATUS.OK, // Anomaly 2: Produced 200, but SHP-003 shipped 500
      receivedDate: '2026-10-18'
    }
  ],
  productionOrders: [
    {
      id: 'PO-2001',
      inputLots: [{ id: 'RAW-1042', qty: 500 }],
      outputLot: 'FG-3001',
      productName: 'NutriShield Oral Suspension 100ml',
      facility: 'Plant Delta (Austin, TX)',
      status: 'COMPLETED',
      completedDate: '2026-10-12'
    },
    {
      id: 'PO-2002',
      inputLots: [
        { id: 'RAW-1042', qty: 1000 },
        { id: 'RAW-1043', qty: 200 }
      ],
      outputLot: 'FG-3002',
      productName: 'VitalBoost Sterile Injectable 50ml',
      facility: 'Plant Sigma (Raleigh, NC)',
      status: 'COMPLETED',
      completedDate: '2026-10-14'
    },
    {
      id: 'PO-2003',
      inputLots: [{ id: 'RAW-1041', qty: 800 }],
      outputLot: 'FG-3003',
      productName: 'CardioGuard Extended-Release 60ct',
      facility: 'Plant Delta (Austin, TX)',
      status: 'COMPLETED',
      completedDate: '2026-10-16'
    },
    {
      id: 'PO-9999',
      inputLots: [{ id: 'RAW-MISSING', qty: 100 }], // Anomaly 1: Missing upstream input
      outputLot: 'FG-4001',
      productName: 'DermaCare Clinical Ointment 75g',
      facility: 'Plant Omega (Chicago, IL)',
      status: 'COMPLETED',
      completedDate: '2026-10-18'
    }
  ],
  warehouses: [
    {
      id: 'WH-East',
      name: 'Eastern Distribution Center',
      location: 'Boston, MA (Hub 01)'
    },
    {
      id: 'WH-West',
      name: 'Western Hub Depot',
      location: 'Reno, NV (Hub 02)'
    }
  ],
  inventory: [
    {
      id: 'INV-1',
      lotId: 'FG-3001',
      warehouseId: 'WH-East',
      qty: 200,
      status: STATUS.OK,
      bay: 'Bay-E04'
    },
    {
      id: 'INV-2',
      lotId: 'FG-3002',
      warehouseId: 'WH-East',
      qty: 500,
      status: STATUS.OK,
      bay: 'Cold-Vault-C2'
    },
    {
      id: 'INV-3',
      lotId: 'FG-3003',
      warehouseId: 'WH-West',
      qty: 800,
      status: STATUS.OK,
      bay: 'Bay-W11'
    },
    {
      id: 'INV-4',
      lotId: 'RAW-1042',
      warehouseId: 'WH-East',
      qty: 500,
      status: STATUS.OK,
      bay: 'Chemical-Hold-08'
    }
  ],
  customers: [
    {
      id: 'CUST-A',
      name: 'Alpha Retail Corp',
      contact: 'Marcus Vance, VP Logistics',
      email: 'recalls@alpharetail.com',
      location: 'Woonsocket, RI',
      tier: 'Tier 1 Retail Pharmacy'
    },
    {
      id: 'CUST-B',
      name: 'Beta Distributors Ltd',
      contact: 'Sarah Jenkins, Chief Pharmacist',
      email: 'qa@betadistributors.com',
      location: 'Deerfield, IL',
      tier: 'Institutional Wholesaler'
    },
    {
      id: 'CUST-C',
      name: 'Gamma Healthcare Systems',
      contact: 'Dr. Robert Sterling, CMO',
      email: 'safety-desk@gammahealth.org',
      location: 'Dallas, TX',
      tier: 'Hospital Health Network'
    }
  ],
  shipments: [
    {
      id: 'SHP-001',
      lotId: 'FG-3001',
      customerId: 'CUST-A',
      qty: 300,
      status: STATUS.DELIVERED,
      date: '2026-10-15',
      carrier: 'FedEx Custom Critical',
      tracking: 'FDX-7712-A01'
    },
    {
      id: 'SHP-002',
      lotId: 'FG-3002',
      customerId: 'CUST-B',
      qty: 500,
      status: STATUS.IN_TRANSIT, // In-transit shipment connected to RAW-1042
      date: '2026-10-21',
      carrier: 'DHL TempAssure Express',
      tracking: 'DHL-4401-B02'
    },
    {
      id: 'SHP-003',
      lotId: 'FG-4001',
      customerId: 'CUST-C',
      qty: 500, // Anomaly 2: 500 shipped vs 200 produced!
      status: STATUS.DELIVERED,
      date: '2026-10-20',
      carrier: 'UPS Healthcare Freight',
      tracking: 'UPS-9902-C03'
    }
  ],
  auditEvents: [
    {
      id: 'AUD-1001',
      timestamp: '2026-10-27T14:30:00.000Z',
      actor: 'System Autonomous Monitor',
      action: 'DATA_GENERATED',
      target: 'ALL_MODULES',
      details: 'Synthetic multi-echelon supply chain network seeded with cGMP batch records.'
    },
    {
      id: 'AUD-1002',
      timestamp: '2026-10-27T16:15:20.000Z',
      actor: 'QA Compliance Officer',
      action: 'FLAG_APPLIED',
      target: 'RAW-1042',
      details: 'Assay alert flagged on lot RAW-1042: Potency variance detected from Apex Materials Ltd.'
    },
    {
      id: 'AUD-1003',
      timestamp: '2026-10-27T18:00:10.000Z',
      actor: 'Dock Receiving WH-East',
      action: 'STOCK_MOVEMENT',
      target: 'INV-4',
      details: 'Relocated 500 kg RAW-1042 to containment zone Chemical-Hold-08.'
    }
  ]
};
