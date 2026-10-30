import { 
  Supplier, 
  RawMaterialLot, 
  ProductionOrder, 
  FinishedGoodsLot, 
  WarehouseInventory, 
  Shipment, 
  Customer, 
  Anomaly, 
  AuditEvent 
} from '../types/supplyChain';

export const SEED_SUPPLIERS: Supplier[] = [
  {
    id: 'SUP-101',
    name: 'Apex Bio-Chemicals GmbH',
    location: 'Munich, Bavaria',
    country: 'Germany',
    status: 'Active',
    isoCert: 'ISO-9001:2020 / GMP-Verified',
    contactEmail: 'qa-intake@apex-biochem.de',
    riskScore: 8,
    tier: 'Tier 1'
  },
  {
    id: 'SUP-102',
    name: 'Terra Nutra Botanicals Ltd',
    location: 'Kerala',
    country: 'India',
    status: 'Active',
    isoCert: 'ISO-22000 / USDA-Organic',
    contactEmail: 'export.compliance@terranutra.in',
    riskScore: 14,
    tier: 'Tier 1'
  },
  {
    id: 'SUP-103',
    name: 'Pacific Marine Organics Corp',
    location: 'Seattle, WA',
    country: 'United States',
    status: 'Active',
    isoCert: 'FDA-cGMP 21 CFR Part 111',
    contactEmail: 'quality@pacificmarineorg.com',
    riskScore: 11,
    tier: 'Tier 1'
  },
  {
    id: 'SUP-104',
    name: 'Solis Agro Synthetics S.A.',
    location: 'São Paulo',
    country: 'Brazil',
    status: 'Under Audit',
    isoCert: 'Audit Flagged / Expired Oct 2026',
    contactEmail: 'contato@solisagro.com.br',
    riskScore: 78,
    tier: 'Tier 2'
  }
];

export const SEED_RAW_LOTS: RawMaterialLot[] = [
  {
    id: 'RAW-1042',
    name: 'Bio-Peptide Matrix 99% Pure Extract',
    supplierId: 'SUP-101',
    supplierName: 'Apex Bio-Chemicals GmbH',
    materialType: 'Active Pharmaceutical Ingredient (API)',
    receivedDate: '2026-10-02',
    initialQuantity: 2500,
    availableQuantity: 400,
    unit: 'kg',
    status: 'Active',
    purityPct: 99.4,
    storageConditions: 'Dry, Ambient 15-25°C',
    expiryDate: '2028-10-01',
    warehouseId: 'WH-CHI-1'
  },
  {
    id: 'RAW-2089',
    name: 'Stabilizing Emulsifier - Sorbitol-80 Ph.Eur',
    supplierId: 'SUP-102',
    supplierName: 'Terra Nutra Botanicals Ltd',
    materialType: 'Excipient / Stabilizer',
    receivedDate: '2026-10-05',
    initialQuantity: 5000,
    availableQuantity: 1800,
    unit: 'kg',
    status: 'Active',
    purityPct: 98.7,
    storageConditions: 'Cool, Dry < 20°C',
    expiryDate: '2028-04-15',
    warehouseId: 'WH-CHI-1'
  },
  {
    id: 'RAW-3051',
    name: 'High-Purity Preservative Agent - Potassium Sorbate',
    supplierId: 'SUP-103',
    supplierName: 'Pacific Marine Organics Corp',
    materialType: 'Preservative / Additive',
    receivedDate: '2026-10-07',
    initialQuantity: 1200,
    availableQuantity: 350,
    unit: 'kg',
    status: 'Active',
    purityPct: 99.1,
    storageConditions: 'Airtight, Light-Protected',
    expiryDate: '2027-12-30',
    warehouseId: 'WH-ATL-2'
  },
  {
    id: 'RAW-9912',
    name: 'Synthetic Solubilizer B-12 Compound',
    supplierId: 'SUP-104',
    supplierName: 'Solis Agro Synthetics S.A.',
    materialType: 'Solubilizer / Buffer',
    receivedDate: '2026-10-09',
    initialQuantity: 800,
    availableQuantity: 0,
    unit: 'kg',
    status: 'Quarantined',
    purityPct: 94.2,
    storageConditions: 'Refrigerated 2-8°C',
    expiryDate: '2027-06-20',
    warehouseId: 'WH-ATL-2',
    isAnomalous: true
  }
];

