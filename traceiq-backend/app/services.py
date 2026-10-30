"""Deterministic domain workflows for traceability, quality, and recalls."""

from __future__ import annotations

import random
from datetime import datetime, timezone
from uuid import uuid4
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import (
    AuditEvent,
    CorrectiveAction,
    InventoryReceiptCreate,
    Customer,
    InventoryBalance,
    Lot,
    ProductionInput,
    ProductionOrder,
    Product,
    QualityCheck,
    ProductionOrderCreate,
    RecallAction,
    RecallCase,
    Shipment,
    ShipmentCreate,
    Supplier,
    SupplierCreate,
    utc_now,
)


def new_id(prefix: str) -> str:
    return f"{prefix}-{uuid4().hex[:12].upper()}"


def record_audit(
    db: Session,
    entity_type: str,
    entity_id: str,
    action: str,
    actor: str,
    description: str,
    details: dict[str, Any] | None = None,
) -> AuditEvent:
    event = AuditEvent(
        id=new_id("AUD"),
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        actor=actor,
        description=description,
        details=details or {},
    )
    db.add(event)
    return event


def seed_demo_data(db: Session) -> None:
    """Load a small, deterministic demo graph with isolated validation scenarios."""
    if db.scalar(select(func.count()).select_from(Supplier)):
        return

    suppliers = [
        Supplier(id="SUP-001", name="Apex Materials Ltd.", country="Germany", risk_score=12),
        Supplier(id="SUP-002", name="Global Synthetics Inc.", country="United States", risk_score=38),
        Supplier(id="SUP-003", name="Naturals Co.", country="India", risk_score=6),
    ]
    product = Product(id="PROD-001", name="TraceRelief 500 mg", sku="TR-500", unit="units", unit_price_usd=18.5)
    customers = [
        Customer(id="CUST-001", name="Northstar Medical Center", contact_email="recall@northstar.example", location="Chicago, IL", tier="Critical Healthcare"),
        Customer(id="CUST-002", name="Lakeside Pharmacy Group", contact_email="quality@lakeside.example", location="Milwaukee, WI", tier="Retail Pharmacy"),
        Customer(id="CUST-003", name="Central Hospital Network", contact_email="safety@central.example", location="Columbus, OH", tier="Critical Healthcare"),
        Customer(id="CUST-004", name="Harbor Pharmacy", contact_email="ops@harbor.example", location="Boston, MA", tier="Retail Pharmacy"),
    ]
    db.add_all([*suppliers, product, *customers])
    db.flush()

    raw_lots = [
        Lot(id="RAW-1042", lot_type="RAW", name="Acetaminophen API", supplier_id="SUP-001", quantity=500, unit="kg", status="APPROVED"),
        Lot(id="RAW-1043", lot_type="RAW", name="Microcrystalline cellulose", supplier_id="SUP-002", quantity=250, unit="kg", status="APPROVED"),
        Lot(id="RAW-1044", lot_type="RAW", name="Coating polymer", supplier_id="SUP-003", quantity=300, unit="kg", status="APPROVED"),
        Lot(id="RAW-1045", lot_type="RAW", name="Packaging film", supplier_id="SUP-002", quantity=900, unit="kg", status="APPROVED"),
    ]
    orders = [
        ProductionOrder(id="PO-5001", product_id=product.id, facility="Chicago Plant", status="COMPLETED", completed_at=utc_now()),
        ProductionOrder(id="PO-5002", product_id=product.id, facility="Chicago Plant", status="COMPLETED", completed_at=utc_now()),
        ProductionOrder(id="PO-5003", product_id=product.id, facility="Chicago Plant", status="FLAGGED", completed_at=utc_now()),
        ProductionOrder(id="PO-5004", product_id=product.id, facility="Reno Plant", status="COMPLETED", completed_at=utc_now()),
    ]
    db.add_all([*raw_lots, *orders])
    db.flush()

    finished = [
        Lot(id="FG-7001", lot_type="FG", name="TraceRelief Commercial Lot A", product_id=product.id, production_order_id="PO-5001", quantity=1000, unit="units", status="RELEASED"),
        Lot(id="FG-7002", lot_type="FG", name="TraceRelief Commercial Lot B", product_id=product.id, production_order_id="PO-5002", quantity=700, unit="units", status="RELEASED"),
        Lot(id="FG-7003", lot_type="FG", name="Flagged Yield Scenario", product_id=product.id, production_order_id="PO-5003", quantity=100, unit="units", status="QUARANTINED"),
        Lot(id="FG-7004", lot_type="FG", name="Missing Recipient Scenario", product_id=product.id, production_order_id="PO-5004", quantity=500, unit="units", status="RELEASED"),
    ]
    db.add_all(finished)
    db.flush()

    db.add_all([
        ProductionInput(production_order_id="PO-5001", input_lot_id="RAW-1042", quantity=250, unit="kg"),
        ProductionInput(production_order_id="PO-5001", input_lot_id="RAW-1043", quantity=40, unit="kg"),
        ProductionInput(production_order_id="PO-5002", input_lot_id="RAW-1042", quantity=180, unit="kg"),
        ProductionInput(production_order_id="PO-5003", input_lot_id="RAW-GHOST-9001", quantity=50, unit="kg"),
        ProductionInput(production_order_id="PO-5003", input_lot_id="RAW-1044", quantity=20, unit="kg"),
        ProductionInput(production_order_id="PO-5004", input_lot_id="RAW-1045", quantity=100, unit="kg"),
    ])
    db.add_all([
        InventoryBalance(id="INV-8001", lot_id="FG-7001", warehouse_id="WH-CHI-1", warehouse_name="Chicago Hub", quantity=300, unit="units", status="AVAILABLE", bay="A-04"),
        InventoryBalance(id="INV-8002", lot_id="FG-7002", warehouse_id="WH-CHI-1", warehouse_name="Chicago Hub", quantity=200, unit="units", status="AVAILABLE", bay="B-10"),
        InventoryBalance(id="INV-8003", lot_id="FG-7003", warehouse_id="WH-CHI-1", warehouse_name="Chicago Hub", quantity=30, unit="units", status="AVAILABLE", bay="C-02"),
        InventoryBalance(id="INV-8004", lot_id="FG-7004", warehouse_id="WH-NV-4", warehouse_name="Reno Depot", quantity=400, unit="units", status="AVAILABLE", bay="A-03"),
    ])
    db.add_all([
        Shipment(id="SHP-9001", lot_id="FG-7001", customer_id="CUST-001", quantity=400, unit="units", status="DELIVERED", destination="Chicago, IL", tracking_number="TRK-9001"),
        Shipment(id="SHP-9002", lot_id="FG-7001", customer_id="CUST-002", quantity=300, unit="units", status="IN_TRANSIT", destination="Milwaukee, WI", tracking_number="TRK-9002"),
        Shipment(id="SHP-9003", lot_id="FG-7002", customer_id="CUST-003", quantity=500, unit="units", status="DELIVERED", destination="Columbus, OH", tracking_number="TRK-9003"),
        # Planted over-allocation scenario: 100 produced, 100 shipped, and 30 still in stock.
        Shipment(id="SHP-9004", lot_id="FG-7003", customer_id="CUST-004", quantity=100, unit="units", status="DELIVERED", destination="Boston, MA", tracking_number="TRK-9004"),
        # Planted missing-recipient scenario; test ground truth records the intended recipient separately.
        Shipment(id="SHP-9005", lot_id="FG-7004", customer_id=None, quantity=100, unit="units", status="DELIVERED", destination="Boston, MA", tracking_number="TRK-9005"),
    ])
    db.add(QualityCheck(
        id="QC-7003", entity_type="LOT", entity_id="FG-7003", rule_version="release-v1",
        result="FAIL", findings=[{"code": "QUANTITY_OVERAGE", "message": "Recorded stock and shipments exceed the produced quantity."}],
        evidence=[{"source": "PO-5003", "description": "Production and distribution ledger"}], checked_by="Quality Operations",
    ))
    db.add(CorrectiveAction(
        id="CAPA-7003", check_id="QC-7003", entity_type="LOT", entity_id="FG-7003",
        description="Investigate the lot quantity over-allocation and document disposition.", status="OPEN",
    ))
    record_audit(db, "LOT", "RAW-1042", "LOT_RECEIVED", "Demo Seeder", "Raw material lot received and linked to supplier.", {"supplier_id": "SUP-001", "quantity": 500, "unit": "kg"})
    record_audit(db, "QUALITY_CHECK", "QC-7003", "QUALITY_CHECK_FAILED", "Quality Operations", "A deterministic release check found a quantity over-allocation.", {"rule_version": "release-v1"})
    db.commit()


