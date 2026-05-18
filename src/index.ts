#!/usr/bin/env node
import { TrimitMcpServer } from "./server.js";

async function main(): Promise<void> {
  const server = new TrimitMcpServer();
  await server.start();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
