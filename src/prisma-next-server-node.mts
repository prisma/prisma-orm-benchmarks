import { serve } from '@hono/node-server';
import postgres from '@prisma-next/postgres/runtime';
import { createCodecRegistry } from '@prisma-next/sql-relational-core/ast';
import { buildOperation, toExpr } from '@prisma-next/sql-relational-core/expression';
import type { SqlRuntimeExtensionDescriptor } from '@prisma-next/sql-runtime';
import cluster from 'cluster';
import 'dotenv/config';
import { Hono } from 'hono';
import os from 'os';
import pg from 'pg';
import cpuUsageRaw from './cpu-usage';
import { contract } from './prisma-next-contract.mjs';

// CJS-into-ESM interop: tsx wraps a CJS default export as `{ default: x }`.
const cpuUsage = (cpuUsageRaw as { default?: typeof cpuUsageRaw }).default ?? cpuUsageRaw;

const numCPUs = os.cpus().length;

const ftsExtension: SqlRuntimeExtensionDescriptor<'postgres'> = {
  kind: 'extension',
  id: 'bench-fts',
  version: '0.0.1',
  familyId: 'sql',
  targetId: 'postgres',
  codecs: () => createCodecRegistry(),
  parameterizedCodecs: () => [],
  queryOperations: () => [
    {
      method: 'fullTextSearch',
      self: { codecId: 'pg/text@1' },
      impl: (self: unknown, query: unknown) =>
        buildOperation({
          method: 'fullTextSearch',
          args: [toExpr(self, 'pg/text@1'), toExpr(query, 'pg/text@1')],
          returns: { codecId: 'pg/bool@1', nullable: false },
          lowering: {
            targetFamily: 'sql',
            strategy: 'function',
            template: "to_tsvector('english', {{self}}) @@ to_tsquery('english', {{arg0}})",
          },
        }),
    },
    {
      method: 'mul',
      self: { codecId: 'pg/int4@1' },
      impl: (self: unknown, other: unknown) =>
        buildOperation({
          method: 'mul',
          args: [toExpr(self, 'pg/int4@1'), toExpr(other, 'pg/float8@1')],
          returns: { codecId: 'pg/float8@1', nullable: false },
          lowering: {
            targetFamily: 'sql',
            strategy: 'function',
            template: '{{self}} * {{arg0}}',
          },
        }),
    },
    {
      method: 'castInt',
      self: { codecId: 'pg/int8@1' },
      impl: (self: unknown) =>
        buildOperation({
          method: 'castInt',
          args: [toExpr(self, 'pg/int8@1')],
          returns: { codecId: 'pg/int4@1', nullable: false },
          lowering: {
            targetFamily: 'sql',
            strategy: 'function',
            template: '({{self}})::int',
          },
        }),
    },
    {
      method: 'castIntFromInt4',
      self: { codecId: 'pg/int4@1' },
      impl: (self: unknown) =>
        buildOperation({
          method: 'castIntFromInt4',
          args: [toExpr(self, 'pg/int4@1')],
          returns: { codecId: 'pg/int4@1', nullable: false },
          lowering: {
            targetFamily: 'sql',
            strategy: 'function',
            template: '({{self}})::int',
          },
        }),
    },
    {
      method: 'castReal',
      self: { codecId: 'pg/float8@1' },
      impl: (self: unknown) =>
        buildOperation({
          method: 'castReal',
          args: [toExpr(self, 'pg/float8@1')],
          returns: { codecId: 'pg/float4@1', nullable: false },
          lowering: {
            targetFamily: 'sql',
            strategy: 'function',
            template: '({{self}})::real',
          },
        }),
    },
  ],
  create() {
    return { familyId: 'sql', targetId: 'postgres' };
  },
};

const customerColumns = [
  'id',
  'company_name',
  'contact_name',
  'contact_title',
  'address',
  'city',
  'postal_code',
  'region',
  'country',
  'phone',
  'fax',
] as const;

const employeeColumns = [
  'id',
  'last_name',
  'first_name',
  'title',
  'title_of_courtesy',
  'birth_date',
  'hire_date',
  'address',
  'city',
  'postal_code',
  'country',
  'home_phone',
  'extension',
  'notes',
  'recipient_id',
] as const;

const supplierColumns = [
  'id',
  'company_name',
  'contact_name',
  'contact_title',
  'address',
  'city',
  'region',
  'postal_code',
  'country',
  'phone',
] as const;