def seed_synthetic_dataset(db: Session, seed: int = 20261022) -> dict[str, int]:
    """Load the requested larger synthetic dataset; invoke only on an empty database."""
    if db.scalar(select(func.count()).select_from(Supplier)):
        raise ValueError("Synthetic dataset loading requires an empty database.")
    rng = random.Random(seed)
    now = utc_now()
    suppliers = [Supplier(id=f"SUP-{i:04d}", name=f"Synthetic Supplier {i:04d}", country=rng.choice(["India", "Germany", "United States", "Japan"]), risk_score=rng.randint(1, 90)) for i in range(1, 501)]
    products = [Product(id=f"PROD-{i:03d}", name=f"TraceIQ Product {i:03d}", sku=f"TQ-{i:03d}", unit="units", unit_price_usd=round(rng.uniform(4, 70), 2)) for i in range(1, 21)]
    customers = [Customer(id=f"CUST-{i:05d}", name=f"Synthetic Customer {i:05d}", contact_email=f"quality{i}@example.invalid", location=f"Region {i % 40:02d}", tier="Healthcare" if i % 3 == 0 else "Retail") for i in range(1, 1001)]
    db.add_all([*suppliers, *products, *customers])
    db.flush()

    raw_lots: list[Lot] = []
    raw_ids: list[str] = []
    for i in range(1, 10001):
        lot_id = f"RAW-{i:04d}"
        raw_ids.append(lot_id)
        raw_lots.append(Lot(id=lot_id, lot_type="RAW", name=f"Synthetic raw material {i:05d}", supplier_id=suppliers[(i - 1) % len(suppliers)].id, quantity=round(rng.uniform(100, 2500), 2), unit="kg", status="APPROVED"))
    db.add_all(raw_lots)
    db.flush()

    orders = [ProductionOrder(id=f"PO-{i:05d}", product_id=products[(i - 1) % len(products)].id, facility=f"Facility {(i % 12) + 1:02d}", status="COMPLETED", completed_at=now) for i in range(1, 5001)]
    db.add_all(orders)
    db.flush()

    finished_lots: list[Lot] = []
    for i in range(1, 8001):
        lot_id = f"FG-{i:05d}"
        po_id = orders[(i - 1) % len(orders)].id
        # The seeded quantity anomaly has 10 units produced and will be over-shipped below.
        quantity = 10 if i == 3 else round(rng.uniform(300, 2200), 2)
        finished_lots.append(Lot(id=lot_id, lot_type="FG", name=f"Synthetic finished lot {i:05d}", product_id=products[(i - 1) % len(products)].id, production_order_id=po_id, quantity=quantity, unit="units", status="RELEASED"))
    db.add_all(finished_lots)
    db.flush()

    inputs: list[ProductionInput] = []
    for i, order in enumerate(orders, start=1):
        raw_id = "RAW-1042" if i == 1042 else raw_ids[(i * 7) % len(raw_ids)]
        inputs.append(ProductionInput(production_order_id=order.id, input_lot_id=raw_id, quantity=round(rng.uniform(15, 350), 2), unit="kg"))
        if i == 1:
            # Planted missing-input link.
            inputs.append(ProductionInput(production_order_id=order.id, input_lot_id="RAW-GHOST-0001", quantity=25, unit="kg"))
        elif i % 3 == 0:
            inputs.append(ProductionInput(production_order_id=order.id, input_lot_id=raw_ids[(i * 13) % len(raw_ids)], quantity=round(rng.uniform(5, 100), 2), unit="kg"))
    db.add_all(inputs)

    inventory: list[InventoryBalance] = []
    for i, lot in enumerate(finished_lots, start=1):
        qty = round(lot.quantity * rng.uniform(0.05, 0.25), 2)
        inventory.append(InventoryBalance(id=f"INV-{i:05d}", lot_id=lot.id, warehouse_id=f"WH-{(i % 40) + 1:02d}", warehouse_name=f"Warehouse {(i % 40) + 1:02d}", quantity=qty, unit="units", status="AVAILABLE", bay=f"{chr(65 + (i % 20))}-{(i % 80) + 1:02d}"))
    db.add_all(inventory)

    shipments: list[Shipment] = []
    for i in range(1, 20001):
        lot = finished_lots[(i * 17) % len(finished_lots)]
        customer_id: str | None = customers[(i * 31) % len(customers)].id
        quantity = round(rng.uniform(1, max(2, lot.quantity * 0.04)), 2)
        if i == 1:
            lot = finished_lots[2]
            customer_id = customers[0].id
            quantity = 50
        if i == 2:
            # Planted downstream customer link gap; ground truth lives only in tests.
            customer_id = None
        shipments.append(Shipment(id=f"SHP-{i:05d}", lot_id=lot.id, customer_id=customer_id, quantity=quantity, unit="units", status="DELIVERED" if i % 2 else "IN_TRANSIT", destination=f"Region {i % 40:02d}", carrier=f"Carrier {(i % 8) + 1}", tracking_number=f"TRK-{i:08d}", dispatched_at=now))
    db.add_all(shipments)
    db.commit()
    return {"suppliers": 500, "raw_lots": 10000, "production_orders": 5000, "finished_lots": 8000, "shipments": 20000}


