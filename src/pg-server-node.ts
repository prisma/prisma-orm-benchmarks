import { serve } from '@hono/node-server';
import cluster from 'cluster';
import 'dotenv/config';
import { Hono } from 'hono';
import os from 'os';
import pg from 'pg';
import cpuUsage from './cpu-usage';

const numCPUs = os.cpus().length;

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  min: 10,
  max: 10,
});

// All queries below use the pg "named query" protocol-level prepared statement
// support: when `name` is set, PostgreSQL parses and plans the statement once
// per connection and reuses it for subsequent invocations.
//
// Column selection / aliasing / join shape mirrors the prisma-next baseline
// (./prisma-next-server-node.mts) so the over-the-wire response shape is
// identical: snake_case columns, flat LEFT JOINs (no JSON aggregation),
// and the same "_id_r" / "_id_s" / "_id_p" collision renames on duplicate
// `id` columns from joined tables.

// p1: paginated customers
const Q_CUSTOMERS = {
  name: 'p1',
  text: `
    SELECT
      id,
      company_name,
      contact_name,
      contact_title,
      address,
      city,
      postal_code,
      region,
      country,
      phone,
      fax
    FROM customers
    ORDER BY id ASC
    LIMIT $1 OFFSET $2
  `,
};

// p2: customer by id
const Q_CUSTOMER_BY_ID = {
  name: 'p2',
  text: `
    SELECT
      id,
      company_name,
      contact_name,
      contact_title,
      address,
      city,
      postal_code,
      region,
      country,
      phone,
      fax
    FROM customers
    WHERE id = $1
    LIMIT 1
  `,
};

// p3: full-text search customers
const Q_SEARCH_CUSTOMER = {
  name: 'p3',
  text: `
    SELECT
      id,
      company_name,
      contact_name,
      contact_title,
      address,
      city,
      postal_code,
      region,
      country,
      phone,
      fax
    FROM customers
    WHERE to_tsvector('english', company_name) @@ to_tsquery('english', $1)
  `,
};

// p4: paginated employees
const Q_EMPLOYEES = {
  name: 'p4',
  text: `
    SELECT
      id,
      last_name,
      first_name,
      title,
      title_of_courtesy,
      birth_date,
      hire_date,
      address,
      city,
      postal_code,
      country,
      home_phone,
      extension,
      notes,
      recipient_id
    FROM employees
    ORDER BY id ASC
    LIMIT $1 OFFSET $2
  `,
};

// p5: employee with self-referential recipient (flat LEFT JOIN)
const Q_EMPLOYEE_WITH_RECIPIENT = {
  name: 'p5',
  text: `
    SELECT
      e.id,
      e.last_name,
      e.first_name,
      e.title,
      e.title_of_courtesy,
      e.birth_date,
      e.hire_date,
      e.address,
      e.city,
      e.postal_code,
      e.country,
      e.home_phone,
      e.extension,
      e.notes,
      e.recipient_id,
      r.id                AS recipient_id_r,
      r.last_name         AS recipient_last_name,
      r.first_name        AS recipient_first_name,
      r.title             AS recipient_title,
      r.title_of_courtesy AS recipient_title_of_courtesy,
      r.birth_date        AS recipient_birth_date,
      r.hire_date         AS recipient_hire_date,
      r.address           AS recipient_address,
      r.city              AS recipient_city,
      r.postal_code       AS recipient_postal_code,
      r.country           AS recipient_country,
      r.home_phone        AS recipient_home_phone,
      r.extension         AS recipient_extension,
      r.notes             AS recipient_notes,
      r.recipient_id      AS recipient_recipient_id
    FROM employees e
    LEFT JOIN employees r ON r.id = e.recipient_id
    WHERE e.id = $1
  `,
};

// p6: paginated suppliers
const Q_SUPPLIERS = {
  name: 'p6',
  text: `
    SELECT
      id,
      company_name,
      contact_name,
      contact_title,
      address,
      city,
      region,
      postal_code,
      country,
      phone
    FROM suppliers
    ORDER BY id ASC
    LIMIT $1 OFFSET $2
  `,
};