export const SEED_PRODUCTION_ORDERS: ProductionOrder[] = [
  {
    id: 'PO-8801',
    facility: 'Plant Delta-1 Cleanroom',
    facilityLocation: 'Austin, TX',
    finishedGoodsLotId: 'FG-1001',
    productName: 'NutriShield Oral Suspension 250ml',
    outputQuantity: 12000,
    unit: 'units',
    scheduledDate: '2026-10-10',
    completedDate: '2026-10-12',
    status: 'Completed',
    inputs: [
      { rawMaterialLotId: 'RAW-1042', quantity: 800, unit: 'kg' },
      { rawMaterialLotId: 'RAW-2089', quantity: 1200, unit: 'kg' }
    ]
  },
  {
    id: 'PO-8804',
    facility: 'Plant Sigma-4 Sterile Injectables',
    facilityLocation: 'Raleigh, NC',
    finishedGoodsLotId: 'FG-2002',
    productName: 'VitalPept Fortified Serum 50ml',
    outputQuantity: 25000,
    unit: 'units',
    scheduledDate: '2026-10-13',
    completedDate: '2026-10-15',
    status: 'Completed',
    inputs: [
      { rawMaterialLotId: 'RAW-1042', quantity: 1300, unit: 'kg' },
      { rawMaterialLotId: 'RAW-3051', quantity: 300, unit: 'kg' }
    ]
  },
  {
    id: 'PO-8812',
    facility: 'Plant Delta-1 Cleanroom',
    facilityLocation: 'Austin, TX',
    finishedGoodsLotId: 'FG-3003',
    productName: 'DermaRestore Complex 100ml',
    outputQuantity: 8500,
    unit: 'units',
    scheduledDate: '2026-10-16',
    completedDate: '2026-10-18',
    status: 'Flagged',
    inputs: [
      { rawMaterialLotId: 'RAW-2089', quantity: 1500, unit: 'kg' },
      { rawMaterialLotId: 'RAW-4040', quantity: 600, unit: 'kg', isMissing: true } // Missing upstream link anomaly
    ]
  },
  {
    id: 'PO-8815',
    facility: 'Plant Omega-2 Compounding',
    facilityLocation: 'Chicago, IL',
    finishedGoodsLotId: 'FG-4401',
    productName: 'ImmunoBoost Clinical 500mg',
    outputQuantity: 14000,
    unit: 'units',
    scheduledDate: '2026-10-18',
    completedDate: '2026-10-20',
    status: 'Flagged',
    inputs: [
      { rawMaterialLotId: 'RAW-9912', quantity: 600, unit: 'kg' }
    ]
  },
  {
    id: 'PO-8819',
    facility: 'Plant Omega-2 Compounding',
    facilityLocation: 'Chicago, IL',
    finishedGoodsLotId: 'FG-5509',
    productName: 'Cellular Defense Capsules 60ct',
    outputQuantity: 9000,
    unit: 'units',
    scheduledDate: '2026-10-20',
    completedDate: '2026-10-22',
    status: 'Flagged',
    inputs: [
      { rawMaterialLotId: 'RAW-9912', quantity: 450, unit: 'kg' },
      { rawMaterialLotId: 'RAW-3051', quantity: 250, unit: 'kg' }
    ]
  }
];