def _quantity_totals(db: Session, lot_ids: list[str]) -> tuple[dict[str, float], dict[str, float]]:
    if not lot_ids:
        return {}, {}
    inventory = db.execute(select(InventoryBalance.lot_id, func.sum(InventoryBalance.quantity)).where(InventoryBalance.lot_id.in_(lot_ids)).group_by(InventoryBalance.lot_id)).all()
    shipped = db.execute(select(Shipment.lot_id, func.sum(Shipment.quantity)).where(Shipment.lot_id.in_(lot_ids), Shipment.status != "CANCELLED").group_by(Shipment.lot_id)).all()
    return ({key: float(value or 0) for key, value in inventory}, {key: float(value or 0) for key, value in shipped})


def _quantity_finding(db: Session, lot: Lot, inventory_by_lot: dict[str, float] | None = None, shipped_by_lot: dict[str, float] | None = None) -> dict[str, Any]:
    if inventory_by_lot is None or shipped_by_lot is None:
        inventory_by_lot, shipped_by_lot = _quantity_totals(db, [lot.id])
    inventory_quantity = inventory_by_lot.get(lot.id, 0.0)
    shipped_quantity = shipped_by_lot.get(lot.id, 0.0)
    accounted = inventory_quantity + shipped_quantity
    difference = lot.quantity - accounted
    status = "OVER_ALLOCATED" if difference < -0.001 else "RECONCILED" if abs(difference) <= 0.001 else "UNDER_RECONCILED"
    return {
        "lot_id": lot.id,
        "produced_quantity": float(lot.quantity),
        "inventory_quantity": inventory_quantity,
        "shipped_quantity": shipped_quantity,
        "accounted_quantity": accounted,
        "difference": difference,
        "status": status,
        "unit": lot.unit,
    }