const productColumns = [
  'id',
  'name',
  'qt_per_unit',
  'unit_price',
  'units_in_stock',
  'units_on_order',
  'reorder_level',
  'discontinued',
  'supplier_id',
] as const;

async function main() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    min: 10,
    max: 10,
  });

  // The runtime queries prisma_contract.marker even when requireMarker is
  // false (it just doesn't fail on empty rows). The table must exist.
  await pool.query('CREATE SCHEMA IF NOT EXISTS prisma_contract');
  await pool.query(`CREATE TABLE IF NOT EXISTS prisma_contract.marker (
    id smallint primary key default 1,
    core_hash text not null,
    profile_hash text not null,
    contract_json jsonb,
    canonical_version int,
    updated_at timestamptz not null default now(),
    app_tag text,
    meta jsonb not null default '{}',
    invariants jsonb
  )`);
  // Earlier runs may have created the table without `invariants` (PR 444's
  // marker reader queries it); backfill idempotently.
  await pool.query('ALTER TABLE prisma_contract.marker ADD COLUMN IF NOT EXISTS invariants jsonb');

  const db = postgres({
    contract,
    binding: { kind: 'pgPool', pool },
    extensions: [ftsExtension],
    verify: { mode: 'onFirstUse', requireMarker: false },
  });
  const runtime = db.runtime();

  const psCustomers = await db.prepare(
    { limit: 'pg/int4@1', offset: 'pg/int4@1' },
    (sql, params) =>
      sql.customers
        .select(...customerColumns)
        .orderBy('id')
        .limit(params.limit)
        .offset(params.offset)
        .build(),
  );

  const psCustomerById = await db.prepare({ id: 'pg/int4@1' }, (sql, params) =>
    sql.customers
      .select(...customerColumns)
      .where((f, fns) => fns.eq(f.id, params.id))
      .limit(1)
      .build(),
  );

  const psSearchCustomer = await db.prepare({ term: 'pg/text@1' }, (sql, params) =>
    sql.customers
      .select(...customerColumns)
      .where((f, fns) => fns['fullTextSearch'](f.company_name, params.term))
      .build(),
  );

  const psEmployees = await db.prepare(
    { limit: 'pg/int4@1', offset: 'pg/int4@1' },
    (sql, params) =>
      sql.employees
        .select(...employeeColumns)
        .orderBy('id')
        .limit(params.limit)
        .offset(params.offset)
        .build(),
  );

  const psEmployeeWithRecipient = await db.prepare({ id: 'pg/int4@1' }, (sql, params) =>
    sql.employees
      .as('e')
      .outerLeftJoin(sql.employees.as('r'), (f, fns) => fns.eq(f.e.recipient_id, f.r.id))
      .select((f) => ({
        id: f.e.id,
        last_name: f.e.last_name,
        first_name: f.e.first_name,
        title: f.e.title,
        title_of_courtesy: f.e.title_of_courtesy,
        birth_date: f.e.birth_date,
        hire_date: f.e.hire_date,
        address: f.e.address,
        city: f.e.city,
        postal_code: f.e.postal_code,
        country: f.e.country,
        home_phone: f.e.home_phone,
        extension: f.e.extension,
        notes: f.e.notes,
        recipient_id: f.e.recipient_id,
        recipient_id_r: f.r.id,
        recipient_last_name: f.r.last_name,
        recipient_first_name: f.r.first_name,
        recipient_title: f.r.title,
        recipient_title_of_courtesy: f.r.title_of_courtesy,
        recipient_birth_date: f.r.birth_date,
        recipient_hire_date: f.r.hire_date,
        recipient_address: f.r.address,
        recipient_city: f.r.city,
        recipient_postal_code: f.r.postal_code,
        recipient_country: f.r.country,
        recipient_home_phone: f.r.home_phone,
        recipient_extension: f.r.extension,
        recipient_notes: f.r.notes,
        recipient_recipient_id: f.r.recipient_id,
      }))
      .where((f, fns) => fns.eq(f.e.id, params.id))
      .build(),
  );

  const psSuppliers = await db.prepare(
    { limit: 'pg/int4@1', offset: 'pg/int4@1' },
    (sql, params) =>
      sql.suppliers
        .select(...supplierColumns)
        .orderBy('id')
        .limit(params.limit)
        .offset(params.offset)
        .build(),
  );

  const psSupplierById = await db.prepare({ id: 'pg/int4@1' }, (sql, params) =>
    sql.suppliers
      .select(...supplierColumns)
      .where((f, fns) => fns.eq(f.id, params.id))
      .limit(1)
      .build(),
  );

  const psProducts = await db.prepare(
    { limit: 'pg/int4@1', offset: 'pg/int4@1' },
    (sql, params) =>
      sql.products
        .select(...productColumns)
        .orderBy('id')
        .limit(params.limit)
        .offset(params.offset)
        .build(),
  );

  const psProductWithSupplier = await db.prepare({ id: 'pg/int4@1' }, (sql, params) =>
    sql.products
      .outerLeftJoin(sql.suppliers, (f, fns) => fns.eq(f.products.supplier_id, f.suppliers.id))
      .select((f) => ({
        id: f.products.id,
        name: f.products.name,
        qt_per_unit: f.products.qt_per_unit,
        unit_price: f.products.unit_price,
        units_in_stock: f.products.units_in_stock,
        units_on_order: f.products.units_on_order,
        reorder_level: f.products.reorder_level,
        discontinued: f.products.discontinued,
        supplier_id: f.products.supplier_id,
        supplier_id_s: f.suppliers.id,
        supplier_company_name: f.suppliers.company_name,
        supplier_contact_name: f.suppliers.contact_name,
        supplier_contact_title: f.suppliers.contact_title,
        supplier_address: f.suppliers.address,
        supplier_city: f.suppliers.city,
        supplier_region: f.suppliers.region,
        supplier_postal_code: f.suppliers.postal_code,
        supplier_country: f.suppliers.country,
        supplier_phone: f.suppliers.phone,
      }))
      .where((f, fns) => fns.eq(f.products.id, params.id))
      .build(),
  );

  const psSearchProduct = await db.prepare({ term: 'pg/text@1' }, (sql, params) =>
    sql.products
      .select(...productColumns)
      .where((f, fns) => fns['fullTextSearch'](f.name, params.term))
      .build(),
  );

  const psOrdersWithDetails = await db.prepare(
    { limit: 'pg/int4@1', offset: 'pg/int4@1' },
    (sql, params) =>
      sql.orders
        .outerLeftJoin(sql.order_details, (f, fns) =>
          fns.eq(f.orders.id, f.order_details.order_id),
        )
        .select((f, fns) => ({
          id: f.orders.id,
          shipped_date: f.orders.shipped_date,
          ship_name: f.orders.ship_name,
          ship_city: f.orders.ship_city,
          ship_country: f.orders.ship_country,
          productsCount: fns['castInt'](fns.count(f.order_details.product_id)),
          quantitySum: fns['castIntFromInt4'](fns.sum(f.order_details.quantity)),
          totalPrice: fns['castReal'](
            fns.sum(fns['mul'](f.order_details.quantity, f.order_details.unit_price)),
          ),
        }))
        .groupBy((f) => f.orders.id)
        .orderBy((f) => f.orders.id)
        .limit(params.limit)
        .offset(params.offset)
        .build(),
  );

  const psOrderWithDetails = await db.prepare({ id: 'pg/int4@1' }, (sql, params) =>
    sql.orders
      .outerLeftJoin(sql.order_details, (f, fns) => fns.eq(f.orders.id, f.order_details.order_id))
      .select((f, fns) => ({
        id: f.orders.id,
        shipped_date: f.orders.shipped_date,
        ship_name: f.orders.ship_name,
        ship_city: f.orders.ship_city,
        ship_country: f.orders.ship_country,
        productsCount: fns['castInt'](fns.count(f.order_details.product_id)),
        quantitySum: fns['castIntFromInt4'](fns.sum(f.order_details.quantity)),
        totalPrice: fns['castReal'](
          fns.sum(fns['mul'](f.order_details.quantity, f.order_details.unit_price)),
        ),
      }))
      .where((f, fns) => fns.eq(f.orders.id, params.id))
      .groupBy((f) => f.orders.id)
      .orderBy((f) => f.orders.id)
      .build(),
  );

  const psOrderWithDetailsAndProducts = await db.prepare({ id: 'pg/int4@1' }, (sql, params) =>
    sql.orders
      .outerLeftJoin(sql.order_details, (f, fns) => fns.eq(f.orders.id, f.order_details.order_id))
      .outerLeftJoin(sql.products, (f, fns) =>
        fns.eq(f.order_details.product_id, f.products.id),
      )
      .select((f) => ({
        id: f.orders.id,
        order_date: f.orders.order_date,
        required_date: f.orders.required_date,
        shipped_date: f.orders.shipped_date,
        ship_via: f.orders.ship_via,
        freight: f.orders.freight,
        ship_name: f.orders.ship_name,
        ship_city: f.orders.ship_city,
        ship_region: f.orders.ship_region,
        ship_postal_code: f.orders.ship_postal_code,
        ship_country: f.orders.ship_country,
        customer_id: f.orders.customer_id,
        employee_id: f.orders.employee_id,
        detail_unit_price: f.order_details.unit_price,
        detail_quantity: f.order_details.quantity,
        detail_discount: f.order_details.discount,
        detail_order_id: f.order_details.order_id,
        detail_product_id: f.order_details.product_id,
        product_id_p: f.products.id,
        product_name: f.products.name,
        product_qt_per_unit: f.products.qt_per_unit,
        product_unit_price: f.products.unit_price,
        product_units_in_stock: f.products.units_in_stock,
        product_units_on_order: f.products.units_on_order,
        product_reorder_level: f.products.reorder_level,
        product_discontinued: f.products.discontinued,
        product_supplier_id: f.products.supplier_id,
      }))
      .where((f, fns) => fns.eq(f.orders.id, params.id))
      .build(),
  );

  const app = new Hono();
  app.route('', cpuUsage);

  app.get('/customers', async (c) => {
    const limit = Number(c.req.query('limit'));
    const offset = Number(c.req.query('offset'));
    const result = await psCustomers.execute(runtime, { limit, offset });
    return c.json(result);
  });

  app.get('/customer-by-id', async (c) => {
    const id = Number(c.req.query('id'));
    const rows = await psCustomerById.execute(runtime, { id });
    return c.json(rows[0] ?? null);
  });

  app.get('/search-customer', async (c) => {
    const term = `${c.req.query('term')}:*`;
    const result = await psSearchCustomer.execute(runtime, { term });
    return c.json(result);
  });

  app.get('/employees', async (c) => {
    const limit = Number(c.req.query('limit'));
    const offset = Number(c.req.query('offset'));
    const result = await psEmployees.execute(runtime, { limit, offset });
    return c.json(result);
  });

  app.get('/employee-with-recipient', async (c) => {
    const id = Number(c.req.query('id'));
    const result = await psEmployeeWithRecipient.execute(runtime, { id });
    return c.json(result);
  });

  app.get('/suppliers', async (c) => {
    const limit = Number(c.req.query('limit'));
    const offset = Number(c.req.query('offset'));
    const result = await psSuppliers.execute(runtime, { limit, offset });
    return c.json(result);
  });

  app.get('/supplier-by-id', async (c) => {
    const id = Number(c.req.query('id'));
    const rows = await psSupplierById.execute(runtime, { id });
    return c.json(rows[0] ?? null);
  });

  app.get('/products', async (c) => {
    const limit = Number(c.req.query('limit'));
    const offset = Number(c.req.query('offset'));
    const result = await psProducts.execute(runtime, { limit, offset });
    return c.json(result);
  });

  app.get('/product-with-supplier', async (c) => {
    const id = Number(c.req.query('id'));
    const result = await psProductWithSupplier.execute(runtime, { id });
    return c.json(result);
  });

  app.get('/search-product', async (c) => {
    const term = `${c.req.query('term')}:*`;
    const result = await psSearchProduct.execute(runtime, { term });
    return c.json(result);
  });

  app.get('/orders-with-details', async (c) => {
    const limit = Number(c.req.query('limit'));
    const offset = Number(c.req.query('offset'));
    const result = await psOrdersWithDetails.execute(runtime, { limit, offset });
    return c.json(result);
  });

  app.get('/order-with-details', async (c) => {
    const id = Number(c.req.query('id'));
    const result = await psOrderWithDetails.execute(runtime, { id });
    return c.json(result);
  });

  app.get('/order-with-details-and-products', async (c) => {
    const id = Number(c.req.query('id'));
    const result = await psOrderWithDetailsAndProducts.execute(runtime, { id });
    return c.json(result);
  });

  serve({ fetch: app.fetch, port: 3002 });
  console.log(`Worker ${process.pid} started`);
}

if (cluster.isPrimary) {
  console.log(`Primary ${process.pid} is running`);
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
  cluster.on('exit', (worker) => {
    console.log(`worker ${worker.process.pid} died`);
  });
} else {
  await main();
}
