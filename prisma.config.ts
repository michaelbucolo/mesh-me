import path from "node:path";
import "dotenv/config";
import { defineConfig } from "prisma/config";
import { PrismaLibSQL } from "@prisma/adapter-libsql";

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  datasource: {
    url: process.env["DATABASE_URL"] ?? "file:./prisma/dev.db",
  },
  migrate: {
    async adapter() {
      return new PrismaLibSQL({
        url: process.env["DATABASE_URL"]!,
        authToken: process.env["DATABASE_AUTH_TOKEN"],
      });
    },
  },
});