def traceability(db: Session, target_id: str) -> dict[str, Any]:
    target_id = target_id.strip().upper()
    lots = {lot.id.upper(): lot for lot in db.scalars(select(Lot)).all()}
    suppliers = {row.id: row for row in db.scalars(select(Supplier)).all()}
    orders = {row.id: row for row in db.scalars(select(ProductionOrder)).all()}
    inputs = db.scalars(select(ProductionInput)).all()
    inventory = db.scalars(select(InventoryBalance)).all()
    shipments = db.scalars(select(Shipment)).all()
    customers = {row.id: row for row in db.scalars(select(Customer)).all()}
    products = {row.id: row for row in db.scalars(select(Product)).all()}
    if target_id not in lots:
        # Anomaly findings can point to a shipment, production order, inventory
        # record, supplier, or customer. Resolve those IDs to a related lot so
        # the inspection action still opens an evidence graph.
        related_lot_id: str | None = None
        related_shipment = next((row for row in shipments if row.id.upper() == target_id), None)
        if related_shipment:
            related_lot_id = related_shipment.lot_id.upper()
        if related_lot_id is None:
            related_inventory = next((row for row in inventory if row.id.upper() == target_id), None)
            if related_inventory:
                related_lot_id = related_inventory.lot_id.upper()
        if related_lot_id is None and target_id in orders:
            outputs = [lot.id.upper() for lot in lots.values() if lot.production_order_id == orders[target_id].id]
            if outputs:
                related_lot_id = outputs[0]
            else:
                related_input = next((row for row in inputs if row.production_order_id == orders[target_id].id), None)
                if related_input:
                    related_lot_id = related_input.input_lot_id.upper()
        if related_lot_id is None:
            related_supplier = suppliers.get(target_id)
            if related_supplier:
                related_lot = next((lot for lot in lots.values() if lot.supplier_id == related_supplier.id), None)
                if related_lot:
                    related_lot_id = related_lot.id.upper()
        if related_lot_id is None:
            related_customer = customers.get(target_id)
            if related_customer:
                related_shipment = next((row for row in shipments if row.customer_id == related_customer.id), None)
                if related_shipment:
                    related_lot_id = related_shipment.lot_id.upper()
        if related_lot_id is None or related_lot_id not in lots:
            raise LookupError(f"Record {target_id} was not found or has no linked lot.")
        target_id = related_lot_id

    inputs_by_lot: dict[str, list[ProductionInput]] = {}
    inputs_by_order: dict[str, list[ProductionInput]] = {}
    outputs_by_order: dict[str, list[Lot]] = {}
    inventory_by_lot: dict[str, list[InventoryBalance]] = {}
    shipments_by_lot: dict[str, list[Shipment]] = {}
    for row in inputs:
        inputs_by_lot.setdefault(row.input_lot_id.upper(), []).append(row)
        inputs_by_order.setdefault(row.production_order_id, []).append(row)
    for lot in lots.values():
        if lot.production_order_id:
            outputs_by_order.setdefault(lot.production_order_id, []).append(lot)
    for row in inventory:
        inventory_by_lot.setdefault(row.lot_id.upper(), []).append(row)
    for row in shipments:
        shipments_by_lot.setdefault(row.lot_id.upper(), []).append(row)

    node_map: dict[str, dict[str, Any]] = {}
    edge_map: dict[str, dict[str, Any]] = {}
    supplier_ids: set[str] = set()
    raw_ids: set[str] = set()
    po_ids: set[str] = set()
    finished_ids: set[str] = set()
    inventory_ids: set[str] = set()
    shipment_ids: set[str] = set()
    customer_ids: set[str] = set()
    missing: set[str] = set()

    def node(key: str, kind: str, label: str, status: str = "", quantity: float | None = None, unit: str | None = None) -> None:
        node_map[key] = {"id": key, "type": kind, "label": label, "status": status, "quantity": quantity, "unit": unit}

    def edge(source: str, target: str, label: str = "") -> None:
        edge_id = f"{source}>{target}:{label}"
        edge_map[edge_id] = {"id": edge_id, "source": source, "target": target, "label": label, "status": "OK"}

    def add_lot(lot: Lot) -> None:
        key = lot.id.upper()
        kind = "raw_lot" if lot.lot_type == "RAW" else "finished_lot"
        product_name = products.get(lot.product_id).name if lot.product_id in products else lot.name
        node(key, kind, product_name or lot.name, lot.status, float(lot.quantity), lot.unit)
        if lot.lot_type == "RAW":
            raw_ids.add(lot.id)
        else:
            finished_ids.add(lot.id)

    def add_supplier(supplier_id: str, lot_id: str) -> None:
        supplier = suppliers.get(supplier_id)
        if supplier is None:
            missing.add(f"Supplier {supplier_id} linked from lot {lot_id} is missing.")
            key = f"MISSING:{supplier_id}"
            node(key, "missing", f"Missing supplier {supplier_id}", "INCOMPLETE")
            edge(key, lot_id, "supplied by")
            return
        supplier_ids.add(supplier.id)
        node(supplier.id, "supplier", supplier.name, supplier.status)
        edge(supplier.id, lot_id, "supplied")

    def add_order(order_id: str, output_id: str | None = None) -> None:
        order = orders.get(order_id)
        if order is None:
            missing.add(f"Production order {order_id} is missing.")
            node(f"MISSING:{order_id}", "missing", f"Missing production order {order_id}", "INCOMPLETE")
            return
        po_ids.add(order.id)
        node(order.id, "production_order", order.id, order.status)
        if output_id:
            edge(order.id, output_id, "produced")

    # Traverse upstream from finished goods to source lots and suppliers.
    upstream_queue = [target_id]
    upstream_seen: set[str] = set()
    while upstream_queue:
        current_id = upstream_queue.pop()
        if current_id in upstream_seen:
            continue
        upstream_seen.add(current_id)
        lot = lots.get(current_id)
        if lot is None:
            missing.add(f"Lot {current_id} is referenced but missing.")
            node(f"MISSING:{current_id}", "missing", f"Missing lot {current_id}", "INCOMPLETE")
            continue
        add_lot(lot)
        if lot.lot_type == "RAW":
            if lot.supplier_id:
                add_supplier(lot.supplier_id, lot.id)
        elif lot.production_order_id:
            add_order(lot.production_order_id, lot.id)
            order_inputs = inputs_by_order.get(lot.production_order_id, [])
            if not order_inputs:
                missing.add(f"Production order {lot.production_order_id} has no recorded input lots.")
            for input_row in order_inputs:
                input_id = input_row.input_lot_id.upper()
                if input_id not in lots:
                    missing.add(f"Input lot {input_row.input_lot_id} referenced by {lot.production_order_id} is missing.")
                    node(f"MISSING:{input_id}", "missing", f"Missing input lot {input_row.input_lot_id}", "INCOMPLETE")
                    edge(input_id, lot.production_order_id, f"{input_row.quantity:g} {input_row.unit}")
                else:
                    edge(input_id, lot.production_order_id, f"{input_row.quantity:g} {input_row.unit}")
                    upstream_queue.append(input_id)

    # Traverse downstream from raw material to every output lot, stock location, shipment, and customer.
    downstream_queue = [target_id]
    downstream_seen: set[str] = set()
    while downstream_queue:
        current_id = downstream_queue.pop()
        if current_id in downstream_seen:
            continue
        downstream_seen.add(current_id)
        lot = lots.get(current_id)
        if lot is None:
            continue
        add_lot(lot)
        for inventory_row in inventory_by_lot.get(current_id, []):
            inventory_ids.add(inventory_row.id)
            node(inventory_row.id, "inventory", f"{inventory_row.warehouse_name} · {inventory_row.bay}", inventory_row.status, float(inventory_row.quantity), inventory_row.unit)
            edge(lot.id, inventory_row.id, "stock")
        for shipment in shipments_by_lot.get(current_id, []):
            shipment_ids.add(shipment.id)
            node(shipment.id, "shipment", f"Shipment {shipment.id} · {shipment.destination}", shipment.status, float(shipment.quantity), shipment.unit)
            edge(lot.id, shipment.id, "shipped")
            if shipment.customer_id and shipment.customer_id in customers:
                customer = customers[shipment.customer_id]
                customer_ids.add(customer.id)
                node(customer.id, "customer", customer.name, "ACTIVE")
                edge(shipment.id, customer.id, "delivered to")
            else:
                missing.add(f"Customer link for shipment {shipment.id} is missing.")
                node(f"MISSING:CUSTOMER:{shipment.id}", "missing", f"Unknown recipient for {shipment.id}", "INCOMPLETE")
                edge(shipment.id, f"MISSING:CUSTOMER:{shipment.id}", "recipient missing")

        for input_row in inputs_by_lot.get(current_id, []):
            order = orders.get(input_row.production_order_id)
            if order is None:
                missing.add(f"Production order {input_row.production_order_id} consuming {current_id} is missing.")
                continue
            add_order(order.id)
            for output in outputs_by_order.get(order.id, []):
                if output.lot_type == "FG":
                    node(order.id, "production_order", order.id, order.status)
                    add_lot(output)
                    edge(current_id, order.id, f"input {input_row.quantity:g} {input_row.unit}")
                    edge(order.id, output.id, "produced")
                    downstream_queue.append(output.id.upper())

    involved_finished = [lots[lot_id.upper()] for lot_id in sorted(finished_ids) if lot_id.upper() in lots]
    inventory_totals, shipment_totals = _quantity_totals(db, [lot.id for lot in involved_finished])
    quantity_findings = [_quantity_finding(db, lot, inventory_totals, shipment_totals) for lot in involved_finished]
    return {
        "target_id": target_id,
        "nodes": list(node_map.values()),
        "edges": list(edge_map.values()),
        "suppliers": sorted(supplier_ids),
        "raw_lots": sorted(raw_ids),
        "production_orders": sorted(po_ids),
        "finished_lots": sorted(finished_ids),
        "inventory_ids": sorted(inventory_ids),
        "shipment_ids": sorted(shipment_ids),
        "customer_ids": sorted(customer_ids),
        "missing_links": sorted(missing),
        "quantity_findings": quantity_findings,
    }


