import 'dotenv/config';
import { defineConfig as definePostgresConfig } from '@prisma/orm-postgres/config';
import { definePrismaConfig } from 'prisma/config';

export default definePrismaConfig({
  orm: definePostgresConfig({
    contract: 'src/prisma-next-contract.prisma',
    output: 'src/generated/prisma8',
    db: {
      connection: process.env['DATABASE_URL'],
    },
  }),
});