export const SEED_FINISHED_LOTS: FinishedGoodsLot[] = [
  {
    id: 'FG-1001',
    productName: 'NutriShield Oral Suspension 250ml',
    sku: 'MED-NS-250',
    productionOrderId: 'PO-8801',
    totalQuantity: 12000,
    unitPriceUsd: 42.00,
    expiryDate: '2028-09-30',
    releaseDate: '2026-10-13',
    status: 'Released',
    dosageForm: 'Oral Liquid'
  },
  {
    id: 'FG-2002',
    productName: 'VitalPept Fortified Serum 50ml',
    sku: 'MED-VP-050',
    productionOrderId: 'PO-8804',
    totalQuantity: 25000,
    unitPriceUsd: 88.00,
    expiryDate: '2028-10-15',
    releaseDate: '2026-10-16',
    status: 'Released',
    dosageForm: 'Sterile Serum Vial'
  },
  {
    id: 'FG-3003',
    productName: 'DermaRestore Complex 100ml',
    sku: 'MED-DR-100',
    productionOrderId: 'PO-8812',
    totalQuantity: 8500,
    unitPriceUsd: 34.50,
    expiryDate: '2028-10-18',
    releaseDate: '2026-10-19',
    status: 'Released',
    dosageForm: 'Topical Emulsion'
  },
  {
    id: 'FG-4401',
    productName: 'ImmunoBoost Clinical 500mg',
    sku: 'MED-IB-500',
    productionOrderId: 'PO-8815',
    totalQuantity: 14000,
    unitPriceUsd: 65.00,
    expiryDate: '2028-10-20',
    releaseDate: '2026-10-21',
    status: 'Quarantined',
    dosageForm: 'Tablet Bottle (90ct)'
  },
  {
    id: 'FG-5509',
    productName: 'Cellular Defense Capsules 60ct',
    sku: 'MED-CD-060',
    productionOrderId: 'PO-8819',
    totalQuantity: 9000,
    unitPriceUsd: 54.00,
    expiryDate: '2028-10-22',
    releaseDate: '2026-10-23',
    status: 'Released',
    dosageForm: 'Hard Gel Capsule'
  }
];