def recall_impact(db: Session, target_lot_id: str) -> dict[str, Any]:
    trace = traceability(db, target_lot_id)
    finished_ids = trace["finished_lots"]
    finished_lots = db.scalars(select(Lot).where(Lot.id.in_(finished_ids))).all() if finished_ids else []
    affected_units = sum(float(lot.quantity) for lot in finished_lots)
    unit_prices = {row.id: row.unit_price_usd for row in db.scalars(select(Product)).all()}
    financial_exposure = sum(float(lot.quantity) * unit_prices.get(lot.product_id or "", 0) for lot in finished_lots)
    finished_ids = trace["finished_lots"]
    on_hand_units = float(db.scalar(select(func.coalesce(func.sum(InventoryBalance.quantity), 0)).where(InventoryBalance.lot_id.in_(finished_ids))) or 0) if finished_ids else 0
    in_transit_units = float(db.scalar(select(func.coalesce(func.sum(Shipment.quantity), 0)).where(Shipment.lot_id.in_(finished_ids), Shipment.status.in_(["IN_TRANSIT", "RECALL_HOLD"]))) or 0) if finished_ids else 0
    delivered_units = float(db.scalar(select(func.coalesce(func.sum(Shipment.quantity), 0)).where(Shipment.lot_id.in_(finished_ids), Shipment.status == "DELIVERED")) or 0) if finished_ids else 0
    warnings = list(trace["missing_links"])
    warnings.extend(
        f"{finding['lot_id']} is {finding['status'].lower().replace('_', ' ')} by {abs(finding['difference']):g} {finding['unit']}."
        for finding in trace["quantity_findings"]
        if finding["status"] != "RECONCILED"
    )
    return {
        "target_lot_id": trace["target_id"],
        "affected_units": affected_units,
        "on_hand_units": on_hand_units,
        "in_transit_units": in_transit_units,
        "delivered_units": delivered_units,
        "raw_lots": trace["raw_lots"],
        "production_orders": trace["production_orders"],
        "finished_lots": trace["finished_lots"],
        "inventory_ids": trace["inventory_ids"],
        "shipment_ids": trace["shipment_ids"],
        "customer_ids": trace["customer_ids"],
        "missing_links": trace["missing_links"],
        "quantity_findings": trace["quantity_findings"],
        "financial_exposure_usd": financial_exposure,
        "warnings": warnings,
    }


def detect_anomalies(db: Session) -> list[dict[str, Any]]:
    findings: list[dict[str, Any]] = []
    lots = {row.id: row for row in db.scalars(select(Lot)).all()}
    orders = {row.id: row for row in db.scalars(select(ProductionOrder)).all()}
    inputs = db.scalars(select(ProductionInput)).all()
    for row in inputs:
        if row.input_lot_id not in lots:
            findings.append({"id": f"MISSING_INPUT:{row.production_order_id}:{row.input_lot_id}", "type": "MISSING_INPUT_LINK", "severity": "CRITICAL", "entity_id": row.production_order_id, "title": "Production input lot is missing", "description": f"{row.production_order_id} references {row.input_lot_id}, which is absent from the lot ledger."})
        if row.production_order_id not in orders:
            findings.append({"id": f"MISSING_PO:{row.production_order_id}", "type": "MISSING_PRODUCTION_ORDER", "severity": "CRITICAL", "entity_id": row.production_order_id, "title": "Production order is missing", "description": f"Input lot {row.input_lot_id} references a missing production order."})
    finished_lots = [lot for lot in lots.values() if lot.lot_type == "FG"]
    inventory_totals, shipment_totals = _quantity_totals(db, [lot.id for lot in finished_lots])
    for lot in finished_lots:
        finding = _quantity_finding(db, lot, inventory_totals, shipment_totals)
        if finding["status"] == "OVER_ALLOCATED":
            findings.append({"id": f"OVER_ALLOCATED:{lot.id}", "type": "QUANTITY_MISMATCH", "severity": "CRITICAL", "entity_id": lot.id, "title": "Recorded quantity exceeds production", "description": f"{finding['accounted_quantity']:g} {lot.unit} is recorded against {finding['produced_quantity']:g} produced."})
    valid_customer_ids = set(db.scalars(select(Customer.id)).all())
    for shipment in db.scalars(select(Shipment)).all():
        if not shipment.customer_id or shipment.customer_id not in valid_customer_ids:
            findings.append({"id": f"MISSING_CUSTOMER:{shipment.id}", "type": "MISSING_CUSTOMER_LINK", "severity": "CRITICAL", "entity_id": shipment.id, "title": "Shipment recipient is missing", "description": f"Shipment {shipment.id} has no valid customer link; its downstream impact is incomplete."})
    active_recalls = db.scalars(select(RecallCase).where(RecallCase.status == "ACTIVE")).all()
    for recall in active_recalls:
        scoped_lots = set(recall.impact_snapshot.get("finished_lots", []))
        for stock in db.scalars(select(InventoryBalance).where(InventoryBalance.lot_id.in_(scoped_lots))).all() if scoped_lots else []:
            if stock.status == "AVAILABLE":
                findings.append({"id": f"RECALLED_STOCK_AVAILABLE:{recall.id}:{stock.id}", "type": "RECALL_CONTAINMENT_FAILURE", "severity": "CRITICAL", "entity_id": stock.id, "title": "Recalled stock remains available", "description": f"{stock.quantity:g} {stock.unit} for affected lot {stock.lot_id} is still marked available."})
    return findings