// p7: supplier by id
const Q_SUPPLIER_BY_ID = {
  name: 'p7',
  text: `
    SELECT
      id,
      company_name,
      contact_name,
      contact_title,
      address,
      city,
      region,
      postal_code,
      country,
      phone
    FROM suppliers
    WHERE id = $1
    LIMIT 1
  `,
};

// p8: paginated products
const Q_PRODUCTS = {
  name: 'p8',
  text: `
    SELECT
      id,
      name,
      qt_per_unit,
      unit_price,
      units_in_stock,
      units_on_order,
      reorder_level,
      discontinued,
      supplier_id
    FROM products
    ORDER BY id ASC
    LIMIT $1 OFFSET $2
  `,
};

// p9: product with supplier (flat LEFT JOIN)
const Q_PRODUCT_WITH_SUPPLIER = {
  name: 'p9',
  text: `
    SELECT
      p.id,
      p.name,
      p.qt_per_unit,
      p.unit_price,
      p.units_in_stock,
      p.units_on_order,
      p.reorder_level,
      p.discontinued,
      p.supplier_id,
      s.id            AS supplier_id_s,
      s.company_name  AS supplier_company_name,
      s.contact_name  AS supplier_contact_name,
      s.contact_title AS supplier_contact_title,
      s.address       AS supplier_address,
      s.city          AS supplier_city,
      s.region        AS supplier_region,
      s.postal_code   AS supplier_postal_code,
      s.country       AS supplier_country,
      s.phone         AS supplier_phone
    FROM products p
    LEFT JOIN suppliers s ON s.id = p.supplier_id
    WHERE p.id = $1
  `,
};

// p10: full-text search products
const Q_SEARCH_PRODUCT = {
  name: 'p10',
  text: `
    SELECT
      id,
      name,
      qt_per_unit,
      unit_price,
      units_in_stock,
      units_on_order,
      reorder_level,
      discontinued,
      supplier_id
    FROM products
    WHERE to_tsvector('english', name) @@ to_tsquery('english', $1)
  `,
};

// p11: paginated orders aggregated with their details
const Q_ORDERS_WITH_DETAILS = {
  name: 'p11',
  text: `
    SELECT
      o.id,
      o.shipped_date,
      o.ship_name,
      o.ship_city,
      o.ship_country,
      (count(d.product_id))::int                       AS "productsCount",
      (sum(d.quantity))::int                           AS "quantitySum",
      (sum(d.quantity * d.unit_price))::real           AS "totalPrice"
    FROM orders o
    LEFT JOIN order_details d ON o.id = d.order_id
    GROUP BY o.id
    ORDER BY o.id ASC
    LIMIT $1 OFFSET $2
  `,
};

// p12: single order aggregated with its details
const Q_ORDER_WITH_DETAILS = {
  name: 'p12',
  text: `
    SELECT
      o.id,
      o.shipped_date,
      o.ship_name,
      o.ship_city,
      o.ship_country,
      (count(d.product_id))::int                       AS "productsCount",
      (sum(d.quantity))::int                           AS "quantitySum",
      (sum(d.quantity * d.unit_price))::real           AS "totalPrice"
    FROM orders o
    LEFT JOIN order_details d ON o.id = d.order_id
    WHERE o.id = $1
    GROUP BY o.id
    ORDER BY o.id ASC
  `,
};

// p13: order with all its details and each detail's product (flat LEFT JOIN,
// Cartesian-style — one row per (order, detail) pair, matching prisma-next)
const Q_ORDER_WITH_DETAILS_AND_PRODUCTS = {
  name: 'p13',
  text: `
    SELECT
      o.id,
      o.order_date,
      o.required_date,
      o.shipped_date,
      o.ship_via,
      o.freight,
      o.ship_name,
      o.ship_city,
      o.ship_region,
      o.ship_postal_code,
      o.ship_country,
      o.customer_id,
      o.employee_id,
      d.unit_price    AS detail_unit_price,
      d.quantity      AS detail_quantity,
      d.discount      AS detail_discount,
      d.order_id      AS detail_order_id,
      d.product_id    AS detail_product_id,
      p.id            AS product_id_p,
      p.name          AS product_name,
      p.qt_per_unit   AS product_qt_per_unit,
      p.unit_price    AS product_unit_price,
      p.units_in_stock AS product_units_in_stock,
      p.units_on_order AS product_units_on_order,
      p.reorder_level AS product_reorder_level,
      p.discontinued  AS product_discontinued,
      p.supplier_id   AS product_supplier_id
    FROM orders o
    LEFT JOIN order_details d ON o.id = d.order_id
    LEFT JOIN products p ON d.product_id = p.id
    WHERE o.id = $1
  `,
};