export const SEED_INVENTORY: WarehouseInventory[] = [
  // WH-CHI-1 (Central Midwest Distribution Hub)
  {
    id: 'INV-101',
    warehouseId: 'WH-CHI-1',
    warehouseName: 'Central Midwest Logistics Hub (Chicago, IL)',
    locationCode: 'WH-CHI-1',
    itemType: 'RAW',
    lotId: 'RAW-1042',
    itemName: 'Bio-Peptide Matrix 99%',
    quantity: 400,
    unit: 'kg',
    status: 'Available',
    bayLocation: 'Bay-R12'
  },
  {
    id: 'INV-102',
    warehouseId: 'WH-CHI-1',
    warehouseName: 'Central Midwest Logistics Hub (Chicago, IL)',
    locationCode: 'WH-CHI-1',
    itemType: 'RAW',
    lotId: 'RAW-2089',
    itemName: 'Stabilizing Emulsifier - Sorbitol-80',
    quantity: 1000,
    unit: 'kg',
    status: 'Available',
    bayLocation: 'Bay-R08'
  },
  {
    id: 'INV-103',
    warehouseId: 'WH-CHI-1',
    warehouseName: 'Central Midwest Logistics Hub (Chicago, IL)',
    locationCode: 'WH-CHI-1',
    itemType: 'FINISHED',
    lotId: 'FG-1001',
    itemName: 'NutriShield Oral Suspension 250ml',
    quantity: 3500,
    unit: 'units',
    status: 'Available',
    bayLocation: 'Pallet-F04'
  },
  {
    id: 'INV-104',
    warehouseId: 'WH-CHI-1',
    warehouseName: 'Central Midwest Logistics Hub (Chicago, IL)',
    locationCode: 'WH-CHI-1',
    itemType: 'FINISHED',
    lotId: 'FG-5509',
    itemName: 'Cellular Defense Capsules 60ct',
    quantity: 4200,
    unit: 'units',
    status: 'Available',
    bayLocation: 'Pallet-F19'
  },

  // WH-ATL-2 (Southeast Logistics Center)
  {
    id: 'INV-201',
    warehouseId: 'WH-ATL-2',
    warehouseName: 'Southeast Distribution Center (Atlanta, GA)',
    locationCode: 'WH-ATL-2',
    itemType: 'RAW',
    lotId: 'RAW-2089',
    itemName: 'Stabilizing Emulsifier - Sorbitol-80',
    quantity: 800,
    unit: 'kg',
    status: 'Available',
    bayLocation: 'Bay-R02'
  },
  {
    id: 'INV-202',
    warehouseId: 'WH-ATL-2',
    warehouseName: 'Southeast Distribution Center (Atlanta, GA)',
    locationCode: 'WH-ATL-2',
    itemType: 'RAW',
    lotId: 'RAW-3051',
    itemName: 'High-Purity Preservative Agent',
    quantity: 350,
    unit: 'kg',
    status: 'Available',
    bayLocation: 'Bay-R05'
  },
  {
    id: 'INV-203',
    warehouseId: 'WH-ATL-2',
    warehouseName: 'Southeast Distribution Center (Atlanta, GA)',
    locationCode: 'WH-ATL-2',
    itemType: 'FINISHED',
    lotId: 'FG-2002',
    itemName: 'VitalPept Fortified Serum 50ml',
    quantity: 8000,
    unit: 'units',
    status: 'Available',
    bayLocation: 'Vault-C01 (Cold 4°C)'
  },
  {
    id: 'INV-204',
    warehouseId: 'WH-ATL-2',
    warehouseName: 'Southeast Distribution Center (Atlanta, GA)',
    locationCode: 'WH-ATL-2',
    itemType: 'FINISHED',
    lotId: 'FG-4401',
    itemName: 'ImmunoBoost Clinical 500mg',
    quantity: 5000,
    unit: 'units',
    status: 'Quarantined',
    bayLocation: 'Quarantine-Cage-09'
  },

  // WH-DAL-3 (Southwest Cross-Dock)
  {
    id: 'INV-301',
    warehouseId: 'WH-DAL-3',
    warehouseName: 'Southwest Fulfillment Terminal (Dallas, TX)',
    locationCode: 'WH-DAL-3',
    itemType: 'FINISHED',
    lotId: 'FG-1001',
    itemName: 'NutriShield Oral Suspension 250ml',
    quantity: 2100,
    unit: 'units',
    status: 'Available',
    bayLocation: 'Pallet-D11'
  },
  {
    id: 'INV-302',
    warehouseId: 'WH-DAL-3',
    warehouseName: 'Southwest Fulfillment Terminal (Dallas, TX)',
    locationCode: 'WH-DAL-3',
    itemType: 'FINISHED',
    lotId: 'FG-2002',
    itemName: 'VitalPept Fortified Serum 50ml',
    quantity: 4500,
    unit: 'units',
    status: 'Available',
    bayLocation: 'Vault-D03 (Cold 4°C)'
  },
  {
    id: 'INV-303',
    warehouseId: 'WH-DAL-3',
    warehouseName: 'Southwest Fulfillment Terminal (Dallas, TX)',
    locationCode: 'WH-DAL-3',
    itemType: 'FINISHED',
    lotId: 'FG-3003',
    itemName: 'DermaRestore Complex 100ml',
    quantity: 2200,
    unit: 'units',
    status: 'Available',
    bayLocation: 'Pallet-D22'
  },

  // WH-NV-4 (Western Regional Fulfillment)
  {
    id: 'INV-401',
    warehouseId: 'WH-NV-4',
    warehouseName: 'Western Mountain Depot (Reno, NV)',
    locationCode: 'WH-NV-4',
    itemType: 'FINISHED',
    lotId: 'FG-3003',
    itemName: 'DermaRestore Complex 100ml',
    quantity: 2800,
    unit: 'units',
    status: 'Available',
    bayLocation: 'Pallet-W03'
  },
  {
    id: 'INV-402',
    warehouseId: 'WH-NV-4',
    warehouseName: 'Western Mountain Depot (Reno, NV)',
    locationCode: 'WH-NV-4',
    itemType: 'FINISHED',
    lotId: 'FG-5509',
    itemName: 'Cellular Defense Capsules 60ct',
    quantity: 1800,
    unit: 'units',
    status: 'Available',
    bayLocation: 'Pallet-W08'
  }
];

