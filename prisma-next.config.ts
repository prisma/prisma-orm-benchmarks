import 'dotenv/config';
import postgresAdapter from '@prisma-next/adapter-postgres/control';
import { defineConfig } from '@prisma-next/cli/config-types';
import postgresDriver from '@prisma-next/driver-postgres/control';
import sql from '@prisma-next/family-sql/control';
import { prismaContract } from '@prisma-next/sql-contract-psl/provider';
import postgres from '@prisma-next/target-postgres/control';

export default defineConfig({
  family: sql,
  target: postgres,
  driver: postgresDriver,
  adapter: postgresAdapter,
  contract: prismaContract('./src/prisma-next-schema.prisma', {
    output: 'src/generated/prisma-next-contract.json',
    target: postgres,
  }),
  db: {
    // biome-ignore lint/style/noNonNullAssertion: loaded from .env
    connection: process.env['DATABASE_URL']!,
  },
});
