import { existsSync } from "fs";
import { resolve } from "path";
import { Dialer, DialerContext } from "./dialer.types";

export class DialerRegistry {
  private readonly dialPath: string;
  private preDialers: Dialer[] = [];
  private postDialers: Dialer[] = [];

  constructor(dialPath: string) {
    this.dialPath = dialPath;
  }

  registerPreDialer(dialer: Dialer) {
    this.preDialers.push(dialer);
  }

  registerPostDialer(dialer: Dialer) {
    this.postDialers.push(dialer);
  }

  async registerDialers() {
    const resolvedDialPath = resolve(this.dialPath);

    if (!existsSync(resolvedDialPath)) {
      console.error(`Error: Dialer file not found: ${resolvedDialPath}`);
      process.exit(1);
    }

    try {
      const userModule = await import(resolvedDialPath);

      Object.entries(userModule).forEach(([key, fn]) => {
        if (typeof fn === "function") {
          if (key.startsWith("pre")) {
            this.registerPreDialer(fn as Dialer);
          } else if (key.startsWith("post")) {
            this.registerPostDialer(fn as Dialer);
          }
        }
      });
    } catch (error) {
      console.error(`Failed to load dialers:`, error);
      process.exit(1);
    }
  }

  async executePreDialers(context: DialerContext) {
    if (this.preDialers.length === 0) {
      return;
    }

    for (const dial of this.preDialers) {
      await dial(context);
    }
  }

  async executePostDialers(context: DialerContext) {
    if (this.postDialers.length === 0) {
      return;
    }

    for (const dial of this.postDialers) {
      await dial(context);
    }
  }
}
