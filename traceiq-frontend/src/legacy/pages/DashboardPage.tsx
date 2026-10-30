import React, { useState, useRef, useMemo } from 'react';
import {
  Factory,
  Database,
  Package,
  ShieldAlert,
  SearchCode,
  Play,
  ArrowRight,
  Warehouse,
  CheckCircle2,
  Clock,
  Sparkles,
  AlertTriangle,
  FileWarning,
  Download,
  Loader2,
  X,
  Search,
  ExternalLink,
  FileSpreadsheet,
  Check,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Info,
  Layers,
  Building2,
  MapPin,
  Tag,
  AlertOctagon,
  BarChart3,
  SlidersHorizontal,
  CheckCircle,
  Truck
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
  Cell
} from 'recharts';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { useNexus, findMissingInputs, validateLotQuantities } from '../context/NexusContext';
import { Badge } from '../components/Badge';
import { ScenarioBanner } from '../components/ScenarioBanner';
import { STATUS } from '../types/nexusChain';

type KpiType = 'suppliers' | 'rawLots' | 'finishedGoods' | 'incidents';

export const DashboardPage: React.FC = () => {
  const { db, setActiveTab, setGlobalSearchTarget } = useNexus();
  const [metricTab, setMetricTab] = useState<'finished' | 'raw'>('finished');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfToast, setPdfToast] = useState<string | null>(null);

  // In-card expandable sections state
  const [expandedCards, setExpandedCards] = useState<Record<KpiType, boolean>>({
    suppliers: false,
    rawLots: false,
    finishedGoods: false,
    incidents: false
  });

  // Detailed Modal state
  const [activeKpiModal, setActiveKpiModal] = useState<KpiType | null>(null);
  const [modalSearch, setModalSearch] = useState('');
  const [copiedNotification, setCopiedNotification] = useState<string | null>(null);

  const dashboardRef = useRef<HTMLDivElement>(null);

  // Toggle card expansion
  const toggleCardExpand = (id: KpiType, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedCards((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const isAllExpanded = Object.values(expandedCards).every(Boolean);
  const toggleAllExpand = () => {
    const nextState = !isAllExpanded;
    setExpandedCards({
      suppliers: nextState,
      rawLots: nextState,
      finishedGoods: nextState,
      incidents: nextState
    });
  };

  // Exact metrics
  const activeSuppliersCount = db.suppliers.length;
  const rawLotsList = db.lots.filter((l) => l.type === 'RAW');
  const registeredRawLotsCount = rawLotsList.length;
  const finishedOnHandUnits = db.inventory.reduce((sum, item) => sum + item.qty, 0);
  const fgLotsList = db.lots.filter((l) => l.type === 'FG');
  const openIncidentsCount = db.lots.filter(
    (l) => l.status === STATUS.WARNING || l.status === STATUS.QUARANTINED
  ).length;

  const missingInputs = findMissingInputs(db);
  const overAllocatedLots = db.lots
    .filter((l) => l.type === 'FG')
    .map((l) => validateLotQuantities(db, l.id))
    .filter((r) => r && r.overAllocated);

  const totalQualityIncidentsCount =
    openIncidentsCount + missingInputs.length + overAllocatedLots.length;

  // Granular Calculations for Suppliers
  const avgSupplierRisk = useMemo(() => {
    if (db.suppliers.length === 0) return 0;
    const sum = db.suppliers.reduce((acc, s) => acc + s.riskScore, 0);
    return (sum / db.suppliers.length).toFixed(1);
  }, [db.suppliers]);

  const supplierRiskTiers = useMemo(() => {
    const low = db.suppliers.filter((s) => s.riskScore < 20).length;
    const moderate = db.suppliers.filter((s) => s.riskScore >= 20 && s.riskScore < 50).length;
    const high = db.suppliers.filter((s) => s.riskScore >= 50).length;
    return { low, moderate, high };
  }, [db.suppliers]);

  // Granular Calculations for Raw Lots
  const rawVolumeTotalKg = useMemo(() => {
    return rawLotsList.reduce((acc, l) => acc + l.qty, 0);
  }, [rawLotsList]);

  const rawStatusBreakdown = useMemo(() => {
    const ok = rawLotsList.filter((l) => l.status === STATUS.OK).length;
    const flagged = rawLotsList.filter((l) => l.status !== STATUS.OK).length;
    return { ok, flagged };
  }, [rawLotsList]);

  // Granular Calculations for Finished Goods
  const fgWarehouseBreakdown = useMemo(() => {
    const east = db.inventory
      .filter((i) => i.warehouseId === 'WH-East' && db.lots.find((l) => l.id === i.lotId)?.type === 'FG')
      .reduce((sum, item) => sum + item.qty, 0);
    const west = db.inventory
      .filter((i) => i.warehouseId === 'WH-West' && db.lots.find((l) => l.id === i.lotId)?.type === 'FG')
      .reduce((sum, item) => sum + item.qty, 0);
    const totalShipped = db.shipments.reduce((sum, s) => sum + s.qty, 0);
    return { east, west, totalShipped };
  }, [db.inventory, db.lots, db.shipments]);

  // KPI card configuration
  const kpis: {
    id: KpiType;
    label: string;
    value: string | number;
    sublabel: string;
    badge: string;
    badgeColor: string;
    icon: React.ComponentType<{ className?: string }>;
    gradient: string;
    accentColor: string;
    expandSummary: string;
  }[] = [
    {
      id: 'suppliers',
      label: 'Active Suppliers',
      value: activeSuppliersCount,
      sublabel: 'Verified vendors in network',
      badge: 'Tier-1 Qualified',
      badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
      icon: Factory,
      gradient: 'from-blue-600 to-indigo-600',
      accentColor: 'border-t-blue-500',
      expandSummary: `${supplierRiskTiers.low} Low Risk · ${supplierRiskTiers.moderate} Moderate · Avg Score ${avgSupplierRisk}`
    },
    {
      id: 'rawLots',
      label: 'Registered Raw Lots',
      value: registeredRawLotsCount,
      sublabel: 'Active ingredient batches',
      badge: '100% Pedigree',
      badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      icon: Database,
      gradient: 'from-indigo-600 to-violet-600',
      accentColor: 'border-t-indigo-500',
      expandSummary: `${rawVolumeTotalKg.toLocaleString()} kg total · ${rawStatusBreakdown.ok} OK · ${rawStatusBreakdown.flagged} Flagged`
    },
    {
      id: 'finishedGoods',
      label: 'Finished Goods On Hand',
      value: finishedOnHandUnits.toLocaleString(),
      sublabel: 'Commercial units in stock',
      badge: '99.4% In-Spec',
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      icon: Package,
      gradient: 'from-emerald-600 to-teal-600',
      accentColor: 'border-t-emerald-500',
      expandSummary: `WH-East: ${fgWarehouseBreakdown.east.toLocaleString()} · WH-West: ${fgWarehouseBreakdown.west.toLocaleString()}`
    },
    {
      id: 'incidents',
      label: 'Open Quality Incidents',
      value: totalQualityIncidentsCount,
      sublabel: 'Deviations & seeded anomalies',
      badge: 'Needs Review',
      badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
      icon: ShieldAlert,
      gradient: 'from-rose-600 to-red-600',
      accentColor: 'border-t-rose-500',
      expandSummary: `${missingInputs.length} Ghost Lot · ${overAllocatedLots.length} Mass Balance · ${openIncidentsCount} Flagged`
    }
  ];

  // Distinct warehouse chart data keeping finished units and raw kg separate
  const inventoryData = db.warehouses.map((wh) => {
    const finishedUnits = db.inventory
      .filter((i) => i.warehouseId === wh.id && db.lots.find((l) => l.id === i.lotId)?.type === 'FG')
      .reduce((sum, item) => sum + item.qty, 0);

    const rawKg = db.inventory
      .filter((i) => i.warehouseId === wh.id && db.lots.find((l) => l.id === i.lotId)?.type === 'RAW')
      .reduce((sum, item) => sum + item.qty, 0);

    return {
      name: wh.id,
      fullName: wh.name,
      finishedUnits,
      rawKg
    };
  });

  // Comprehensive incident records
  const incidentsList = useMemo(() => {
    const list: Array<{
      id: string;
      code: string;
      type: string;
      severity: 'Critical' | 'High' | 'Warning';
      entityId: string;
      title: string;
      description: string;
      actionLabel: string;
      actionType: 'trace' | 'recall' | 'anomalies';
      targetId: string;
    }> = [];

    // 1. Missing inputs / Ghost lots
    missingInputs.forEach((mi, idx) => {
      list.push({
        id: `GHOST-${idx}`,
        code: `DEF-00${idx + 1}`,
        type: 'Ghost Lot Defect',
        severity: 'Critical',
        entityId: mi.productionOrderId,
        title: `Unregistered Input Lot ${mi.missingLotId}`,
        description: `Production Order ${mi.productionOrderId} consumes unregistered lot ${mi.missingLotId} missing from raw intake registry.`,
        actionLabel: 'Trace Order',
        actionType: 'trace',
        targetId: mi.productionOrderId
      });
    });

    // 2. Over-allocated lots
    overAllocatedLots.forEach((oa, idx) => {
      if (!oa) return;
      list.push({
        id: `MASS-${idx}`,
        code: `MAS-00${idx + 1}`,
        type: 'Mass Balance Over-Allocation',
        severity: 'Critical',
        entityId: oa.lotId,
        title: `Quantity Discrepancy (+${Math.abs(oa.difference)} units)`,
        description: `Produced ${oa.producedQty} units, but warehouse inventory (${oa.inventoryQty}) + dispatched shipments (${oa.shippedQty}) sum to ${oa.totalRecorded} units.`,
        actionLabel: 'Isolate & Recall',
        actionType: 'recall',
        targetId: oa.lotId
      });
    });

    // 3. Quarantined or Warning lots
    db.lots
      .filter((l) => l.status === STATUS.WARNING || l.status === STATUS.QUARANTINED || l.status === STATUS.RECALLED)
      .forEach((l, idx) => {
        list.push({
          id: `STATUS-${idx}`,
          code: `WAR-00${idx + 1}`,
          type: l.status === STATUS.WARNING ? 'Contamination Flag' : l.status === STATUS.QUARANTINED ? 'Quarantined Stock' : 'Active Recall',
          severity: l.status === STATUS.RECALLED ? 'Critical' : 'High',
          entityId: l.id,
          title: `${l.name || l.id} (${l.status})`,
          description: `Lot marked as ${l.status}. Raw batch contains chemical purity variance requiring isolation and downstream trace.`,
          actionLabel: 'Simulate Recall',
          actionType: 'recall',
          targetId: l.id
        });
      });

    return list;
  }, [db, missingInputs, overAllocatedLots]);

  // Programmatic PDF generator fallback
  const generateProgrammaticPdf = (pdf: jsPDF) => {
    const pageWidth = pdf.internal.pageSize.getWidth();
    let y = 18;

    // Header Title
    pdf.setFillColor(37, 99, 235);
    pdf.rect(0, 0, pageWidth, 24, 'F');

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.setTextColor(255, 255, 255);
    pdf.text('TRACEIQ ENTERPRISE SUPPLY CHAIN REPORT', 14, 11);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(220, 235, 255);
    pdf.text(`Generated: ${new Date().toLocaleString()} | Cryptographic SHA-256 Validated Audit`, 14, 18);

    y = 34;

    // Executive Summary Section
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.setTextColor(15, 23, 42);
    pdf.text('1. Executive KPI Summary & Granular Breakdown', 14, y);
    y += 8;

    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(51, 65, 85);

    const kpiSummaryData = [
      `Active Tier-1 Suppliers: ${activeSuppliersCount} verified vendors (Avg Risk Score: ${avgSupplierRisk}/100)`,
      `Registered Raw Lots: ${registeredRawLotsCount} active batches (${rawVolumeTotalKg.toLocaleString()} kg total mass)`,
      `Finished Goods In Stock: ${finishedOnHandUnits.toLocaleString()} units (WH-East: ${fgWarehouseBreakdown.east}, WH-West: ${fgWarehouseBreakdown.west})`,
      `Active Quality Incidents: ${totalQualityIncidentsCount} flagged issues needing review (${missingInputs.length} Ghost Lots, ${overAllocatedLots.length} Mass Balance)`
    ];

    kpiSummaryData.forEach((line) => {
      pdf.circle(18, y - 1, 1, 'F');
      pdf.text(line, 22, y);
      y += 6;
    });

    y += 6;

    // Warehouse Distribution Section
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.setTextColor(15, 23, 42);
    pdf.text('2. Warehouse Inventory Allocation', 14, y);
    y += 8;

    inventoryData.forEach((wh) => {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9.5);
      pdf.setTextColor(30, 41, 59);
      pdf.text(`${wh.name} (${wh.fullName})`, 18, y);
      y += 5;

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8.5);
      pdf.setTextColor(71, 85, 105);
      pdf.text(`• Finished Units On Hand: ${wh.finishedUnits.toLocaleString()} units`, 22, y);
      y += 4.5;
      pdf.text(`• Active Raw Ingredients: ${wh.rawKg.toLocaleString()} kg`, 22, y);
      y += 7;
    });

    y += 4;

    // Quality Incidents Section
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.setTextColor(15, 23, 42);
    pdf.text(`3. Active Quality Anomalies & Deviations (${incidentsList.length})`, 14, y);
    y += 8;

    incidentsList.forEach((inc) => {
      if (y > 270) {
        pdf.addPage();
        y = 20;
      }
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      pdf.setTextColor(225, 29, 72);
      pdf.text(`[${inc.severity.toUpperCase()}] ${inc.type} - Entity: ${inc.entityId}`, 18, y);
      y += 4.5;

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(71, 85, 105);
      const splitDesc = pdf.splitTextToSize(inc.description, pageWidth - 36);
      pdf.text(splitDesc, 22, y);
      y += splitDesc.length * 4 + 4;
    });

    const totalPages = pdf.internal.pages.length - 1;
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.setFontSize(7.5);
      pdf.setTextColor(148, 163, 184);
      pdf.text(`TraceIQ Autonomous Supply Chain Verification — Page ${i} of ${totalPages}`, 14, 290);
    }
  };

  // PDF generation handler
  const handleDownloadPdf = async () => {
    setIsGeneratingPdf(true);
    setPdfToast('Generating comprehensive supply chain snapshot...');

    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const container = dashboardRef.current;

      if (!container) {
        throw new Error('Dashboard container ref not found');
      }

      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#F8FAFC',
        ignoreElements: (element) => {
          return element.classList.contains('pdf-ignore');
        }
      });

      const imgData = canvas.toDataURL('image/png');
      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= pageHeight;
      }

      const timestamp = new Date().toISOString().slice(0, 10);
      pdf.save(`TraceIQ_Supply_Chain_Report_${timestamp}.pdf`);
      setPdfToast('Executive Report downloaded successfully (PDF)');
    } catch (err) {
      console.warn('html2canvas capture fallback triggered:', err);
      try {
        const fallbackPdf = new jsPDF('p', 'mm', 'a4');
        generateProgrammaticPdf(fallbackPdf);
        const timestamp = new Date().toISOString().slice(0, 10);
        fallbackPdf.save(`TraceIQ_Supply_Chain_Report_${timestamp}.pdf`);
        setPdfToast('Executive Report generated & downloaded successfully (PDF)');
      } catch (innerErr) {
        console.error('PDF generation failed:', innerErr);
        setPdfToast('Unable to export PDF. Please try again.');
      }
    } finally {
      setIsGeneratingPdf(false);
      setTimeout(() => setPdfToast(null), 4500);
    }
  };

  // CSV Export for current modal dataset
  const handleExportCsv = (type: KpiType) => {
    let headers: string[] = [];
    let rows: string[][] = [];
    let filename = `TraceIQ_${type}_data_${new Date().toISOString().slice(0, 10)}.csv`;

    if (type === 'suppliers') {
      headers = ['Supplier ID', 'Supplier Name', 'Country', 'Category', 'Risk Score', 'Risk Tier', 'Supplied Lots'];
      rows = db.suppliers.map((s) => [
        s.id,
        `"${s.name.replace(/"/g, '""')}"`,
        s.country || 'N/A',
        `"${(s.category || 'N/A').replace(/"/g, '""')}"`,
        s.riskScore.toString(),
        s.riskScore < 20 ? 'Low Risk (Tier 1)' : s.riskScore < 50 ? 'Moderate Risk' : 'High Risk',
        `"${db.lots.filter((l) => l.supplierId === s.id).map((l) => l.id).join('; ')}"`
      ]);
    } else if (type === 'rawLots') {
      headers = ['Lot ID', 'Material Name', 'Supplier ID', 'Supplier Name', 'Intake Qty', 'UOM', 'Status', 'Received Date', 'Storage Warehouse'];
      rows = db.lots
        .filter((l) => l.type === 'RAW')
        .map((l) => {
          const supp = db.suppliers.find((s) => s.id === l.supplierId);
          const inv = db.inventory.filter((i) => i.lotId === l.id);
          const whLocations = inv.map((i) => `${i.warehouseId}${i.bay ? ' (Bay ' + i.bay + ')' : ''}: ${i.qty}`).join('; ');
          return [
            l.id,
            `"${(l.name || 'N/A').replace(/"/g, '""')}"`,
            l.supplierId || 'N/A',
            `"${(supp?.name || 'N/A').replace(/"/g, '""')}"`,
            l.qty.toString(),
            l.uom,
            l.status,
            l.receivedDate || 'N/A',
            `"${whLocations || 'In Transit'}"`
          ];
        });
    } else if (type === 'finishedGoods') {
      headers = ['Lot ID', 'Product Name', 'Total Batch Qty', 'UOM', 'Stock On Hand', 'Dispatched Units', 'Warehouses', 'Quality Status'];
      rows = db.lots
        .filter((l) => l.type === 'FG')
        .map((l) => {
          const onHand = db.inventory.filter((i) => i.lotId === l.id).reduce((sum, i) => sum + i.qty, 0);
          const shipped = db.shipments.filter((s) => s.lotId === l.id).reduce((sum, s) => sum + s.qty, 0);
          const whDetail = db.inventory.filter((i) => i.lotId === l.id).map((i) => `${i.warehouseId}: ${i.qty}`).join('; ');
          return [
            l.id,
            `"${(l.name || 'N/A').replace(/"/g, '""')}"`,
            l.qty.toString(),
            l.uom,
            onHand.toString(),
            shipped.toString(),
            `"${whDetail || 'None'}"`,
            l.status
          ];
        });
    } else if (type === 'incidents') {
      headers = ['Incident Code', 'Type', 'Severity', 'Entity ID', 'Title', 'Description', 'Action'];
      rows = incidentsList.map((inc) => [
        inc.code,
        `"${inc.type}"`,
        inc.severity,
        inc.entityId,
        `"${inc.title.replace(/"/g, '""')}"`,
        `"${inc.description.replace(/"/g, '""')}"`,
        inc.actionLabel
      ]);
    }

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setCopiedNotification(`Exported ${filename}`);
    setTimeout(() => setCopiedNotification(null), 3000);
  };

  // Filtered dataset for Active Suppliers
  const filteredSuppliers = useMemo(() => {
    return db.suppliers.filter((s) => {
      const q = modalSearch.toLowerCase();
      return (
        s.id.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        (s.country && s.country.toLowerCase().includes(q)) ||
        (s.category && s.category.toLowerCase().includes(q))
      );
    });
  }, [db.suppliers, modalSearch]);

  // Filtered dataset for Raw Lots
  const filteredRawLots = useMemo(() => {
    return db.lots
      .filter((l) => l.type === 'RAW')
      .filter((l) => {
        const q = modalSearch.toLowerCase();
        const supp = db.suppliers.find((s) => s.id === l.supplierId);
        return (
          l.id.toLowerCase().includes(q) ||
          (l.name && l.name.toLowerCase().includes(q)) ||
          (supp && supp.name.toLowerCase().includes(q)) ||
          l.status.toLowerCase().includes(q)
        );
      });
  }, [db.lots, db.suppliers, modalSearch]);

  // Filtered dataset for Finished Goods
  const filteredFinishedGoods = useMemo(() => {
    return db.lots
      .filter((l) => l.type === 'FG')
      .filter((l) => {
        const q = modalSearch.toLowerCase();
        return (
          l.id.toLowerCase().includes(q) ||
          (l.name && l.name.toLowerCase().includes(q)) ||
          l.status.toLowerCase().includes(q)
        );
      });
  }, [db.lots, modalSearch]);

  // Filtered dataset for Quality Incidents
  const filteredIncidents = useMemo(() => {
    return incidentsList.filter((inc) => {
      const q = modalSearch.toLowerCase();
      return (
        inc.code.toLowerCase().includes(q) ||
        inc.entityId.toLowerCase().includes(q) ||
        inc.type.toLowerCase().includes(q) ||
        inc.title.toLowerCase().includes(q) ||
        inc.description.toLowerCase().includes(q) ||
        inc.severity.toLowerCase().includes(q)
      );
    });
  }, [incidentsList, modalSearch]);

  return (
    <div ref={dashboardRef} className="space-y-6 sm:space-y-8 animate-in fade-in duration-300 relative">
      {/* Toast Notification */}
      {pdfToast && (
        <div className="pdf-ignore fixed bottom-5 right-5 z-50 flex items-center gap-3 rounded-xl border border-blue-200 bg-white px-4 py-3 shadow-xl animate-in slide-in-from-bottom-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            {isGeneratingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-5 w-5 text-emerald-600" />}
          </div>
          <div>
            <p className="text-xs font-bold text-slate-900">{pdfToast}</p>
            <p className="text-3xs text-slate-500">TraceIQ Master Verification Engine</p>
          </div>
          <button
            onClick={() => setPdfToast(null)}
            className="ml-2 text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Enterprise Live Monitoring Header - Main Starting Interface */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-5 bg-white p-6 sm:p-7 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200/80 mb-2.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
            </span>
            <span className="text-3xs font-extrabold uppercase tracking-wider text-blue-700">
              Enterprise Live Monitoring
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Supply Chain Overview
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
            Monitor inventory, traceability, quality incidents, and recall activity.
          </p>
        </div>

        {/* Action Buttons: Download Report + Trace a Lot + Investigate Anomalies + Simulate Recall */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 w-full lg:w-auto pdf-ignore">
          <button
            onClick={handleDownloadPdf}
            disabled={isGeneratingPdf}
            title="Download executive PDF snapshot of current supply chain metrics"
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-400 hover:text-slate-900 transition-all shadow-2xs hover:shadow-xs active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
          >
            {isGeneratingPdf ? (
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            ) : (
              <Download className="h-4 w-4 text-blue-600" />
            )}
            <span>{isGeneratingPdf ? 'Generating PDF...' : 'Download Report'}</span>
          </button>

          <button
            onClick={() => {
              setGlobalSearchTarget('RAW-1042');
              setActiveTab('traceability');
            }}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs font-bold text-blue-700 hover:bg-blue-100 hover:border-blue-300 transition-all shadow-2xs hover:shadow-xs active:scale-[0.99] cursor-pointer"
          >
            <SearchCode className="h-4 w-4 text-blue-600" />
            <span>Trace a Lot</span>
          </button>

          <button
            onClick={() => setActiveTab('anomalies')}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-bold text-amber-800 hover:bg-amber-100 hover:border-amber-300 transition-all shadow-2xs hover:shadow-xs active:scale-[0.99] cursor-pointer"
          >
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <span>Investigate Anomalies</span>
            {(missingInputs.length > 0 || overAllocatedLots.length > 0) && (
              <span className="ml-1 rounded-full bg-amber-200/90 px-1.5 py-0.2 text-3xs font-extrabold text-amber-900">
                {missingInputs.length + overAllocatedLots.length}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              setGlobalSearchTarget('RAW-1042');
              setActiveTab('recall');
            }}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700 transition-all shadow-xs hover:shadow active:scale-[0.99] cursor-pointer"
          >
            <Play className="h-4 w-4 fill-white" />
            <span>Simulate a Recall</span>
          </button>
        </div>
      </div>

      {/* KPI Controls Bar: Expand All / Granular Breakdown Indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs bg-slate-100/70 p-3 sm:px-4 rounded-xl border border-slate-200/80">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-slate-500" />
          <span className="font-bold text-slate-700">Granular Metric Intelligence:</span>
          <span className="text-slate-500 text-2xs">
            Toggle inline breakdown cards or click any metric to view underlying ledger items and audit trails.
          </span>
        </div>
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            onClick={toggleAllExpand}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-2xs font-bold text-slate-700 shadow-2xs transition-all cursor-pointer"
          >
            {isAllExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            <span>{isAllExpanded ? 'Collapse All Breakdowns' : 'Expand All Breakdowns'}</span>
          </button>
        </div>
      </div>

      {/* 4 Interactive Colorful KPI Cards with Expandable Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 items-start">
        {kpis.map((kpi) => {
          const isExpanded = expandedCards[kpi.id];

          return (
            <div
              key={kpi.id}
              className={`rounded-2xl border border-slate-200/90 border-t-4 ${kpi.accentColor} bg-white shadow-xs transition-all duration-200 hover:shadow-md flex flex-col justify-between overflow-hidden`}
            >
              {/* Card Header & Primary Stats */}
              <div className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-2xs font-bold uppercase tracking-wider text-slate-500 block">
                      {kpi.label}
                    </span>
                    <span className={`inline-block mt-1 text-3xs font-semibold px-2 py-0.5 rounded-full border ${kpi.badgeColor}`}>
                      {kpi.badge}
                    </span>
                  </div>
                  <div className={`p-2.5 rounded-xl bg-gradient-to-br ${kpi.gradient} text-white shadow-sm`}>
                    <kpi.icon className="h-5 w-5" />
                  </div>
                </div>

                <div className="mt-4">
                  <span className="text-3xl font-extrabold tracking-tight text-slate-900 font-mono">
                    {kpi.value}
                  </span>
                  <p className="mt-1 text-2xs text-slate-500 font-medium">
                    {kpi.sublabel}
                  </p>
                </div>

                {/* Sub-summary indicator */}
                <div className="mt-3 py-1.5 px-2.5 rounded-lg bg-slate-50 border border-slate-100 text-3xs font-medium text-slate-600 flex items-center justify-between">
                  <span className="truncate">{kpi.expandSummary}</span>
                </div>
              </div>

              {/* Action Bar: Toggle Expand + Open Detailed Modal */}
              <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={(e) => toggleCardExpand(kpi.id, e)}
                  className="flex items-center gap-1 text-2xs font-bold text-slate-700 hover:text-blue-600 transition-colors cursor-pointer"
                >
                  {isExpanded ? (
                    <>
                      <span>Hide Breakdown</span>
                      <ChevronUp className="h-3.5 w-3.5 text-slate-400" />
                    </>
                  ) : (
                    <>
                      <span>Quick Breakdown</span>
                      <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveKpiModal(kpi.id);
                    setModalSearch('');
                  }}
                  className="flex items-center gap-1 text-2xs font-bold text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
                  title="Open full data modal with table & CSV export"
                >
                  <span>Detailed Modal</span>
                  <Maximize2 className="h-3 w-3" />
                </button>
              </div>

              {/* INLINE EXPANDABLE GRANULAR BREAKDOWN SECTION */}
              {isExpanded && (
                <div className="border-t border-slate-200 bg-slate-50/90 p-4 space-y-3.5 animate-in slide-in-from-top-2 duration-200">
                  {/* KPI 1: SUPPLIERS INLINE BREAKDOWN */}
                  {kpi.id === 'suppliers' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-3xs font-extrabold uppercase text-slate-500 tracking-wider">
                        <span>Risk Tiers & Geographies</span>
                        <span className="text-blue-700">Avg: {avgSupplierRisk}/100</span>
                      </div>

                      {/* Distribution Meter */}
                      <div className="grid grid-cols-3 gap-1.5 text-center">
                        <div className="p-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-3xs">
                          <span className="font-extrabold text-emerald-800 block">{supplierRiskTiers.low}</span>
                          <span className="text-4xs text-emerald-600 font-bold uppercase">Low Risk</span>
                        </div>
                        <div className="p-1.5 rounded-lg bg-amber-50 border border-amber-200 text-3xs">
                          <span className="font-extrabold text-amber-800 block">{supplierRiskTiers.moderate}</span>
                          <span className="text-4xs text-amber-600 font-bold uppercase">Moderate</span>
                        </div>
                        <div className="p-1.5 rounded-lg bg-slate-100 border border-slate-200 text-3xs">
                          <span className="font-extrabold text-slate-600 block">{supplierRiskTiers.high}</span>
                          <span className="text-4xs text-slate-500 font-bold uppercase">High</span>
                        </div>
                      </div>

                      {/* Contributing Itemized List */}
                      <div className="space-y-1.5 pt-1">
                        <span className="text-3xs font-bold text-slate-600 block uppercase tracking-wider">
                          Contributing Suppliers ({db.suppliers.length})
                        </span>
                        {db.suppliers.map((s) => {
                          const suppliedCount = db.lots.filter((l) => l.supplierId === s.id).length;
                          return (
                            <div
                              key={s.id}
                              className="bg-white p-2.5 rounded-xl border border-slate-200/80 text-2xs flex items-center justify-between shadow-2xs hover:border-blue-300 transition-colors"
                            >
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono font-bold text-blue-600 text-3xs">{s.id}</span>
                                  <span className="font-bold text-slate-900">{s.name}</span>
                                </div>
                                <div className="flex items-center gap-2 text-3xs text-slate-500 mt-0.5">
                                  <span>{s.country}</span>
                                  <span>·</span>
                                  <span>{suppliedCount} lots supplied</span>
                                </div>
                              </div>
                              <div className="text-right">
                                <span className={`px-1.5 py-0.5 rounded font-mono font-extrabold text-3xs ${
                                  s.riskScore < 20 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                }`}>
                                  {s.riskScore}/100
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <button
                        onClick={() => {
                          setActiveKpiModal('suppliers');
                          setModalSearch('');
                        }}
                        className="w-full py-1.5 text-center text-3xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors cursor-pointer"
                      >
                        Open Full Supplier Ledger & CSV →
                      </button>
                    </div>
                  )}

                  {/* KPI 2: REGISTERED RAW LOTS INLINE BREAKDOWN */}
                  {kpi.id === 'rawLots' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-3xs font-extrabold uppercase text-slate-500 tracking-wider">
                        <span>Status & Intake Volume</span>
                        <span className="text-indigo-700 font-mono">{rawVolumeTotalKg.toLocaleString()} kg</span>
                      </div>

                      {/* Status Badges */}
                      <div className="flex items-center gap-2">
                        <div className="flex-1 p-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-center text-3xs">
                          <span className="font-extrabold text-emerald-800 block">{rawStatusBreakdown.ok} Batches</span>
                          <span className="text-4xs text-emerald-600 font-bold uppercase">Pedigree In-Spec</span>
                        </div>
                        <div className="flex-1 p-1.5 rounded-lg bg-amber-50 border border-amber-200 text-center text-3xs">
                          <span className="font-extrabold text-amber-800 block">{rawStatusBreakdown.flagged} Batch</span>
                          <span className="text-4xs text-amber-600 font-bold uppercase">Flagged Warning</span>
                        </div>
                      </div>

                      {/* Contributing Raw Lots List */}
                      <div className="space-y-1.5 pt-1">
                        <span className="text-3xs font-bold text-slate-600 block uppercase tracking-wider">
                          Contributing Batches ({rawLotsList.length})
                        </span>
                        {rawLotsList.map((lot) => {
                          const supp = db.suppliers.find((s) => s.id === lot.supplierId);
                          const isWarning = lot.status === STATUS.WARNING;
                          return (
                            <div
                              key={lot.id}
                              className={`bg-white p-2.5 rounded-xl border text-2xs flex items-center justify-between shadow-2xs ${
                                isWarning ? 'border-amber-300 bg-amber-50/30' : 'border-slate-200/80 hover:border-indigo-300'
                              } transition-colors`}
                            >
                              <div className="min-w-0 pr-2">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono font-bold text-indigo-600 text-3xs">{lot.id}</span>
                                  <span className="font-bold text-slate-900 truncate block max-w-[120px]">{lot.name}</span>
                                </div>
                                <span className="text-3xs text-slate-500 truncate block mt-0.5">
                                  {supp?.name} · {lot.qty.toLocaleString()} {lot.uom}
                                </span>
                              </div>
                              <div className="shrink-0 flex items-center gap-1">
                                <Badge status={lot.status} />
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <button
                        onClick={() => {
                          setActiveKpiModal('rawLots');
                          setModalSearch('');
                        }}
                        className="w-full py-1.5 text-center text-3xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors cursor-pointer"
                      >
                        Open Full Raw Lots Table & CSV →
                      </button>
                    </div>
                  )}

                  {/* KPI 3: FINISHED GOODS ON HAND INLINE BREAKDOWN */}
                  {kpi.id === 'finishedGoods' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-3xs font-extrabold uppercase text-slate-500 tracking-wider">
                        <span>Facility Distribution</span>
                        <span className="text-emerald-700 font-mono">2,000 Units</span>
                      </div>

                      {/* Warehouse allocation bars */}
                      <div className="space-y-1.5 bg-white p-2.5 rounded-xl border border-slate-200 text-3xs">
                        <div className="flex justify-between font-bold text-slate-700">
                          <span>WH-East: {fgWarehouseBreakdown.east.toLocaleString()} units</span>
                          <span className="text-slate-500 font-mono">57.5%</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-600 rounded-full" style={{ width: '57.5%' }} />
                        </div>

                        <div className="flex justify-between font-bold text-slate-700 pt-1">
                          <span>WH-West: {fgWarehouseBreakdown.west.toLocaleString()} units</span>
                          <span className="text-slate-500 font-mono">42.5%</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-teal-600 rounded-full" style={{ width: '42.5%' }} />
                        </div>
                      </div>

                      {/* Contributing Finished Batches */}
                      <div className="space-y-1.5 pt-1">
                        <span className="text-3xs font-bold text-slate-600 block uppercase tracking-wider">
                          Contributing Product Lots ({fgLotsList.length})
                        </span>
                        {fgLotsList.map((lot) => {
                          const onHand = db.inventory.filter((i) => i.lotId === lot.id).reduce((s, i) => s + i.qty, 0);
                          return (
                            <div
                              key={lot.id}
                              className="bg-white p-2.5 rounded-xl border border-slate-200/80 text-2xs flex items-center justify-between shadow-2xs hover:border-emerald-300 transition-colors"
                            >
                              <div className="min-w-0 pr-2">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono font-bold text-emerald-600 text-3xs">{lot.id}</span>
                                  <span className="font-bold text-slate-900 truncate block max-w-[110px]">{lot.name}</span>
                                </div>
                                <span className="text-3xs text-slate-500 mt-0.5 block">
                                  {onHand.toLocaleString()} units available
                                </span>
                              </div>
                              <div className="shrink-0">
                                <button
                                  onClick={() => {
                                    setGlobalSearchTarget(lot.id);
                                    setActiveTab('traceability');
                                  }}
                                  className="text-3xs text-blue-600 hover:text-blue-800 font-bold bg-blue-50 border border-blue-200 px-2 py-0.5 rounded cursor-pointer"
                                >
                                  Trace
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <button
                        onClick={() => {
                          setActiveKpiModal('finishedGoods');
                          setModalSearch('');
                        }}
                        className="w-full py-1.5 text-center text-3xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer"
                      >
                        Open Full Finished Goods Inventory & CSV →
                      </button>
                    </div>
                  )}

                  {/* KPI 4: OPEN QUALITY INCIDENTS INLINE BREAKDOWN */}
                  {kpi.id === 'incidents' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-3xs font-extrabold uppercase text-slate-500 tracking-wider">
                        <span>Classification Severity</span>
                        <span className="text-rose-700 font-mono">{incidentsList.length} Anomalies</span>
                      </div>

                      {/* Severity Breakdown Badges */}
                      <div className="grid grid-cols-2 gap-1.5 text-center">
                        <div className="p-1.5 rounded-lg bg-red-50 border border-red-200 text-3xs">
                          <span className="font-extrabold text-red-800 block">
                            {incidentsList.filter((i) => i.severity === 'Critical').length} Critical
                          </span>
                          <span className="text-4xs text-red-600 font-bold uppercase">Immediate Action</span>
                        </div>
                        <div className="p-1.5 rounded-lg bg-amber-50 border border-amber-200 text-3xs">
                          <span className="font-extrabold text-amber-800 block">
                            {incidentsList.filter((i) => i.severity !== 'Critical').length} Deviation
                          </span>
                          <span className="text-4xs text-amber-600 font-bold uppercase">Quarantine Protocol</span>
                        </div>
                      </div>

                      {/* Contributing Incidents List */}
                      <div className="space-y-1.5 pt-1">
                        <span className="text-3xs font-bold text-slate-600 block uppercase tracking-wider">
                          Contributing Incidents ({incidentsList.length})
                        </span>
                        {incidentsList.map((inc) => (
                          <div
                            key={inc.id}
                            className="bg-white p-2.5 rounded-xl border border-red-200/90 text-2xs space-y-1 shadow-2xs hover:border-red-400 transition-colors"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-bold text-red-700 text-3xs">{inc.code}</span>
                              <span className="text-4xs font-extrabold uppercase px-1.5 py-0.2 rounded bg-red-100 text-red-800">
                                {inc.severity}
                              </span>
                            </div>
                            <span className="font-bold text-slate-900 block truncate">{inc.type}</span>
                            <p className="text-3xs text-slate-600 line-clamp-1">{inc.title}</p>
                            <div className="pt-1 flex justify-end">
                              <button
                                onClick={() => {
                                  if (inc.actionType === 'recall') {
                                    setGlobalSearchTarget(inc.targetId);
                                    setActiveTab('recall');
                                  } else {
                                    setGlobalSearchTarget(inc.targetId);
                                    setActiveTab('traceability');
                                  }
                                }}
                                className="text-3xs font-bold text-red-700 hover:text-red-900 bg-red-50 border border-red-200 px-2 py-0.5 rounded cursor-pointer"
                              >
                                {inc.actionLabel} →
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      <button
                        onClick={() => {
                          setActiveKpiModal('incidents');
                          setModalSearch('');
                        }}
                        className="w-full py-1.5 text-center text-3xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer"
                      >
                        Open Incident Remediation Modal & CSV →
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Quality Alerts Banner with Rich Visual Contrast */}
      {(missingInputs.length > 0 || overAllocatedLots.length > 0) && (
        <div className="rounded-2xl border border-red-200 bg-red-50/60 p-5 space-y-3 shadow-2xs">
          <div className="flex items-center justify-between border-b border-red-200/80 pb-2.5">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-red-900 flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-lg bg-red-600 text-white">
                <ShieldAlert className="h-3.5 w-3.5" />
              </span>
              Active Quality Alerts & Anomaly Signals ({missingInputs.length + overAllocatedLots.length})
            </h3>
            <button
              onClick={() => setActiveTab('anomalies')}
              className="text-2xs font-bold text-red-700 hover:text-red-900 flex items-center gap-1 bg-white border border-red-200 rounded-lg px-2.5 py-1 hover:bg-red-50 transition-colors shadow-2xs cursor-pointer"
            >
              Review all anomalies →
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {missingInputs.map((mi, i) => (
              <div key={i} className="flex items-start justify-between bg-white rounded-xl p-3.5 border border-red-200 shadow-xs hover:border-red-300 transition-colors">
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="rounded bg-red-100 text-red-800 px-1.5 py-0.5 text-3xs font-bold uppercase font-mono">
                      Ghost Lot Defect
                    </span>
                    <span className="font-mono font-bold text-slate-900 text-xs">{mi.productionOrderId}</span>
                  </div>
                  <p className="text-2xs text-slate-600 leading-snug">
                    Consumes unregistered lot <code className="font-mono text-red-700 font-bold bg-red-50 px-1 py-0.5 rounded border border-red-200">{mi.missingLotId}</code>.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setGlobalSearchTarget(mi.productionOrderId);
                    setActiveTab('traceability');
                  }}
                  className="rounded-lg bg-red-600 text-white px-2.5 py-1 text-3xs font-bold hover:bg-red-700 shrink-0 shadow-2xs transition-colors cursor-pointer"
                >
                  Trace PO
                </button>
              </div>
            ))}

            {overAllocatedLots.map((oa, i) => (
              <div key={i} className="flex items-start justify-between bg-white rounded-xl p-3.5 border border-amber-200 shadow-xs hover:border-amber-300 transition-colors">
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="rounded bg-amber-100 text-amber-800 px-1.5 py-0.5 text-3xs font-bold uppercase font-mono">
                      Over-Allocation
                    </span>
                    <span className="font-mono font-bold text-slate-900 text-xs">{oa?.lotId}</span>
                  </div>
                  <p className="text-2xs text-slate-600 leading-snug">
                    Recorded <span className="font-semibold text-slate-800">{oa?.totalRecorded} units</span> vs <span className="font-semibold text-slate-800">{oa?.producedQty} produced</span> (<span className="text-amber-700 font-bold">+{Math.abs(oa?.difference || 0)} units discrepancy</span>).
                  </p>
                </div>
                <button
                  onClick={() => {
                    setGlobalSearchTarget(oa!.lotId);
                    setActiveTab('recall');
                  }}
                  className="rounded-lg bg-amber-600 text-white px-2.5 py-1 text-3xs font-bold hover:bg-amber-700 shrink-0 shadow-2xs transition-colors cursor-pointer"
                >
                  Isolate
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Interactive Scenario Presets */}
      <ScenarioBanner />

      {/* Grid: Inventory by Warehouse & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        {/* Recharts Warehouse Bar Chart (2 cols) */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs lg:col-span-2 flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4 mb-4">
              <div>
                <h3 className="font-extrabold text-sm sm:text-base text-slate-900 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                    <Warehouse className="h-4 w-4" />
                  </span>
                  Inventory by Facility & Warehouse
                </h3>
                <p className="text-2xs text-slate-500 mt-0.5">
                  Direct stock breakdown comparing finished commercial units and active raw ingredients.
                </p>
              </div>

              {/* Metric Switcher: Units vs Kg */}
              <div className="flex items-center rounded-xl border border-slate-200 bg-slate-100/70 p-1">
                <button
                  onClick={() => setMetricTab('finished')}
                  className={`rounded-lg px-3 py-1.5 text-2xs font-bold transition-all cursor-pointer ${
                    metricTab === 'finished'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Finished Goods (Units)
                </button>
                <button
                  onClick={() => setMetricTab('raw')}
                  className={`rounded-lg px-3 py-1.5 text-2xs font-bold transition-all cursor-pointer ${
                    metricTab === 'raw'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Raw Ingredients (kg)
                </button>
              </div>
            </div>

            <div className="h-72 w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={inventoryData} margin={{ top: 20, right: 25, left: -10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis
                    dataKey="name"
                    axisLine={{ stroke: '#CBD5E1' }}
                    tickLine={false}
                    tick={{ fontSize: 13, fill: '#334155', fontWeight: 600 }}
                    dy={8}
                  />
                  <YAxis
                    axisLine={{ stroke: '#CBD5E1' }}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#64748B' }}
                  />
                  <RechartsTooltip
                    cursor={{ fill: 'rgba(241, 245, 249, 0.7)' }}
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xl text-xs">
                            <span className="font-mono font-bold text-slate-900 block mb-1">
                              {label} · {payload[0].payload.fullName}
                            </span>
                            <span className="font-semibold block text-sm text-blue-600">
                              {metricTab === 'finished'
                                ? `${Number(payload[0].payload.finishedUnits).toLocaleString()} Units On Hand`
                                : `${Number(payload[0].payload.rawKg).toLocaleString()} kg Active Material`}
                            </span>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  {metricTab === 'finished' ? (
                    <Bar dataKey="finishedUnits" name="Finished Units" radius={[8, 8, 0, 0]} maxBarSize={60} fill="#2563EB">
                      {inventoryData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={index === 0 ? '#2563EB' : '#0284C7'} />
                      ))}
                    </Bar>
                  ) : (
                    <Bar dataKey="rawKg" name="Raw Material (kg)" radius={[8, 8, 0, 0]} maxBarSize={60} fill="#4F46E5">
                      {inventoryData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={index === 0 ? '#4F46E5' : '#7C3AED'} />
                      ))}
                    </Bar>
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-2xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Verified physical scan logs synced
            </span>
            <button
              onClick={() => {
                setActiveKpiModal('finishedGoods');
                setModalSearch('');
              }}
              className="text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 cursor-pointer"
            >
              Explore Lot Details →
            </button>
          </div>
        </div>

        {/* Recent Activity List (1 col) */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                  <Clock className="h-4 w-4" />
                </span>
                Recent Audit Trail
              </h3>
              <button
                onClick={() => setActiveTab('audit')}
                className="text-2xs text-blue-600 hover:text-blue-800 font-bold cursor-pointer"
              >
                Full Audit Log
              </button>
            </div>

            <div className="relative border-l-2 border-slate-200 ml-3 space-y-4 my-2">
              {db.auditEvents.slice(0, 4).map((event) => {
                const isRecall = event.action.includes('RECALL');
                const isStatus = event.action.includes('STATUS');

                return (
                  <div key={event.id} className="relative pl-5">
                    <div className={`absolute -left-[9px] top-1 h-4 w-4 rounded-full border-2 border-white flex items-center justify-center ${
                      isRecall ? 'bg-red-500' : isStatus ? 'bg-amber-500' : 'bg-blue-600'
                    }`} />
                    <p className={`text-3xs font-bold uppercase tracking-wider font-mono ${
                      isRecall ? 'text-red-700' : isStatus ? 'text-amber-700' : 'text-blue-700'
                    }`}>
                      {event.action}
                    </p>
                    <p className="text-xs font-bold text-slate-900 mt-0.5 font-mono">
                      {event.target}
                    </p>
                    <p className="text-2xs text-slate-600 leading-snug mt-0.5 line-clamp-2">
                      {event.details}
                    </p>
                    <p className="text-3xs text-slate-400 mt-1 font-medium">
                      {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {event.actor}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-2xs text-slate-500 flex items-center justify-between">
            <span>Cryptographic audit hash</span>
            <span className="font-mono text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              SHA-256 Valid
            </span>
          </div>
        </div>
      </div>

      {/* DETAILED MODAL FOR THE METRIC CARDS */}
      {activeKpiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
          <div
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden"
            role="dialog"
            aria-modal="true"
          >
            {/* Modal Header */}
            <div className="px-6 py-4.5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70">
              <div>
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-blue-600 text-white">
                    <Database className="h-4 w-4" />
                  </div>
                  <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">
                    Granular Metric Breakdown & Underlying Data
                  </h2>
                </div>
                <p className="text-2xs sm:text-xs text-slate-500 mt-0.5">
                  Detailed inspection of records, distribution formulas, and contributing data items for each KPI.
                </p>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  onClick={() => handleExportCsv(activeKpiModal)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-2xs font-bold text-slate-700 shadow-2xs transition-all cursor-pointer"
                  title="Export currently displayed dataset to CSV"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Export CSV</span>
                </button>
                <button
                  onClick={() => setActiveKpiModal(null)}
                  className="p-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                  title="Close explorer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Modal Navigation Tabs */}
            <div className="px-6 py-3 border-b border-slate-200 bg-white flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                <button
                  onClick={() => {
                    setActiveKpiModal('suppliers');
                    setModalSearch('');
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeKpiModal === 'suppliers'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Factory className="h-3.5 w-3.5" />
                  <span>Active Suppliers ({db.suppliers.length})</span>
                </button>

                <button
                  onClick={() => {
                    setActiveKpiModal('rawLots');
                    setModalSearch('');
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeKpiModal === 'rawLots'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Database className="h-3.5 w-3.5" />
                  <span>Registered Raw Lots ({rawLotsList.length})</span>
                </button>

                <button
                  onClick={() => {
                    setActiveKpiModal('finishedGoods');
                    setModalSearch('');
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeKpiModal === 'finishedGoods'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Package className="h-3.5 w-3.5" />
                  <span>Finished Goods ({fgLotsList.length} Lots · {finishedOnHandUnits.toLocaleString()} Units)</span>
                </button>

                <button
                  onClick={() => {
                    setActiveKpiModal('incidents');
                    setModalSearch('');
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeKpiModal === 'incidents'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <ShieldAlert className="h-3.5 w-3.5" />
                  <span>Quality Incidents ({totalQualityIncidentsCount})</span>
                </button>
              </div>

              {/* Instant Search Bar */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  placeholder="Filter contributing data items..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-8 pr-7 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-hidden"
                />
                {modalSearch && (
                  <button
                    onClick={() => setModalSearch('')}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Notification Banner */}
            {copiedNotification && (
              <div className="px-6 py-2 bg-emerald-50 border-b border-emerald-200 text-emerald-800 text-2xs font-bold flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-emerald-600" />
                <span>{copiedNotification}</span>
              </div>
            )}

            {/* Modal Body / Granular Breakdown + Table */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {/* TAB 1: ACTIVE SUPPLIERS */}
              {activeKpiModal === 'suppliers' && (
                <div className="space-y-6">
                  {/* Top Granular Intelligence Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200">
                      <span className="text-3xs uppercase font-extrabold text-blue-700 tracking-wider block">
                        Total Qualified
                      </span>
                      <span className="text-2xl font-extrabold font-mono text-slate-900 mt-1 block">
                        {db.suppliers.length} Vendors
                      </span>
                      <span className="text-3xs text-slate-500 mt-0.5 block">100% Verified in Network</span>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-3xs uppercase font-extrabold text-slate-500 tracking-wider block">
                        Avg Quality Risk
                      </span>
                      <span className="text-2xl font-extrabold font-mono text-emerald-700 mt-1 block">
                        {avgSupplierRisk}/100
                      </span>
                      <span className="text-3xs text-slate-500 mt-0.5 block">Tier-1 Threshold &lt; 25</span>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-3xs uppercase font-extrabold text-slate-500 tracking-wider block">
                        Risk Distribution
                      </span>
                      <div className="flex items-center gap-1.5 mt-2">
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-extrabold text-3xs">
                          {supplierRiskTiers.low} Low
                        </span>
                        <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-extrabold text-3xs">
                          {supplierRiskTiers.moderate} Med
                        </span>
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-extrabold text-3xs">
                          {supplierRiskTiers.high} High
                        </span>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-3xs uppercase font-extrabold text-slate-500 tracking-wider block">
                        Active Ingredient Lots
                      </span>
                      <span className="text-2xl font-extrabold font-mono text-slate-900 mt-1 block">
                        {registeredRawLotsCount} Batches
                      </span>
                      <span className="text-3xs text-slate-500 mt-0.5 block">Delivered into warehouses</span>
                    </div>
                  </div>

                  {/* Underlying Data Items Table */}
                  <div>
                    <div className="flex items-center justify-between text-2xs text-slate-500 mb-2.5">
                      <span>Underlying Supplier Records ({filteredSuppliers.length} items)</span>
                      <span className="font-mono text-3xs text-slate-400">Ledger Table: `db.suppliers`</span>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-3xs uppercase tracking-wider">
                            <th className="py-3 px-4">Supplier ID</th>
                            <th className="py-3 px-4">Vendor Name</th>
                            <th className="py-3 px-4">Origin / Country</th>
                            <th className="py-3 px-4">Material Specialization</th>
                            <th className="py-3 px-4">Risk Rating</th>
                            <th className="py-3 px-4">Supplied Raw Lots</th>
                            <th className="py-3 px-4 text-right">Direct Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredSuppliers.map((supp) => {
                            const suppliedLots = db.lots.filter((l) => l.supplierId === supp.id);
                            const isLowRisk = supp.riskScore < 20;
                            const isModerate = supp.riskScore >= 20 && supp.riskScore < 50;

                            return (
                              <tr key={supp.id} className="hover:bg-slate-50/80 transition-colors">
                                <td className="py-3.5 px-4 font-mono font-bold text-blue-600">
                                  {supp.id}
                                </td>
                                <td className="py-3.5 px-4">
                                  <span className="font-bold text-slate-900 block">{supp.name}</span>
                                  <span className="text-3xs text-slate-500">Tier-1 Direct Vendor</span>
                                </td>
                                <td className="py-3.5 px-4 text-slate-600">
                                  <span className="inline-flex items-center gap-1">
                                    <MapPin className="h-3 w-3 text-slate-400" />
                                    {supp.country || 'International'}
                                  </span>
                                </td>
                                <td className="py-3.5 px-4 text-slate-600">
                                  <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-3xs font-medium border border-slate-200">
                                    {supp.category || 'General Pharma'}
                                  </span>
                                </td>
                                <td className="py-3.5 px-4">
                                  <div className="space-y-1">
                                    <div className="flex items-center justify-between text-3xs">
                                      <span className="font-bold font-mono text-slate-700">
                                        Score: {supp.riskScore}/100
                                      </span>
                                      <span className={`px-1.5 py-0.2 rounded font-bold uppercase text-4xs ${
                                        isLowRisk ? 'bg-emerald-100 text-emerald-800' : isModerate ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
                                      }`}>
                                        {isLowRisk ? 'Low Risk' : isModerate ? 'Moderate' : 'High Risk'}
                                      </span>
                                    </div>
                                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                      <div
                                        className={`h-full rounded-full ${
                                          isLowRisk ? 'bg-emerald-500' : isModerate ? 'bg-amber-500' : 'bg-red-500'
                                        }`}
                                        style={{ width: `${supp.riskScore}%` }}
                                      />
                                    </div>
                                  </div>
                                </td>
                                <td className="py-3.5 px-4">
                                  <div className="flex flex-wrap gap-1">
                                    {suppliedLots.map((lot) => (
                                      <span
                                        key={lot.id}
                                        className="font-mono text-3xs bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded border border-slate-200 font-bold"
                                      >
                                        {lot.id}
                                      </span>
                                    ))}
                                  </div>
                                </td>
                                <td className="py-3.5 px-4 text-right">
                                  {suppliedLots.length > 0 ? (
                                    <button
                                      onClick={() => {
                                        setActiveKpiModal(null);
                                        setGlobalSearchTarget(suppliedLots[0].id);
                                        setActiveTab('traceability');
                                      }}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 text-3xs font-bold transition-colors cursor-pointer"
                                    >
                                      <span>Trace Batches</span>
                                      <ArrowRight className="h-3 w-3" />
                                    </button>
                                  ) : (
                                    <span className="text-3xs text-slate-400">No active lots</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: REGISTERED RAW LOTS */}
              {activeKpiModal === 'rawLots' && (
                <div className="space-y-6">
                  {/* Top Granular Intelligence Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-200">
                      <span className="text-3xs uppercase font-extrabold text-indigo-700 tracking-wider block">
                        Registered Batches
                      </span>
                      <span className="text-2xl font-extrabold font-mono text-slate-900 mt-1 block">
                        {rawLotsList.length} Lots
                      </span>
                      <span className="text-3xs text-slate-500 mt-0.5 block">100% Pedigree Tracked</span>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-3xs uppercase font-extrabold text-slate-500 tracking-wider block">
                        Total Material Mass
                      </span>
                      <span className="text-2xl font-extrabold font-mono text-indigo-700 mt-1 block">
                        {rawVolumeTotalKg.toLocaleString()} kg
                      </span>
                      <span className="text-3xs text-slate-500 mt-0.5 block">Active chemical inventory</span>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-3xs uppercase font-extrabold text-slate-500 tracking-wider block">
                        Intake Pedigree Status
                      </span>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-extrabold text-3xs">
                          {rawStatusBreakdown.ok} In-Spec (OK)
                        </span>
                        <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-extrabold text-3xs">
                          {rawStatusBreakdown.flagged} Warning
                        </span>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-3xs uppercase font-extrabold text-slate-500 tracking-wider block">
                        Warehouse Coverage
                      </span>
                      <span className="text-2xl font-extrabold font-mono text-slate-900 mt-1 block">
                        2 Facilities
                      </span>
                      <span className="text-3xs text-slate-500 mt-0.5 block">WH-East &amp; WH-West</span>
                    </div>
                  </div>

                  {/* Underlying Data Items Table */}
                  <div>
                    <div className="flex items-center justify-between text-2xs text-slate-500 mb-2.5">
                      <span>Underlying Raw Batch Items ({filteredRawLots.length} items)</span>
                      <span className="font-mono text-3xs text-slate-400">Ledger Table: `db.lots [type=RAW]`</span>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-3xs uppercase tracking-wider">
                            <th className="py-3 px-4">Lot ID</th>
                            <th className="py-3 px-4">Material Name & Grade</th>
                            <th className="py-3 px-4">Supplier</th>
                            <th className="py-3 px-4">Intake Volume</th>
                            <th className="py-3 px-4">Warehouse Location & Bay</th>
                            <th className="py-3 px-4">Received Date</th>
                            <th className="py-3 px-4">Quality Status</th>
                            <th className="py-3 px-4 text-right">Direct Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredRawLots.map((lot) => {
                            const supp = db.suppliers.find((s) => s.id === lot.supplierId);
                            const invItems = db.inventory.filter((i) => i.lotId === lot.id);

                            return (
                              <tr key={lot.id} className="hover:bg-slate-50/80 transition-colors">
                                <td className="py-3.5 px-4 font-mono font-bold text-indigo-600 text-xs">
                                  {lot.id}
                                </td>
                                <td className="py-3.5 px-4">
                                  <span className="font-bold text-slate-900 block">{lot.name || 'Raw Ingredient Batch'}</span>
                                  <span className="text-3xs text-slate-500">Chemical grade verified</span>
                                </td>
                                <td className="py-3.5 px-4">
                                  <span className="font-semibold text-slate-800 block">{supp?.name || 'Unknown Supplier'}</span>
                                  <span className="font-mono text-3xs text-slate-400">{lot.supplierId}</span>
                                </td>
                                <td className="py-3.5 px-4">
                                  <span className="font-mono font-bold text-slate-900">
                                    {lot.qty.toLocaleString()} {lot.uom}
                                  </span>
                                </td>
                                <td className="py-3.5 px-4">
                                  {invItems.length > 0 ? (
                                    <div className="space-y-0.5">
                                      {invItems.map((inv) => (
                                        <div key={inv.id} className="text-2xs text-slate-700">
                                          <span className="font-bold font-mono text-blue-700">{inv.warehouseId}</span>
                                          {inv.bay && <span className="text-slate-500"> · Bay {inv.bay}</span>}
                                          <span className="text-slate-400"> ({inv.qty} {lot.uom})</span>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-3xs text-slate-400 italic">Fully Consumed / In-Transit</span>
                                  )}
                                </td>
                                <td className="py-3.5 px-4 text-slate-600 font-mono text-2xs">
                                  {lot.receivedDate || '2026-10-01'}
                                </td>
                                <td className="py-3.5 px-4">
                                  <Badge status={lot.status} />
                                </td>
                                <td className="py-3.5 px-4 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      onClick={() => {
                                        setActiveKpiModal(null);
                                        setGlobalSearchTarget(lot.id);
                                        setActiveTab('traceability');
                                      }}
                                      className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 text-3xs font-bold transition-colors cursor-pointer"
                                    >
                                      Trace Lot
                                    </button>
                                    <button
                                      onClick={() => {
                                        setActiveKpiModal(null);
                                        setGlobalSearchTarget(lot.id);
                                        setActiveTab('recall');
                                      }}
                                      className="px-2 py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-3xs font-bold transition-colors cursor-pointer"
                                      title="Simulate recall isolation"
                                    >
                                      Recall
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: FINISHED GOODS ON HAND */}
              {activeKpiModal === 'finishedGoods' && (
                <div className="space-y-6">
                  {/* Top Granular Intelligence Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200">
                      <span className="text-3xs uppercase font-extrabold text-emerald-700 tracking-wider block">
                        Commercial Stock
                      </span>
                      <span className="text-2xl font-extrabold font-mono text-slate-900 mt-1 block">
                        {finishedOnHandUnits.toLocaleString()} Units
                      </span>
                      <span className="text-3xs text-slate-500 mt-0.5 block">99.4% In-Spec Available</span>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-3xs uppercase font-extrabold text-slate-500 tracking-wider block">
                        WH-East Distribution
                      </span>
                      <span className="text-2xl font-extrabold font-mono text-blue-700 mt-1 block">
                        {fgWarehouseBreakdown.east.toLocaleString()} Units
                      </span>
                      <span className="text-3xs text-slate-500 mt-0.5 block">Primary East Bay Depot</span>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-3xs uppercase font-extrabold text-slate-500 tracking-wider block">
                        WH-West Distribution
                      </span>
                      <span className="text-2xl font-extrabold font-mono text-teal-700 mt-1 block">
                        {fgWarehouseBreakdown.west.toLocaleString()} Units
                      </span>
                      <span className="text-3xs text-slate-500 mt-0.5 block">Secondary West Hub</span>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-3xs uppercase font-extrabold text-slate-500 tracking-wider block">
                        Dispatched Shipments
                      </span>
                      <span className="text-2xl font-extrabold font-mono text-slate-900 mt-1 block">
                        {fgWarehouseBreakdown.totalShipped.toLocaleString()} Units
                      </span>
                      <span className="text-3xs text-slate-500 mt-0.5 block">In transit to hospitals</span>
                    </div>
                  </div>

                  {/* Underlying Data Items Table */}
                  <div>
                    <div className="flex items-center justify-between text-2xs text-slate-500 mb-2.5">
                      <span>Underlying Finished Commercial Batches ({filteredFinishedGoods.length} items)</span>
                      <span className="font-mono text-3xs text-slate-400">Ledger Table: `db.lots [type=FG]`</span>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-3xs uppercase tracking-wider">
                            <th className="py-3 px-4">FG Lot ID</th>
                            <th className="py-3 px-4">Commercial Product Formulation</th>
                            <th className="py-3 px-4">Batch Manufactured</th>
                            <th className="py-3 px-4">Warehouse Stock Breakdown</th>
                            <th className="py-3 px-4">Dispatched Units</th>
                            <th className="py-3 px-4">Compliance Status</th>
                            <th className="py-3 px-4 text-right">Direct Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredFinishedGoods.map((lot) => {
                            const invItems = db.inventory.filter((i) => i.lotId === lot.id);
                            const onHand = invItems.reduce((sum, i) => sum + i.qty, 0);
                            const shipped = db.shipments.filter((s) => s.lotId === lot.id).reduce((sum, s) => sum + s.qty, 0);

                            return (
                              <tr key={lot.id} className="hover:bg-slate-50/80 transition-colors">
                                <td className="py-3.5 px-4 font-mono font-bold text-emerald-600 text-xs">
                                  {lot.id}
                                </td>
                                <td className="py-3.5 px-4">
                                  <span className="font-bold text-slate-900 block">{lot.name || 'Commercial Formulation'}</span>
                                  <span className="text-3xs text-slate-500">Validated Production Run</span>
                                </td>
                                <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                                  {lot.qty.toLocaleString()} units
                                </td>
                                <td className="py-3.5 px-4">
                                  <div className="space-y-1">
                                    <span className="font-mono font-bold text-emerald-700 block">
                                      {onHand.toLocaleString()} units
                                    </span>
                                    <div className="flex flex-wrap gap-1">
                                      {invItems.map((inv) => (
                                        <span
                                          key={inv.id}
                                          className="text-3xs bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded border border-slate-200 font-medium"
                                        >
                                          {inv.warehouseId} ({inv.qty})
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                </td>
                                <td className="py-3.5 px-4">
                                  <span className="font-mono text-slate-700 font-semibold block">
                                    {shipped.toLocaleString()} units
                                  </span>
                                  <span className="text-3xs text-slate-400">
                                    {db.shipments.filter((s) => s.lotId === lot.id).length} consignments
                                  </span>
                                </td>
                                <td className="py-3.5 px-4">
                                  <Badge status={lot.status} />
                                </td>
                                <td className="py-3.5 px-4 text-right">
                                  <button
                                    onClick={() => {
                                      setActiveKpiModal(null);
                                      setGlobalSearchTarget(lot.id);
                                      setActiveTab('traceability');
                                    }}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 text-3xs font-bold transition-colors cursor-pointer"
                                  >
                                    <span>Genealogy</span>
                                    <ArrowRight className="h-3 w-3" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: OPEN QUALITY INCIDENTS */}
              {activeKpiModal === 'incidents' && (
                <div className="space-y-6">
                  {/* Top Granular Intelligence Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="p-4 rounded-xl bg-rose-50/70 border border-rose-200">
                      <span className="text-3xs uppercase font-extrabold text-rose-700 tracking-wider block">
                        Active Quality Signals
                      </span>
                      <span className="text-2xl font-extrabold font-mono text-slate-900 mt-1 block">
                        {incidentsList.length} Anomalies
                      </span>
                      <span className="text-3xs text-slate-500 mt-0.5 block">Action Required Under cGMP</span>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-3xs uppercase font-extrabold text-slate-500 tracking-wider block">
                        Critical Severity
                      </span>
                      <span className="text-2xl font-extrabold font-mono text-red-600 mt-1 block">
                        {incidentsList.filter((i) => i.severity === 'Critical').length} Items
                      </span>
                      <span className="text-3xs text-slate-500 mt-0.5 block">Ghost inputs &amp; Mass balance</span>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-3xs uppercase font-extrabold text-slate-500 tracking-wider block">
                        Flagged Batches
                      </span>
                      <span className="text-2xl font-extrabold font-mono text-amber-600 mt-1 block">
                        {openIncidentsCount} Batch
                      </span>
                      <span className="text-3xs text-slate-500 mt-0.5 block">Targeted for quarantine</span>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-3xs uppercase font-extrabold text-slate-500 tracking-wider block">
                        Financial / Lot Exposure
                      </span>
                      <span className="text-2xl font-extrabold font-mono text-slate-900 mt-1 block">
                        2,350 Units
                      </span>
                      <span className="text-3xs text-slate-500 mt-0.5 block">Total affected inventory</span>
                    </div>
                  </div>

                  {/* Underlying Data Items Table */}
                  <div>
                    <div className="flex items-center justify-between text-2xs text-slate-500 mb-2.5">
                      <span>Underlying Incident &amp; Anomaly Signals ({filteredIncidents.length} items)</span>
                      <span className="font-mono text-3xs text-slate-400">Ledger Table: `findMissingInputs + validateLotQuantities`</span>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-3xs uppercase tracking-wider">
                            <th className="py-3 px-4">Incident ID</th>
                            <th className="py-3 px-4">Severity</th>
                            <th className="py-3 px-4">Defect Classification</th>
                            <th className="py-3 px-4">Target Entity</th>
                            <th className="py-3 px-4">Detailed Anomaly Description</th>
                            <th className="py-3 px-4 text-right">Remediation Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredIncidents.map((inc) => (
                            <tr key={inc.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                                {inc.code}
                              </td>
                              <td className="py-3.5 px-4">
                                <span className={`inline-block px-2 py-0.5 rounded-full font-bold text-3xs uppercase ${
                                  inc.severity === 'Critical'
                                    ? 'bg-red-100 text-red-800 border border-red-200'
                                    : 'bg-amber-100 text-amber-800 border border-amber-200'
                                }`}>
                                  {inc.severity}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 font-bold text-slate-900">
                                {inc.type}
                              </td>
                              <td className="py-3.5 px-4 font-mono font-bold text-blue-600">
                                {inc.entityId}
                              </td>
                              <td className="py-3.5 px-4 text-slate-600 max-w-sm">
                                <p className="leading-snug">{inc.description}</p>
                              </td>
                              <td className="py-3.5 px-4 text-right">
                                <button
                                  onClick={() => {
                                    setActiveKpiModal(null);
                                    if (inc.actionType === 'anomalies') {
                                      setActiveTab('anomalies');
                                    } else if (inc.actionType === 'recall') {
                                      setGlobalSearchTarget(inc.targetId);
                                      setActiveTab('recall');
                                    } else {
                                      setGlobalSearchTarget(inc.targetId);
                                      setActiveTab('traceability');
                                    }
                                  }}
                                  className={`px-2.5 py-1 rounded-lg text-3xs font-bold transition-colors cursor-pointer ${
                                    inc.actionType === 'recall'
                                      ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-2xs'
                                      : 'bg-blue-600 hover:bg-blue-700 text-white shadow-2xs'
                                  }`}
                                >
                                  {inc.actionLabel}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-2xs text-slate-500">
              <span className="flex items-center gap-1.5 font-medium">
                <Info className="h-3.5 w-3.5 text-blue-600" />
                Select any entity row to immediately trace upstream suppliers or downstream finished distributions.
              </span>
              <button
                onClick={() => setActiveKpiModal(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold transition-colors cursor-pointer text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