export const SEED_CUSTOMERS: Customer[] = [
  {
    id: 'CUST-901',
    name: 'CVS Health National Distribution Hub',
    accountType: 'National Retail Pharmacy',
    contactPerson: 'David Miller, VP Supply Chain',
    urgentRecallPhone: '+1 (800) 555-0191',
    email: 'recalls-urgent@cvshealth-ops.com',
    address: 'One CVS Drive, Woonsocket, RI 02895',
    regulatoryContactLevel: 'Tier 2 Retail Pharmacy'
  },
  {
    id: 'CUST-902',
    name: 'Walgreens Boots Alliance Fulfillment',
    accountType: 'National Retail Pharmacy',
    contactPerson: 'Sarah Jenkins, Director Logistics',
    urgentRecallPhone: '+1 (800) 555-0192',
    email: 'vendor.alert@walgreens.com',
    address: '108 Wilmot Rd, Deerfield, IL 60015',
    regulatoryContactLevel: 'Tier 2 Retail Pharmacy'
  },
  {
    id: 'CUST-903',
    name: 'McKesson Pharmaceutical Supply',
    accountType: 'Institutional Wholesaler',
    contactPerson: 'Robert Sterling, Chief Pharmacist',
    urgentRecallPhone: '+1 (800) 555-0193',
    email: 'regulatory.qa@mckesson.com',
    address: '6555 State Hwy 161, Irving, TX 75039',
    regulatoryContactLevel: 'Tier 1 Critical Healthcare'
  },
  {
    id: 'CUST-904',
    name: 'Cardinal Health Strategic Distribution',
    accountType: 'Institutional Wholesaler',
    contactPerson: 'Elena Rostova, Quality Assurance Head',
    urgentRecallPhone: '+1 (800) 555-0194',
    email: 'vigilance@cardinalhealth.com',
    address: '7000 Cardinal Pl, Dublin, OH 43017',
    regulatoryContactLevel: 'Tier 1 Critical Healthcare'
  },
  {
    id: 'CUST-905',
    name: 'Kaiser Permanente Regional Pharmacy',
    accountType: 'Integrated Hospital Network',
    contactPerson: 'Dr. Michael Chen, Chief Medical Officer',
    urgentRecallPhone: '+1 (800) 555-0195',
    email: 'cmo.recalls@kp.org',
    address: '1 Kaiser Plaza, Oakland, CA 94612',
    regulatoryContactLevel: 'Tier 1 Critical Healthcare'
  },
  {
    id: 'CUST-906',
    name: 'AmerisourceBergen / Cencora Central',
    accountType: 'Institutional Wholesaler',
    contactPerson: 'Marcus Vance, Compliance Officer',
    urgentRecallPhone: '+1 (800) 555-0196',
    email: 'safety-desk@cencora.com',
    address: '1 West First Ave, Conshohocken, PA 19428',
    regulatoryContactLevel: 'Tier 1 Critical Healthcare'
  },
  {
    id: 'CUST-907',
    name: 'Mayo Clinic Pharmacy Services',
    accountType: 'Specialty Academic Hospital',
    contactPerson: 'Dr. Aris Thorne, Director of Pharmacy',
    urgentRecallPhone: '+1 (800) 555-0197',
    email: 'pharmacyqa@mayo.edu',
    address: '200 First St SW, Rochester, MN 55905',
    regulatoryContactLevel: 'Tier 1 Critical Healthcare'
  },
  {
    id: 'CUST-908',
    name: 'Amazon Health Hub Logistics',
    accountType: 'E-Commerce / Direct Patient Delivery',
    contactPerson: 'Rachel Adams, VP Fulfillment',
    urgentRecallPhone: '+1 (800) 555-0198',
    email: 'health-recalls@amazon.com',
    address: '2121 7th Ave, Seattle, WA 98121',
    regulatoryContactLevel: 'Tier 3 Commercial'
  }
];

