import { readdir, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { parse } from "jsonc-parser";

const directory = process.env.OPENCODE_MCP_DIR ?? join(homedir(), ".config", "opencode-setup", "mcps");

export default async () => ({
  config: async (config) => {
    const files = await readdir(directory).catch(() => []);

    for (const file of files.filter((file) => file.endsWith(".json") || file.endsWith(".jsonc")).sort()) {
      const fragment = parse(await readFile(join(directory, file), "utf8"));

      if (fragment?.mcp && typeof fragment.mcp === "object" && !Array.isArray(fragment.mcp)) {
        config.mcp = { ...config.mcp, ...fragment.mcp };
      }
    }
  },
});
