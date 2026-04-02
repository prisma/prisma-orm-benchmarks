import { serve } from "@hono/node-server";
import postgres from "@prisma-next/postgres";
import cluster from "cluster";
import "dotenv/config";
import { Hono } from "hono";
import os from "os";
import pg from "pg";
import cpuUsage from "./cpu-usage";
import { contract } from "./prisma-next-contract";

const numCPUs = os.cpus().length;

// Inline extension: full-text search via to_tsvector/to_tsquery
const fullTextSearchExtension = {
  kind: "extension" as const,
  id: "fulltext",
  version: "0.0.1",
  familyId: "sql" as const,
  targetId: "postgres" as const,
  codecs: () => ({
    get: () => undefined,
    has: () => false,
    getByScalar: () => [],
    getDefaultCodec: () => undefined,
    register: () => {},
    hasTrait: () => false,
    traitsOf: () => [],
    [Symbol.iterator]: function* () {},
    values: function* () {},
  }),
  operationSignatures: () => [],
  parameterizedCodecs: () => [],
  queryOperations: () => [
    {
      method: "fullTextSearch",
      args: [
        { codecId: "pg/text@1", nullable: false },
        { codecId: "pg/text@1", nullable: false },
      ],
      returns: { codecId: "pg/bool@1", nullable: false },
      lowering: {
        targetFamily: "sql",
        strategy: "function",
        template:
          "to_tsvector('english', {{self}}) @@ to_tsquery('english', {{arg0}})",
      },
    },
    {
      method: "mul",
      args: [
        { codecId: "pg/int4@1", nullable: false },
        { codecId: "pg/float8@1", nullable: false },
      ],
      returns: { codecId: "pg/float8@1", nullable: false },
      lowering: {
        targetFamily: "sql",
        strategy: "function",
        template: "{{self}} * {{arg0}}",
      },
    },
    {
      method: "castInt",
      args: [{ codecId: "pg/int8@1", nullable: false }],
      returns: { codecId: "pg/int4@1", nullable: false },
      lowering: {
        targetFamily: "sql",
        strategy: "function",
        template: "({{self}})::int",
      },
    },
    {
      method: "castReal",
      args: [{ codecId: "pg/float8@1", nullable: false }],
      returns: { codecId: "pg/float4@1", nullable: false },
      lowering: {
        targetFamily: "sql",
        strategy: "function",
        template: "({{self}})::real",
      },
    },
  ],
  create: () => ({ familyId: "sql" as const, targetId: "postgres" as const }),
};

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

// Create prisma_contract.marker table required by the runtime verification
pool.query("CREATE SCHEMA IF NOT EXISTS prisma_contract").then(() =>
  pool.query(
    `CREATE TABLE IF NOT EXISTS prisma_contract.marker (
      id smallint primary key default 1,
      core_hash text not null,
      profile_hash text not null,
      contract_json jsonb,
      canonical_version int,
      updated_at timestamptz not null default now(),
      app_tag text,
      meta jsonb not null default '{}'
    )`,
  ),
);

const db = postgres({
  contract,
  binding: { kind: "pgPool" as const, pool },
  extensions: [fullTextSearchExtension as any],
  verify: { mode: "onFirstUse" as const, requireMarker: false },
});
const runtime = db.runtime();

const app = new Hono();
app.route("", cpuUsage);

app.get("/customers", async (c) => {
  const limit = Number(c.req.query("limit"));
  const offset = Number(c.req.query("offset"));
  const plan = db.sql.customers
    .select(
      "id",
      "company_name",
      "contact_name",
      "contact_title",
      "address",
      "city",
      "postal_code",
      "region",
      "country",
      "phone",
      "fax",
    )
    .orderBy("id")
    .limit(limit)
    .offset(offset)
    .build();
  const result = await runtime.execute(plan);
  return c.json(result);
});

app.get("/customer-by-id", async (c) => {
  const id = Number(c.req.query("id")!);
  const plan = db.sql.customers
    .select(
      "id",
      "company_name",
      "contact_name",
      "contact_title",
      "address",
      "city",
      "postal_code",
      "region",
      "country",
      "phone",
      "fax",
    )
    .where((f, fns) => fns.eq(f.id, id))
    .limit(1)
    .build();
  const rows = await runtime.execute(plan);
  return c.json(rows[0] ?? null);
});

app.get("/search-customer", async (c) => {
  const term = `${c.req.query("term")}:*`;
  const plan = db.sql.customers
    .select(
      "id",
      "company_name",
      "contact_name",
      "contact_title",
      "address",
      "city",
      "postal_code",
      "region",
      "country",
      "phone",
      "fax",
    )
    .where((f, fns) => fns['fullTextSearch'](f.company_name, term))
    .build();
  const result = await runtime.execute(plan);
  return c.json(result);
});

app.get("/employees", async (c) => {
  const limit = Number(c.req.query("limit"));
  const offset = Number(c.req.query("offset"));
  const plan = db.sql.employees
    .select(
      "id",
      "last_name",
      "first_name",
      "title",
      "title_of_courtesy",
      "birth_date",
      "hire_date",
      "address",
      "city",
      "postal_code",
      "country",
      "home_phone",
      "extension",
      "notes",
      "recipient_id",
    )
    .orderBy("id")
    .limit(limit)
    .offset(offset)
    .build();
  const result = await runtime.execute(plan);
  return c.json(result);
});