export const SEED_SHIPMENTS: Shipment[] = [
  {
    id: 'SHP-7701',
    finishedGoodsLotId: 'FG-1001',
    productName: 'NutriShield Oral Suspension 250ml',
    quantity: 4000,
    customerId: 'CUST-901',
    customerName: 'CVS Health National Distribution Hub',
    destinationCity: 'Woonsocket',
    destinationState: 'RI',
    status: 'Delivered',
    dispatchedDate: '2026-10-15',
    estimatedDelivery: '2026-10-17',
    trackingNumber: 'FDX-9921-8812-US',
    carrier: 'FedEx Custom Critical',
    priority: 'Standard'
  },
  {
    id: 'SHP-7702',
    finishedGoodsLotId: 'FG-1001',
    productName: 'NutriShield Oral Suspension 250ml',
    quantity: 2400,
    customerId: 'CUST-902',
    customerName: 'Walgreens Boots Alliance Fulfillment',
    destinationCity: 'Deerfield',
    destinationState: 'IL',
    status: 'In Transit',
    dispatchedDate: '2026-10-24',
    estimatedDelivery: '2026-10-29',
    trackingNumber: 'UPS-7714-3019-2X',
    carrier: 'UPS Freight TempAssure',
    priority: 'Standard'
  },
  {
    id: 'SHP-7703',
    finishedGoodsLotId: 'FG-2002',
    productName: 'VitalPept Fortified Serum 50ml',
    quantity: 7500,
    customerId: 'CUST-903',
    customerName: 'McKesson Pharmaceutical Supply',
    destinationCity: 'Irving',
    destinationState: 'TX',
    status: 'Delivered',
    dispatchedDate: '2026-10-18',
    estimatedDelivery: '2026-10-20',
    trackingNumber: 'DHL-COLD-4412-001',
    carrier: 'DHL SameDay Cold Chain',
    priority: 'Cold-Chain Overnight'
  },
  {
    id: 'SHP-7704',
    finishedGoodsLotId: 'FG-2002',
    productName: 'VitalPept Fortified Serum 50ml',
    quantity: 5000,
    customerId: 'CUST-904',
    customerName: 'Cardinal Health Strategic Distribution',
    destinationCity: 'Dublin',
    destinationState: 'OH',
    status: 'In Transit',
    dispatchedDate: '2026-10-25',
    estimatedDelivery: '2026-10-29',
    trackingNumber: 'DHL-COLD-4412-094',
    carrier: 'DHL SameDay Cold Chain',
    priority: 'Cold-Chain Overnight'
  },
  {
    id: 'SHP-8801',
    finishedGoodsLotId: 'FG-3003',
    productName: 'DermaRestore Complex 100ml',
    quantity: 3500,
    customerId: 'CUST-905',
    customerName: 'Kaiser Permanente Regional Pharmacy',
    destinationCity: 'Oakland',
    destinationState: 'CA',
    status: 'Delivered',
    dispatchedDate: '2026-10-21',
    estimatedDelivery: '2026-10-23',
    trackingNumber: 'FDX-8812-7010-US',
    carrier: 'FedEx Freight',
    priority: 'Expedited'
  },
  {
    id: 'SHP-8802',
    finishedGoodsLotId: 'FG-4401',
    productName: 'ImmunoBoost Clinical 500mg',
    quantity: 4000,
    customerId: 'CUST-906',
    customerName: 'AmerisourceBergen / Cencora Central',
    destinationCity: 'Conshohocken',
    destinationState: 'PA',
    status: 'Delivered', // Anomaly: Delivered despite FG-4401 warehouse quarantine hold!
    dispatchedDate: '2026-10-22',
    estimatedDelivery: '2026-10-24',
    trackingNumber: 'XPO-5501-9921-PA',
    carrier: 'XPO Logistics Secured',
    priority: 'Expedited'
  },
  {
    id: 'SHP-8803',
    finishedGoodsLotId: 'FG-4401',
    productName: 'ImmunoBoost Clinical 500mg',
    quantity: 5000,
    customerId: 'CUST-907',
    customerName: 'Mayo Clinic Pharmacy Services',
    destinationCity: 'Rochester',
    destinationState: 'MN',
    status: 'In Transit',
    dispatchedDate: '2026-10-26',
    estimatedDelivery: '2026-10-30',
    trackingNumber: 'UPS-MED-3039-441',
    carrier: 'UPS Healthcare Direct',
    priority: 'Expedited'
  },
  {
    id: 'SHP-8804',
    finishedGoodsLotId: 'FG-5509',
    productName: 'Cellular Defense Capsules 60ct',
    quantity: 3000,
    customerId: 'CUST-908',
    customerName: 'Amazon Health Hub Logistics',
    destinationCity: 'Hebron',
    destinationState: 'KY',
    status: 'Delivered',
    dispatchedDate: '2026-10-25',
    estimatedDelivery: '2026-10-27',
    trackingNumber: 'AZ-LOG-1104-KY',
    carrier: 'Amazon Freight Partner',
    priority: 'Standard'
  }
];

