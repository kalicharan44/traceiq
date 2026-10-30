import express from 'express';
import cors from 'cors';
import { dashboardSummary, database, traceabilityGraph } from './data/mockData.js';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'traceiq-backend' });
});

app.get('/api/dashboard', (req, res) => {
  res.json(dashboardSummary);
});

app.get('/api/database', (req, res) => {
  res.json(database);
});

app.get('/api/traceability', (req, res) => {
  const { targetId = 'ALL' } = req.query;

  const result = {
    ...traceabilityGraph,
    targetId: String(targetId),
    suppliers: traceabilityGraph.suppliers,
    rawLots: traceabilityGraph.rawLots,
    pos: traceabilityGraph.pos,
    fgLots: traceabilityGraph.fgLots,
    inventory: traceabilityGraph.inventory,
    shipments: traceabilityGraph.shipments,
    customers: traceabilityGraph.customers,
    missingLots: traceabilityGraph.missingLots
  };

  res.json(result);
});

app.get('/api/recalls', (req, res) => {
  res.json({
    active: [{ id: 'RC-101', lotId: 'RAW-1042', severity: 'HIGH', status: 'OPEN' }],
    count: 1
  });
});

export default app;