const app = new Hono();
app.route('', cpuUsage);

app.get('/customers', async (c) => {
  const limit = Number(c.req.query('limit'));
  const offset = Number(c.req.query('offset'));
  const { rows } = await pool.query({ ...Q_CUSTOMERS, values: [limit, offset] });
  return c.json(rows);
});

app.get('/customer-by-id', async (c) => {
  const id = Number(c.req.query('id'));
  const { rows } = await pool.query({ ...Q_CUSTOMER_BY_ID, values: [id] });
  return c.json(rows[0] ?? null);
});

app.get('/search-customer', async (c) => {
  const term = `${c.req.query('term')}:*`;
  const { rows } = await pool.query({ ...Q_SEARCH_CUSTOMER, values: [term] });
  return c.json(rows);
});

app.get('/employees', async (c) => {
  const limit = Number(c.req.query('limit'));
  const offset = Number(c.req.query('offset'));
  const { rows } = await pool.query({ ...Q_EMPLOYEES, values: [limit, offset] });
  return c.json(rows);
});

app.get('/employee-with-recipient', async (c) => {
  const id = Number(c.req.query('id'));
  const { rows } = await pool.query({ ...Q_EMPLOYEE_WITH_RECIPIENT, values: [id] });
  return c.json(rows);
});

app.get('/suppliers', async (c) => {
  const limit = Number(c.req.query('limit'));
  const offset = Number(c.req.query('offset'));
  const { rows } = await pool.query({ ...Q_SUPPLIERS, values: [limit, offset] });
  return c.json(rows);
});

app.get('/supplier-by-id', async (c) => {
  const id = Number(c.req.query('id'));
  const { rows } = await pool.query({ ...Q_SUPPLIER_BY_ID, values: [id] });
  return c.json(rows[0] ?? null);
});

app.get('/products', async (c) => {
  const limit = Number(c.req.query('limit'));
  const offset = Number(c.req.query('offset'));
  const { rows } = await pool.query({ ...Q_PRODUCTS, values: [limit, offset] });
  return c.json(rows);
});

app.get('/product-with-supplier', async (c) => {
  const id = Number(c.req.query('id'));
  const { rows } = await pool.query({ ...Q_PRODUCT_WITH_SUPPLIER, values: [id] });
  return c.json(rows);
});

app.get('/search-product', async (c) => {
  const term = `${c.req.query('term')}:*`;
  const { rows } = await pool.query({ ...Q_SEARCH_PRODUCT, values: [term] });
  return c.json(rows);
});

app.get('/orders-with-details', async (c) => {
  const limit = Number(c.req.query('limit'));
  const offset = Number(c.req.query('offset'));
  const { rows } = await pool.query({ ...Q_ORDERS_WITH_DETAILS, values: [limit, offset] });
  return c.json(rows);
});

app.get('/order-with-details', async (c) => {
  const id = Number(c.req.query('id'));
  const { rows } = await pool.query({ ...Q_ORDER_WITH_DETAILS, values: [id] });
  return c.json(rows);
});

app.get('/order-with-details-and-products', async (c) => {
  const id = Number(c.req.query('id'));
  const { rows } = await pool.query({ ...Q_ORDER_WITH_DETAILS_AND_PRODUCTS, values: [id] });
  return c.json(rows);
});

if (cluster.isPrimary) {
  console.log(`Primary ${process.pid} is running`);

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker) => {
    console.log(`worker ${worker.process.pid} died`);
  });
} else {
  serve({
    fetch: app.fetch,
    port: 3003,
  });
  console.log(`Worker ${process.pid} started on port 3003`);
}