export const SEED_ANOMALIES: Anomaly[] = [
  {
    id: 'ANOM-001',
    type: 'MISSING_LINK',
    title: 'Unregistered Raw Material Reference in Production Order',
    severity: 'Critical',
    affectedEntityId: 'PO-8812',
    affectedEntityType: 'PRODUCTION_ORDER',
    expectedBehavior: 'All Bill of Materials (BOM) inputs must trace to an existing validated Raw Material Lot registered in the ERP ledger with valid Certificate of Analysis (COA).',
    observedBehavior: 'Production Order PO-8812 consumes 600 kg from lot identifier "RAW-4040". No supplier intake record, quarantine release, or COA exists in database for RAW-4040.',
    rootCause: 'Data entry omission or unverified emergency substitute ingredient introduced during night compounding shift without ERP intake barcode scan.',
    riskSummary: 'Finished Goods lot FG-3003 (8,500 units) has an untraceable chemical constituent. Regulatory compliance violation under 21 CFR Part 211.186.',
    status: 'Unresolved',
    detectedAt: '2026-10-26T04:12:00Z'
  },
  {
    id: 'ANOM-002',
    type: 'QUANTITY_MISMATCH',
    title: 'Mass Balance Defect: Over-Allocated Raw Material Lot',
    severity: 'Critical',
    affectedEntityId: 'RAW-9912',
    affectedEntityType: 'RAW_LOT',
    expectedBehavior: 'Cumulative mass allocated to production runs must not exceed total received quantity recorded at supplier intake (Mass Out <= Mass In).',
    observedBehavior: 'Initial intake quantity was 800 kg. However, PO-8815 claimed 600 kg and PO-8819 claimed 450 kg, totaling 1,050 kg (+250 kg / 31.25% unaccounted ghost mass).',
    rootCause: 'Dilution with undocumented carrier or concurrent electronic batch record misattribution across production lines Delta-1 and Omega-2.',
    riskSummary: 'Two finished lots (FG-4401 and FG-5509) compromised by potential formulation dilution, unverified potency variance, or ghost adulterant.',
    status: 'Unresolved',
    detectedAt: '2026-10-26T08:35:00Z'
  },
  {
    id: 'ANOM-003',
    type: 'STATUS_CONFLICT',
    title: 'Inventory Status Mismatch: Commercial Shipment of Quarantined Lot',
    severity: 'Critical',
    affectedEntityId: 'SHP-8802',
    affectedEntityType: 'SHIPMENT',
    expectedBehavior: 'Warehouse management system (WMS) must physically and electronically lock all lots with status "Quarantined" against picking and bill of lading generation.',
    observedBehavior: 'Finished lot FG-4401 was placed in QA Quarantine cage at WH-ATL-2 on Oct 21. Nevertheless, shipment SHP-8802 (4,000 units) was dispatched on Oct 22 and delivered to AmerisourceBergen (CUST-906).',
    rootCause: 'WMS ERP staging sync latency and manual barcode override by dock personnel during high-volume outbound shipping shift.',
    riskSummary: '4,000 unreleased pharmaceutical units currently in commercial wholesale channel. Urgent quarantine notice and product recall staging mandatory.',
    status: 'Unresolved',
    detectedAt: '2026-10-27T01:15:00Z'
  }
];