def run_quality_check(db: Session, entity_type: str, entity_id: str, checked_by: str, evidence_reference: str | None = None) -> QualityCheck:
    findings: list[dict[str, Any]] = []
    evidence: list[dict[str, Any]] = []
    result = "PASS"
    if entity_type == "LOT":
        lot = db.get(Lot, entity_id)
        if lot is None:
            result = "INCOMPLETE"
            findings.append({"code": "ENTITY_MISSING", "message": f"Lot {entity_id} was not found in the authorized records."})
        else:
            evidence.append({"source": lot.id, "quantity": lot.quantity, "unit": lot.unit, "status": lot.status})
            if lot.quantity <= 0:
                result = "FAIL"
                findings.append({"code": "NON_POSITIVE_QUANTITY", "message": "Lot quantity must be greater than zero."})
            if lot.lot_type == "RAW":
                source = db.get(Supplier, lot.supplier_id) if lot.supplier_id else None
                if source is None:
                    result = "INCOMPLETE"
                    findings.append({"code": "SUPPLIER_EVIDENCE_MISSING", "message": "Raw-material supplier evidence is missing."})
                elif source.status != "ACTIVE":
                    result = "FAIL" if source.status == "SUSPENDED" else "PENDING"
                    findings.append({"code": "SUPPLIER_QUALIFICATION_PENDING", "message": f"Supplier {source.id} is {source.status.lower().replace('_', ' ')}; lot release is waiting for qualification."})
            if lot.status in {"QUARANTINED", "RECALLED", "FLAGGED"} and result in {"PASS", "PENDING"}:
                result = "FAIL"
                findings.append({"code": "LOT_NOT_RELEASED", "message": f"Lot status {lot.status} is not eligible for release."})
            if lot.lot_type == "FG":
                if not lot.production_order_id or db.get(ProductionOrder, lot.production_order_id) is None:
                    result = "INCOMPLETE"
                    findings.append({"code": "PRODUCTION_GENEALOGY_MISSING", "message": "Finished lot has no valid production-order link."})
                elif not db.scalars(select(ProductionInput).where(ProductionInput.production_order_id == lot.production_order_id)).first():
                    result = "INCOMPLETE"
                    findings.append({"code": "INPUT_EVIDENCE_MISSING", "message": "Production order has no recorded input-lot evidence."})
                quantity = _quantity_finding(db, lot)
                evidence.append({"source": "quantity-reconciliation", **quantity})
                if quantity["status"] == "OVER_ALLOCATED":
                    result = "FAIL"
                    findings.append({"code": "QUANTITY_OVERAGE", "message": "Recorded inventory and shipments exceed produced quantity."})
    elif entity_type == "SUPPLIER":
        supplier = db.get(Supplier, entity_id)
        if supplier is None:
            result = "INCOMPLETE"
            findings.append({"code": "ENTITY_MISSING", "message": f"Supplier {entity_id} was not found."})
        else:
            evidence.append({"source": supplier.id, "status": supplier.status, "risk_score": supplier.risk_score})
            if supplier.status != "ACTIVE":
                if supplier.status == "UNDER_REVIEW" and evidence_reference:
                    evidence.append({"source": evidence_reference, "evidence_type": "supplier-qualification"})
                else:
                    result = "FAIL" if supplier.status == "SUSPENDED" else "PENDING"
                    findings.append({"code": "SUPPLIER_NOT_QUALIFIED", "message": f"Supplier status is {supplier.status}; qualification is not complete."})
            if supplier.risk_score >= 80:
                result = "FAIL"
                findings.append({"code": "SUPPLIER_RISK_HIGH", "message": "Supplier risk score exceeds the configured threshold."})
    if evidence_reference and entity_type == "LOT":
        evidence.append({"source": evidence_reference, "evidence_type": "lot-inspection"})
    check = QualityCheck(id=new_id("QC"), entity_type=entity_type, entity_id=entity_id, rule_version="quality-v1", result=result, findings=findings, evidence=evidence, checked_by=checked_by)
    db.add(check)
    if entity_type == "LOT" and (lot := db.get(Lot, entity_id)) is not None:
        if result == "PASS":
            lot.status = "APPROVED" if lot.lot_type == "RAW" else "RELEASED"
        elif result in {"FAIL", "INCOMPLETE"}:
            lot.status = "QUARANTINED"
    elif entity_type == "SUPPLIER" and (supplier := db.get(Supplier, entity_id)) is not None:
        supplier.status = "ACTIVE" if result == "PASS" else "SUSPENDED" if result == "FAIL" else "UNDER_REVIEW"
    if result in {"FAIL", "INCOMPLETE"}:
        db.add(CorrectiveAction(id=new_id("CAPA"), check_id=check.id, entity_type=entity_type, entity_id=entity_id, description="Resolve the recorded quality finding and run a new check.", status="OPEN"))
    record_audit(db, "QUALITY_CHECK", check.id, f"QUALITY_{result}", checked_by, f"Quality check for {entity_type.lower()} {entity_id} returned {result}.", {"entity_id": entity_id, "rule_version": check.rule_version, "findings": findings})
    return check


def create_supplier(db: Session, payload: SupplierCreate, actor: str) -> Supplier:
    if db.get(Supplier, payload.id.upper()):
        raise ValueError(f"Supplier {payload.id} already exists.")
    supplier = Supplier(id=payload.id.upper(), name=payload.name, country=payload.country, status="UNDER_REVIEW", risk_score=0)
    db.add(supplier)
    db.flush()
    record_audit(db, "SUPPLIER", supplier.id, "SUPPLIER_REGISTERED", actor, f"Supplier {supplier.name} registered and awaiting qualification.", {"country": supplier.country})
    return supplier


def create_production_order(db: Session, payload: ProductionOrderCreate, actor: str) -> ProductionOrder:
    if db.get(ProductionOrder, payload.id.upper()):
        raise ValueError(f"Production order {payload.id} already exists.")
    if db.get(Product, payload.product_id) is None:
        raise ValueError(f"Product {payload.product_id} was not found.")
    for input_lot in payload.input_lots:
        lot = db.get(Lot, input_lot.lot_id.upper())
        if lot is None:
            raise ValueError(f"Input lot {input_lot.lot_id} is missing; production cannot proceed.")
        if lot.lot_type != "RAW" or lot.status not in {"APPROVED", "RELEASED"}:
            raise ValueError(f"Input lot {lot.id} is not an approved raw material.")
        if input_lot.unit != lot.unit:
            raise ValueError(f"Input unit {input_lot.unit} does not match {lot.unit} for lot {lot.id}.")
        already_used = float(db.scalar(select(func.coalesce(func.sum(ProductionInput.quantity), 0)).where(ProductionInput.input_lot_id == lot.id)) or 0)
        requested_for_lot = sum(item.quantity for item in payload.input_lots if item.lot_id.upper() == lot.id)
        if already_used + requested_for_lot > lot.quantity + 0.001:
            raise ValueError(f"Production would over-consume lot {lot.id}: {already_used + requested_for_lot:g} {lot.unit} requested of {lot.quantity:g} received.")
    product = db.get(Product, payload.product_id)
    order = ProductionOrder(id=payload.id.upper(), product_id=payload.product_id, facility=payload.facility, status="COMPLETED", completed_at=utc_now())
    db.add(order)
    db.flush()
    for input_lot in payload.input_lots:
        db.add(ProductionInput(production_order_id=order.id, input_lot_id=input_lot.lot_id.upper(), quantity=input_lot.quantity, unit=input_lot.unit))
    for output in payload.output_lots:
        lot_id = output.lot_id.upper()
        if db.get(Lot, lot_id):
            raise ValueError(f"Output lot {lot_id} already exists.")
        db.add(Lot(id=lot_id, lot_type="FG", name=output.name, product_id=product.id, production_order_id=order.id, quantity=output.quantity, unit=output.unit, status="PENDING_QUALITY"))
    record_audit(db, "PRODUCTION_ORDER", order.id, "PRODUCTION_ORDER_RECORDED", actor, f"Production order {order.id} recorded with {len(payload.input_lots)} input link(s) and {len(payload.output_lots)} output lot(s).", {"input_lots": [row.model_dump() for row in payload.input_lots], "output_lots": [row.model_dump() for row in payload.output_lots]})
    return order


