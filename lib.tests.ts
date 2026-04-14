import { join, resolve } from "node:path";

import { initSimnet } from "@stacks/clarinet-sdk";
import type { ClarityValue } from "@stacks/transactions";
import fc from "fast-check";

import { getContractFunction, strategyFor } from "./lib";

const manifestPath = join(resolve(__dirname, "example"), "Clarinet.toml");

describe("getContractFunction", () => {
  it("returns the function interface for a known contract and function", async () => {
    const simnet = await initSimnet(manifestPath);
    const fn = getContractFunction(simnet, "counter", "increment");

    expect(fn.name).toBe("increment");
    expect(fn.access).toBe("public");
  });

  it("returns a function with arguments", async () => {
    const simnet = await initSimnet(manifestPath);
    const fn = getContractFunction(simnet, "counter", "add");

    expect(fn.name).toBe("add");
    expect(fn.args.length).toBe(1);
  });

  it("throws when the contract does not exist", async () => {
    const simnet = await initSimnet(manifestPath);

    expect(() => getContractFunction(simnet, "nonexistent", "foo")).toThrow(
      'Contract "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.nonexistent" not found.',
    );
  });

  it("throws when the function does not exist", async () => {
    const simnet = await initSimnet(manifestPath);

    expect(() => getContractFunction(simnet, "counter", "nonexistent")).toThrow(
      'Function "nonexistent" not found in contract "counter".',
    );
  });

  it("accepts a custom deployer address", async () => {
    const simnet = await initSimnet(manifestPath);

    // Using the actual deployer explicitly should work the same.
    const fn = getContractFunction(
      simnet,
      "counter",
      "increment",
      simnet.deployer,
    );
    expect(fn.name).toBe("increment");
  });
});

describe("strategyFor", () => {
  it("produces ClarityValue arrays for a function with arguments", async () => {
    const simnet = await initSimnet(manifestPath);
    const fn = getContractFunction(simnet, "counter", "add");
    const arb = strategyFor(fn, simnet);

    fc.assert(
      fc.property(arb, (args: ClarityValue[]) => {
        expect(Array.isArray(args)).toBe(true);
        expect(args.length).toBe(fn.args.length);
        args.forEach((arg) => {
          expect(arg).toHaveProperty("type");
        });
      }),
      { numRuns: 10 },
    );
  });

  it("produces an empty array for a function with no arguments", async () => {
    const simnet = await initSimnet(manifestPath);
    const fn = getContractFunction(simnet, "counter", "increment");
    const arb = strategyFor(fn, simnet);

    fc.assert(
      fc.property(arb, (args: ClarityValue[]) => {
        expect(args).toEqual([]);
      }),
      { numRuns: 1 },
    );
  });

  it("produces arguments usable with simnet.callPublicFn", async () => {
    const simnet = await initSimnet(manifestPath);
    const fn = getContractFunction(simnet, "counter", "add");
    const arb = strategyFor(fn, simnet);

    fc.assert(
      fc.property(arb, (args: ClarityValue[]) => {
        // Should not throw — arguments are valid Clarity values.
        const { result } = simnet.callPublicFn(
          `${simnet.deployer}.counter`,
          "add",
          args,
          simnet.deployer,
        );
        expect(result).toBeDefined();
      }),
      { numRuns: 5 },
    );
  });
});