export const SEED_AUDIT_EVENTS: AuditEvent[] = [
  {
    id: 'AUD-901',
    timestamp: '2026-10-28T06:45:10Z',
    actionType: 'ANOMALY_FLAGGED',
    user: 'SYSTEM_AUTODETECT',
    targetId: 'SHP-8802',
    targetType: 'Shipment',
    description: 'Autonomous reconciliation flagged illegal dispatch of quarantined lot FG-4401 to AmerisourceBergen.',
    metadata: { violation: 'WMS_LOCK_BYPASS', severity: 'Critical' }
  },
  {
    id: 'AUD-902',
    timestamp: '2026-10-27T14:20:00Z',
    actionType: 'SHIPMENT_DISPATCH',
    user: 'j.garcia@logistics.corp',
    targetId: 'SHP-8803',
    targetType: 'Shipment',
    description: 'Dispatched 5,000 units FG-4401 to Mayo Clinic Pharmacy Services via UPS Healthcare.',
    metadata: { carrier: 'UPS Healthcare', tracking: 'UPS-MED-3039-441' }
  },
  {
    id: 'AUD-903',
    timestamp: '2026-10-26T08:35:00Z',
    actionType: 'ANOMALY_FLAGGED',
    user: 'SYSTEM_AUTODETECT',
    targetId: 'RAW-9912',
    targetType: 'RawMaterialLot',
    description: 'Detected mass balance divergence: 1,050 kg consumed vs 800 kg intake (+250 kg ghost quantity).',
    metadata: { deltaKg: 250, pctVariance: 31.25 }
  },
  {
    id: 'AUD-904',
    timestamp: '2026-10-25T11:00:00Z',
    actionType: 'PO_EXECUTION',
    user: 'k.patel@plant-omega.corp',
    targetId: 'PO-8819',
    targetType: 'ProductionOrder',
    description: 'Completed compounding run PO-8819 yielding 9,000 units of Cellular Defense Capsules FG-5509.',
    metadata: { plant: 'Plant Omega-2', qty: 9000 }
  },
  {
    id: 'AUD-905',
    timestamp: '2026-10-24T16:15:00Z',
    actionType: 'QUARANTINE_APPLIED',
    user: 'dr.vance@quality.corp',
    targetId: 'RAW-9912',
    targetType: 'RawMaterialLot',
    description: 'Placed RAW-9912 on immediate QA Quarantine hold due to Solis Agro audit non-conformance flag.',
    metadata: { reason: 'SUPPLIER_AUDIT_EXPIRED' }
  },
  {
    id: 'AUD-906',
    timestamp: '2026-10-20T09:30:00Z',
    actionType: 'QC_CHECK',
    user: 's.nakamura@quality.corp',
    targetId: 'FG-2002',
    targetType: 'FinishedGoodsLot',
    description: 'Analytical assay passed: VitalPept Serum lot FG-2002 approved for commercial distribution.',
    metadata: { assayPurity: 99.8, endotoxins: 'Within Limit' }
  },
  {
    id: 'AUD-907',
    timestamp: '2026-10-09T13:45:00Z',
    actionType: 'INTAKE',
    user: 'm.ross@wh-atl2.corp',
    targetId: 'RAW-9912',
    targetType: 'RawMaterialLot',
    description: 'Warehouse intake completed for 800 kg Synthetic Solubilizer B-12 from Solis Agro Synthetics S.A.',
    metadata: { dock: 'Dock-4', condition: 'Cold Storage Verified' }
  }
];