app.get("/employee-with-recipient", async (c) => {
  const id = Number(c.req.query("id")!);
  const plan = db.sql.employees
    .as("e")
    .outerLeftJoin(db.sql.employees.as("r"), (f, fns) =>
      fns.eq(f.e.recipient_id, f.r.id),
    )
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
    .where((f, fns) => fns.eq(f.e.id, id))
    .build();
  const result = await runtime.execute(plan);
  return c.json(result);
});

app.get("/suppliers", async (c) => {
  const limit = Number(c.req.query("limit"));
  const offset = Number(c.req.query("offset"));
  const plan = db.sql.suppliers
    .select(
      "id",
      "company_name",
      "contact_name",
      "contact_title",
      "address",
      "city",
      "region",
      "postal_code",
      "country",
      "phone",
    )
    .orderBy("id")
    .limit(limit)
    .offset(offset)
    .build();
  const result = await runtime.execute(plan);
  return c.json(result);
});

app.get("/supplier-by-id", async (c) => {
  const id = Number(c.req.query("id")!);
  const plan = db.sql.suppliers
    .select(
      "id",
      "company_name",
      "contact_name",
      "contact_title",
      "address",
      "city",
      "region",
      "postal_code",
      "country",
      "phone",
    )
    .where((f, fns) => fns.eq(f.id, id))
    .limit(1)
    .build();
  const rows = await runtime.execute(plan);
  return c.json(rows[0] ?? null);
});

app.get("/products", async (c) => {
  const limit = Number(c.req.query("limit"));
  const offset = Number(c.req.query("offset"));
  const plan = db.sql.products
    .select(
      "id",
      "name",
      "qt_per_unit",
      "unit_price",
      "units_in_stock",
      "units_on_order",
      "reorder_level",
      "discontinued",
      "supplier_id",
    )
    .orderBy("id")
    .limit(limit)
    .offset(offset)
    .build();
  const result = await runtime.execute(plan);
  return c.json(result);
});

app.get("/product-with-supplier", async (c) => {
  const id = Number(c.req.query("id")!);
  const plan = db.sql.products
    .outerLeftJoin(db.sql.suppliers, (f, fns) =>
      fns.eq(f.products.supplier_id, f.suppliers.id),
    )
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
    .where((f, fns) => fns.eq(f.products.id, id))
    .build();
  const result = await runtime.execute(plan);
  return c.json(result);
});

app.get("/search-product", async (c) => {
  const term = `${c.req.query("term")}:*`;
  const plan = db.sql.products
    .select(
      "id",
      "name",
      "qt_per_unit",
      "unit_price",
      "units_in_stock",
      "units_on_order",
      "reorder_level",
      "discontinued",
      "supplier_id",
    )
    .where((f, fns) => fns['fullTextSearch'](f.name, term))
    .build();
  const result = await runtime.execute(plan);
  return c.json(result);
});

app.get("/orders-with-details", async (c) => {
  const limit = Number(c.req.query("limit"));
  const offset = Number(c.req.query("offset"));
  const plan = db.sql.orders
    .outerLeftJoin(db.sql.order_details, (f, fns) =>
      fns.eq(f.orders.id, f.order_details.order_id),
    )
    .select((f, fns) => ({
      id: f.orders.id,
      shipped_date: f.orders.shipped_date,
      ship_name: f.orders.ship_name,
      ship_city: f.orders.ship_city,
      ship_country: f.orders.ship_country,
      productsCount: fns['castInt'](fns.count(f.order_details.product_id)),
      quantitySum: fns['castInt'](fns.sum(f.order_details.quantity)),
      totalPrice: fns['castReal'](fns.sum(fns['mul'](f.order_details.quantity, f.order_details.unit_price))),
    }))
    .groupBy((f) => f.orders.id)
    .orderBy((f) => f.orders.id)
    .limit(limit)
    .offset(offset)
    .build();
  const result = await runtime.execute(plan);
  return c.json(result);
});

app.get("/order-with-details", async (c) => {
  const id = Number(c.req.query("id")!);
  const plan = db.sql.orders
    .outerLeftJoin(db.sql.order_details, (f, fns) =>
      fns.eq(f.orders.id, f.order_details.order_id),
    )
    .select((f, fns) => ({
      id: f.orders.id,
      shipped_date: f.orders.shipped_date,
      ship_name: f.orders.ship_name,
      ship_city: f.orders.ship_city,
      ship_country: f.orders.ship_country,
      productsCount: fns['castInt'](fns.count(f.order_details.product_id)),
      quantitySum: fns['castInt'](fns.sum(f.order_details.quantity)),
      totalPrice: fns['castReal'](fns.sum(fns['mul'](f.order_details.quantity, f.order_details.unit_price))),
    }))
    .where((f, fns) => fns.eq(f.orders.id, id))
    .groupBy((f) => f.orders.id)
    .orderBy((f) => f.orders.id)
    .build();
  const result = await runtime.execute(plan);
  return c.json(result);
});

app.get("/order-with-details-and-products", async (c) => {
  const id = Number(c.req.query("id")!);
  const plan = db.sql.orders
    .outerLeftJoin(db.sql.order_details, (f, fns) =>
      fns.eq(f.orders.id, f.order_details.order_id),
    )
    .outerLeftJoin(db.sql.products, (f, fns) =>
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
    .where((f, fns) => fns.eq(f.orders.id, id))
    .build();
  const result = await runtime.execute(plan);
  return c.json(result);
});

if (cluster.isPrimary) {
  console.log(`Primary ${process.pid} is running`);

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on("exit", (worker) => {
    console.log(`worker ${worker.process.pid} died`);
  });
} else {
  serve({
    fetch: app.fetch,
    port: 3003,
  });
  console.log(`Worker ${process.pid} started`);
}
