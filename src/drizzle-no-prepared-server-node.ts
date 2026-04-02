import { serve } from "@hono/node-server";
import cluster from "cluster";
import "dotenv/config";
import { asc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Hono } from "hono";
import os from "os";
import pg from "pg";
import cpuUsage from "./cpu-usage";
import { relations } from "./relations";
import * as schema from "./schema";
import { customers, details, orders, products } from "./schema";

const numCPUs = os.cpus().length;

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});
const db = drizzle({ client: pool, schema, relations, logger: false });

const app = new Hono();
app.route("", cpuUsage);
app.get("/customers", async (c) => {
  const limit = Number(c.req.query("limit"));
  const offset = Number(c.req.query("offset"));
  const result = await db.query.customers.findMany({
    limit,
    offset,
    orderBy: {
      id: "asc",
    },
  });
  return c.json(result);
});

app.get("/customer-by-id", async (c) => {
  const result = await db.query.customers.findFirst({
    where: {
      id: c.req.query("id"),
    },
  });
  return c.json(result);
});

app.get("/search-customer", async (c) => {
  // const term = `%${c.req.query("term")}%`;
  const term = `${c.req.query("term")}:*`;
  const result = await db.query.customers.findMany({
    where: {
      RAW: (table) => sql`to_tsvector('english', ${table.companyName}) @@ to_tsquery('english', ${term})`,
    },
  });
  return c.json(result);
});

app.get("/employees", async (c) => {
  const limit = Number(c.req.query("limit"));
  const offset = Number(c.req.query("offset"));
  const result = await db.query.employees.findMany({
    limit,
    offset,
    orderBy: {
      id: "asc",
    },
  });
  return c.json(result);
});

app.get("/employee-with-recipient", async (c) => {
  const result = await db.query.employees.findMany({
    with: {
      recipient: true,
    },
    where: {
      id: c.req.query("id"),
    },
  });
  return c.json(result);
});

app.get("/suppliers", async (c) => {
  const limit = Number(c.req.query("limit"));
  const offset = Number(c.req.query("offset"));

  const result = await db.query.suppliers.findMany({
    limit,
    offset,
    orderBy: {
      id: "asc",
    },
  });
  return c.json(result);
});

app.get("/supplier-by-id", async (c) => {
  const result = await db.query.suppliers.findFirst({
    where: {
      id: c.req.query("id"),
    },
  });
  return c.json(result);
});

app.get("/products", async (c) => {
  const limit = Number(c.req.query("limit"));
  const offset = Number(c.req.query("offset"));

  const result = await db.query.products.findMany({
    limit,
    offset,
    orderBy: {
      id: "asc",
    },
  });
  return c.json(result);
});

app.get("/product-with-supplier", async (c) => {
  const result = await db.query.products.findMany({
    where: {
      id: c.req.query("id"),
    },
    with: {
      supplier: true,
    },
  });
  return c.json(result);
});

app.get("/search-product", async (c) => {
  // const term = `%${c.req.query("term")}%`;
  const term = `${c.req.query("term")}:*`;
  const result = await db.query.products.findMany({
    where: {
      RAW: (table) => sql`to_tsvector('english', ${table.name}) @@ to_tsquery('english', ${term})`,
    },
  });
  return c.json(result);
});

app.get("/orders-with-details", async (c) => {
  const limit = Number(c.req.query("limit"));
  const offset = Number(c.req.query("offset"));

  const result = await db
    .select({
      id: orders.id,
      shippedDate: orders.shippedDate,
      shipName: orders.shipName,
      shipCity: orders.shipCity,
      shipCountry: orders.shipCountry,
      productsCount: sql<number>`count(${details.productId})::int`,
      quantitySum: sql<number>`sum(${details.quantity})::int`,
      totalPrice: sql<number>`sum(${details.quantity} * ${details.unitPrice})::real`,
    })
    .from(orders)
    .leftJoin(details, eq(details.orderId, orders.id))
    .groupBy(orders.id)
    .orderBy(asc(orders.id))
    .limit(limit)
    .offset(offset);
  return c.json(result);
});

app.get("/order-with-details", async (c) => {
  const result = await db
    .select({
      id: orders.id,
      shippedDate: orders.shippedDate,
      shipName: orders.shipName,
      shipCity: orders.shipCity,
      shipCountry: orders.shipCountry,
      productsCount: sql<number>`count(${details.productId})::int`,
      quantitySum: sql<number>`sum(${details.quantity})::int`,
      totalPrice: sql<number>`sum(${details.quantity} * ${details.unitPrice})::real`,
    })
    .from(orders)
    .leftJoin(details, eq(details.orderId, orders.id))
    .where(eq(orders.id, sql`${c.req.query("id")}`))
    .groupBy(orders.id)
    .orderBy(asc(orders.id));
  return c.json(result);
});

app.get("/order-with-details-and-products", async (c) => {
  const result = await db.query.orders.findMany({
    with: {
      details: {
        with: {
          product: true,
        },
      },
    },
    where: {
      id: c.req.query("id"),
    },
  });
  return c.json(result);
});

if (cluster.isPrimary) {
  console.log(`Primary ${process.pid} is running`);

  //Fork workers
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on("exit", (worker) => {
    console.log(`worker ${worker.process.pid} died`);
  });
} else {
  serve({
    fetch: app.fetch,
    port: 3002,
  });
  console.log(`Worker ${process.pid} started`);
}
