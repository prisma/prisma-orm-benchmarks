import postgres from "@prisma-next/postgres";
import { orm } from "@prisma-next/sql-orm-client";
import { serve } from "@hono/node-server";
import cluster from "cluster";
import "dotenv/config";
import { Hono } from "hono";
import os from "os";
import type { Contract } from "./prisma-next/contract.d";
import contractJson from "./prisma-next/contract.json";

const numCPUs = os.cpus().length;
const port = 3003;

interface CpuUsage {
  usage: number;
  total: number;
}

let tempCpuUsage: CpuUsage[] = [];

const toNumber = (value: string | undefined): number => {
  return Number(value ?? 0);
};

const toNumeric = (value: unknown): number => {
  if (value === null || value === undefined) {
    return 0;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getDatabaseUrl = (): string => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }
  return databaseUrl;
};

const createApp = async () => {
  const db = postgres<Contract>({
    contractJson,
    url: getDatabaseUrl(),
  });
  const runtime = await db.runtime();
  const client = orm({
    contract: db.context.contract,
    runtime,
  });

  const app = new Hono();
  app.get("/stats", (c) => {
    const cpus = os.cpus();
    const cpuUsage = cpus.map((cpu) => {
      const { user, nice, sys, irq, idle } = cpu.times;
      const total = user + nice + sys + irq + idle;
      const usage = user + nice + sys + irq;
      return { usage, total };
    });

    let result: number[] = [];
    if (tempCpuUsage.length > 0) {
      result = cpuUsage.map((cpu, index) => {
        const usageDiff = cpu.usage - tempCpuUsage[index].usage;
        const totalDiff = cpu.total - tempCpuUsage[index].total;
        return parseInt(((100 * usageDiff) / totalDiff).toFixed());
      });
    }
    tempCpuUsage = cpuUsage;

    return c.json(result);
  });

  app.get("/customers", async (c) => {
    const limit = toNumber(c.req.query("limit"));
    const offset = toNumber(c.req.query("offset"));

    const result = await client.customers.take(limit).skip(offset).all();
    return c.json(result);
  });

  app.get("/customer-by-id", async (c) => {
    const id = toNumber(c.req.query("id"));
    const result = await client.customers.find({ id });
    return c.json(result);
  });

  app.get("/search-customer", async (c) => {
    const term = c.req.query("term") ?? "";
    const result = await client.customers
      .where((customer) => customer.companyName.ilike(`%${term}%`))
      .all();

    return c.json(result);
  });

  app.get("/employees", async (c) => {
    const limit = toNumber(c.req.query("limit"));
    const offset = toNumber(c.req.query("offset"));

    const result = await client.employees.take(limit).skip(offset).all();
    return c.json(result);
  });

  app.get("/employee-with-recipient", async (c) => {
    const id = toNumber(c.req.query("id"));
    const result = await client.employees
      .where({ id })
      .include("recipient")
      .all();

    return c.json(result);
  });

  app.get("/suppliers", async (c) => {
    const limit = toNumber(c.req.query("limit"));
    const offset = toNumber(c.req.query("offset"));

    const result = await client.suppliers.take(limit).skip(offset).all();
    return c.json(result);
  });

  app.get("/supplier-by-id", async (c) => {
    const id = toNumber(c.req.query("id"));
    const result = await client.suppliers.find({ id });
    return c.json(result);
  });

  app.get("/products", async (c) => {
    const limit = toNumber(c.req.query("limit"));
    const offset = toNumber(c.req.query("offset"));

    const result = await client.products.take(limit).skip(offset).all();
    return c.json(result);
  });

  app.get("/product-with-supplier", async (c) => {
    const id = toNumber(c.req.query("id"));
    const result = await client.products
      .where({ id })
      .include("supplier")
      .all();

    return c.json(result);
  });

  app.get("/search-product", async (c) => {
    const term = c.req.query("term") ?? "";
    const result = await client.products
      .where((product) => product.name.ilike(`%${term}%`))
      .all();

    return c.json(result);
  });

  app.get("/orders-with-details", async (c) => {
    const limit = toNumber(c.req.query("limit"));
    const offset = toNumber(c.req.query("offset"));

    const result = await client.orders
      .include("details")
      .orderBy((order) => order.id.asc())
      .take(limit)
      .skip(offset)
      .all();

    const summarized = result.map((order) => {
      return {
        id: order.id,
        shippedDate: order.shippedDate,
        shipName: order.shipName,
        shipCity: order.shipCity,
        shipCountry: order.shipCountry,
        productsCount: order.details.length,
        quantitySum: order.details.reduce((sum, detail) => {
          return sum + toNumeric(detail.quantity);
        }, 0),
        totalPrice: order.details.reduce((sum, detail) => {
          return sum + toNumeric(detail.quantity) * toNumeric(detail.unitPrice);
        }, 0),
      };
    });

    return c.json(summarized);
  });

  app.get("/order-with-details", async (c) => {
    const id = toNumber(c.req.query("id"));

    const result = await client.orders.where({ id }).include("details").all();
    const summarized = result.map((order) => {
      return {
        id: order.id,
        shippedDate: order.shippedDate,
        shipName: order.shipName,
        shipCity: order.shipCity,
        shipCountry: order.shipCountry,
        productsCount: order.details.length,
        quantitySum: order.details.reduce((sum, detail) => {
          return sum + toNumeric(detail.quantity);
        }, 0),
        totalPrice: order.details.reduce((sum, detail) => {
          return sum + toNumeric(detail.quantity) * toNumeric(detail.unitPrice);
        }, 0),
      };
    });

    return c.json(summarized);
  });

  app.get("/order-with-details-and-products", async (c) => {
    const id = toNumber(c.req.query("id"));

    const result = await client.orders
      .where({ id })
      .include("details", (details) => details.include("product"))
      .all();

    return c.json(result);
  });

  return app;
};

if (cluster.isPrimary) {
  console.log(`Primary ${process.pid} is running`);

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on("exit", (worker) => {
    console.log(`worker ${worker.process.pid} died`);
  });
} else {
  const startWorker = async () => {
    try {
      const app = await createApp();

      serve({
        fetch: app.fetch,
        port,
      });

      console.log(`Worker ${process.pid} started`);
    } catch (err: unknown) {
      console.error("Failed to initialize Prisma Next runtime", err);
      process.exit(1);
    }
  };

  startWorker();
}