def create_inventory_receipt(db: Session, payload: InventoryReceiptCreate, actor: str) -> InventoryBalance:
    if db.get(InventoryBalance, payload.id.upper()):
        raise ValueError(f"Inventory record {payload.id} already exists.")
    lot = db.get(Lot, payload.lot_id.upper())
    if lot is None:
        raise ValueError(f"Lot {payload.lot_id} was not found.")
    eligible = {"APPROVED", "RELEASED"}
    if lot.status not in eligible:
        raise ValueError(f"Lot {lot.id} is {lot.status}; quality approval is required before it can be received into available inventory.")
    if payload.unit != lot.unit:
        raise ValueError(f"Receipt unit {payload.unit} does not match lot unit {lot.unit}.")
    row = InventoryBalance(id=payload.id.upper(), lot_id=lot.id, warehouse_id=payload.warehouse_id, warehouse_name=payload.warehouse_name, quantity=payload.quantity, unit=payload.unit, status="AVAILABLE", bay=payload.bay)
    db.add(row)
    record_audit(db, "INVENTORY", row.id, "INVENTORY_RECEIVED", actor, f"Received {payload.quantity:g} {payload.unit} of {lot.id} into {payload.warehouse_name}.", payload.model_dump())
    return row


def create_shipment(db: Session, payload: ShipmentCreate, actor: str) -> Shipment:
    if db.get(Shipment, payload.id.upper()):
        raise ValueError(f"Shipment {payload.id} already exists.")
    lot = db.get(Lot, payload.lot_id.upper())
    if lot is None or lot.lot_type != "FG":
        raise ValueError("Shipment requires an existing finished-goods lot.")
    if lot.status != "RELEASED":
        raise ValueError(f"Lot {lot.id} is {lot.status}; a released quality state is required before shipment.")
    if db.get(Customer, payload.customer_id) is None:
        raise ValueError(f"Customer {payload.customer_id} was not found.")
    if payload.unit != lot.unit:
        raise ValueError(f"Shipment unit {payload.unit} does not match lot unit {lot.unit}.")
    active_recalls = db.scalars(select(RecallCase).where(RecallCase.status == "ACTIVE")).all()
    if any(lot.id in case.impact_snapshot.get("finished_lots", []) for case in active_recalls):
        raise ValueError(f"Lot {lot.id} is in an active recall and cannot be shipped.")
    balances = db.scalars(select(InventoryBalance).where(InventoryBalance.lot_id == lot.id, InventoryBalance.status == "AVAILABLE").order_by(InventoryBalance.id)).all()
    available = sum(float(row.quantity) for row in balances)
    if available < payload.quantity - 0.001:
        raise ValueError(f"Only {available:g} {lot.unit} of {lot.id} is available; shipment requests {payload.quantity:g}.")
    remaining = payload.quantity
    for balance in balances:
        used = min(float(balance.quantity), remaining)
        balance.quantity = float(balance.quantity) - used
        remaining -= used
        if balance.quantity <= 0.001:
            balance.status = "EXHAUSTED"
        if remaining <= 0.001:
            break
    shipment = Shipment(id=payload.id.upper(), lot_id=lot.id, customer_id=payload.customer_id, quantity=payload.quantity, unit=payload.unit, status="IN_TRANSIT", destination=payload.destination, carrier=payload.carrier, tracking_number=payload.tracking_number)
    db.add(shipment)
    record_audit(db, "SHIPMENT", shipment.id, "SHIPMENT_DISPATCHED", actor, f"Dispatched {payload.quantity:g} {payload.unit} of {lot.id} to {payload.destination}.", payload.model_dump())
    return shipment


def update_lot_record(db: Session, lot: Lot, quantity: float | None, status: str | None, actor: str) -> Lot:
    before = {"quantity": lot.quantity, "status": lot.status}
    if quantity is not None:
        lot.quantity = quantity
    if status is not None:
        allowed = {"PENDING_QUALITY", "QUARANTINED", "FLAGGED"}
        if status.upper() not in allowed:
            raise ValueError("Lot status changes may only move to a review or containment state; use a quality check to approve release.")
        lot.status = status.upper()
    record_audit(db, "LOT", lot.id, "LOT_RECORD_CORRECTED", actor, f"Lot {lot.id} data was corrected.", {"before": before, "after": {"quantity": lot.quantity, "status": lot.status}})
    return lot


def update_corrective_action(db: Session, action: CorrectiveAction, status: str, actor: str, resolution: str | None) -> CorrectiveAction:
    if status == "CLOSED":
        latest_check = db.scalars(select(QualityCheck).where(QualityCheck.entity_type == action.entity_type, QualityCheck.entity_id == action.entity_id).order_by(QualityCheck.created_at.desc())).first()
        if latest_check is None or latest_check.result != "PASS":
            raise ValueError("Run and pass a new quality check before closing this corrective action.")
        if not resolution:
            raise ValueError("A resolution note is required to close a corrective action.")
        action.closed_at = utc_now()
        action.description = f"{action.description} Resolution: {resolution}"
    else:
        action.closed_at = None
    action.status = status
    record_audit(db, "CORRECTIVE_ACTION", action.id, f"CORRECTIVE_ACTION_{status}", actor, action.description, {"entity_id": action.entity_id, "resolution": resolution})
    return action


def recall_actions(db: Session, recall_id: str) -> list[RecallAction]:
    return db.scalars(select(RecallAction).where(RecallAction.recall_id == recall_id).order_by(RecallAction.created_at)).all()


