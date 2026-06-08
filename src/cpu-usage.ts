import { Hono } from 'hono';
import os from 'os';

interface CpuUsage {
  usage: number;
  total: number;
}

const app = new Hono();

let temp: CpuUsage[] = [];

app.get('/stats', (c) => {
  const cpus = os.cpus();
  const cpuUsage = cpus.map((cpu) => {
    const { user, nice, sys, irq, idle } = cpu.times;
    const total = user + nice + sys + irq + idle;
    const usage = user + nice + sys + irq;
    return { usage, total };
  });

  let result: number[] = [];
  if (temp.length > 0) {
    result = cpuUsage.map((cpu, index) => {
      const usageDiff = cpu.usage - temp[index].usage;
      const totalDiff = cpu.total - temp[index].total;
      return parseInt(((100 * usageDiff) / totalDiff).toFixed());
    });
  }
  temp = cpuUsage;

  return c.json(result);
});

// Use `export =` (CJS module.exports = app) instead of `export default app`.
// With `export default`, the compiled CJS module is `{ default: app, __esModule: true }`,
// which causes ESM importers (under nodenext) and tsx's interop to expose the
// value behind one — or, under tsx, two — layers of `.default`. `export =`
// instead compiles to `module.exports = app`, so every importer (CJS sibling
// `.ts` files via esModuleInterop, ESM `.mts` files via Node's CJS-import
// synthesis) sees `cpuUsage` as the Hono instance directly.
export = app;
