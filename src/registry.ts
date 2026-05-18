import type { ZodRawShapeCompat } from "@modelcontextprotocol/sdk/server/zod-compat.js";

export interface ToolDefinition {
  name: string;
  description: string;
  category: string;
  zodShape: ZodRawShapeCompat;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: (args: any) => unknown;
}

export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();
  public loadedCategories: Set<string> = new Set();

  registerCategory(categoryName: string, categoryTools: ToolDefinition[]): string[] {
    const newToolNames: string[] = [];
    for (const tool of categoryTools) {
      this.tools.set(tool.name, tool);
      newToolNames.push(tool.name);
    }
    this.loadedCategories.add(categoryName);
    return newToolNames;
  }

  unregisterCategory(categoryName: string): void {
    for (const [name, tool] of this.tools.entries()) {
      if (tool.category === categoryName) {
        this.tools.delete(name);
      }
    }
    this.loadedCategories.delete(categoryName);
  }

  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }
}