def closure_blockers(db: Session, recall: RecallCase) -> list[str]:
    blockers: list[str] = []
    pending = [action for action in recall_actions(db, recall.id) if action.status != "COMPLETED"]
    if pending:
        blockers.append(f"{len(pending)} recall action(s) are still pending.")
    reconciliation = recall.reconciliation or {}
    if not reconciliation:
        blockers.append("Quantity reconciliation has not been recorded.")
    else:
        accounted = float(reconciliation.get("accounted_units", 0))
        if abs(accounted - float(recall.affected_units)) > 0.001:
            blockers.append(f"Reconciled quantity is {accounted:g}; {recall.affected_units:g} affected units must be accounted for.")
    current_impact = recall_impact(db, recall.target_lot_id)
    if current_impact["missing_links"]:
        blockers.append(f"{len(current_impact['missing_links'])} traceability link(s) remain incomplete.")
    unreconciled = [row for row in current_impact["quantity_findings"] if row["status"] != "RECONCILED"]
    if unreconciled:
        blockers.append(f"{len(unreconciled)} finished lot(s) still have unexplained quantity variance.")
    available_stock = db.scalar(
        select(func.count()).select_from(InventoryBalance).where(
            InventoryBalance.lot_id.in_(current_impact["finished_lots"]), InventoryBalance.status == "AVAILABLE"
        )
    ) if current_impact["finished_lots"] else 0
    if available_stock:
        blockers.append(f"{available_stock} affected inventory balance(s) remain available for sale.")
    held_shipment_ids = set(current_impact["shipment_ids"])
    in_transit = db.scalar(
        select(func.count()).select_from(Shipment).where(
            Shipment.id.in_(held_shipment_ids), Shipment.status == "IN_TRANSIT"
        )
    ) if held_shipment_ids else 0
    if in_transit:
        blockers.append(f"{in_transit} affected shipment(s) remain in transit without a hold.")
    return blockers


def activate_recall(db: Session, target_lot_id: str, reason: str, authorized_by: str, approval_note: str) -> RecallCase:
    impact = recall_impact(db, target_lot_id)
    affected_finished = set(impact["finished_lots"])
    for existing in db.scalars(select(RecallCase).where(RecallCase.status == "ACTIVE")).all():
        existing_scope = set(existing.impact_snapshot.get("finished_lots", []))
        if existing.target_lot_id == impact["target_lot_id"] or affected_finished.intersection(existing_scope):
            raise ValueError(f"Active recall {existing.id} already covers part of this affected finished-lot scope.")
    recall = RecallCase(
        id=new_id("RCL"), target_lot_id=impact["target_lot_id"], reason=reason,
        status="ACTIVE", authorized_by=authorized_by, approval_note=approval_note,
        affected_units=impact["affected_units"], impact_snapshot=impact,
    )
    db.add(recall)
    db.flush()
    finished_ids = impact["finished_lots"]
    if finished_ids:
        stocks = db.scalars(select(InventoryBalance).where(InventoryBalance.lot_id.in_(finished_ids))).all()
        for stock in stocks:
            if stock.status == "AVAILABLE":
                stock.status = "QUARANTINED"
                db.add(RecallAction(id=new_id("ACT"), recall_id=recall.id, action_type="QUARANTINE_INVENTORY", entity_id=stock.id, description=f"Quarantined {stock.quantity:g} {stock.unit} at {stock.warehouse_name}.", status="COMPLETED", quantity=stock.quantity, completed_by=authorized_by, completed_at=utc_now()))
        shipments = db.scalars(select(Shipment).where(Shipment.id.in_(impact["shipment_ids"]))).all() if impact["shipment_ids"] else []
        for shipment in shipments:
            if shipment.status == "IN_TRANSIT":
                shipment.status = "RECALL_HOLD"
                db.add(RecallAction(id=new_id("ACT"), recall_id=recall.id, action_type="HOLD_SHIPMENT", entity_id=shipment.id, description=f"Shipment {shipment.id} placed on recall hold.", status="COMPLETED", quantity=shipment.quantity, completed_by=authorized_by, completed_at=utc_now()))
        known_customers = {customer_id for customer_id in impact["customer_ids"]}
        for customer_id in sorted(known_customers):
            db.add(RecallAction(id=new_id("ACT"), recall_id=recall.id, action_type="CUSTOMER_NOTIFICATION", entity_id=customer_id, description=f"Record recall notification and acknowledgement for {customer_id}.", status="PENDING"))
    record_audit(db, "RECALL", recall.id, "RECALL_APPROVED_AND_ACTIVATED", authorized_by, f"Recall for {recall.target_lot_id} activated after human approval.", {"reason": reason, "approval_note": approval_note, "affected_units": recall.affected_units, "finished_lots": impact["finished_lots"], "customers": impact["customer_ids"]})
    return recall


def add_recall_action(db: Session, recall: RecallCase, action_type: str, entity_id: str | None, description: str, quantity: float, actor: str) -> RecallAction:
    action = RecallAction(id=new_id("ACT"), recall_id=recall.id, action_type=action_type, entity_id=entity_id, description=description, quantity=quantity, status="PENDING")
    db.add(action)
    record_audit(db, "RECALL", recall.id, "RECALL_ACTION_ADDED", actor, description, {"action_id": action.id, "action_type": action_type, "entity_id": entity_id, "quantity": quantity})
    return action


def update_recall_action(db: Session, action: RecallAction, status: str, actor: str, description: str | None = None) -> RecallAction:
    action.status = status
    action.completed_by = actor if status == "COMPLETED" else None
    action.completed_at = utc_now() if status == "COMPLETED" else None
    if description:
        action.description = description
    record_audit(db, "RECALL_ACTION", action.id, f"RECALL_ACTION_{status}", actor, action.description, {"recall_id": action.recall_id, "status": status})
    return action


def record_reconciliation(db: Session, recall: RecallCase, categories: dict[str, float], actor: str) -> dict[str, Any]:
    accounted = sum(float(value) for key, value in categories.items() if key != "recorded_by")
    reconciliation = {**categories, "accounted_units": accounted, "expected_units": float(recall.affected_units), "matches_scope": abs(accounted - float(recall.affected_units)) <= 0.001, "recorded_at": utc_now().isoformat()}
    recall.reconciliation = reconciliation
    record_audit(db, "RECALL", recall.id, "RECALL_QUANTITIES_RECONCILED", actor, "Recall quantities reconciled against the affected-unit scope.", reconciliation)
    return reconciliation

