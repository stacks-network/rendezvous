import fc from "fast-check";
import { reporter } from "./heatstroke";
import { getContractNameFromRendezvousId } from "./invariant";
import { EventEmitter } from "events";
import { resolve } from "path";
import { initSimnet } from "@hirosystems/clarinet-sdk";

describe("Custom reporter logging", () => {
  it("handles cases with missing path on failure for invariant testing type", async () => {
    const manifestPath = resolve(__dirname, "./example/Clarinet.toml");
    const simnet = await initSimnet(manifestPath);

    fc.assert(
      fc.property(
        fc.record({
          failed: fc.constant(true),
          numRuns: fc.nat(),
          seed: fc.nat(),
          contractName: fc.ascii(),
          selectedFunction: fc.record({
            name: fc.ascii(),
            access: fc.ascii(),
            outputs: fc.array(fc.ascii()),
          }),
          functionArgsArb: fc.array(
            fc.oneof(fc.ascii(), fc.nat(), fc.boolean())
          ),
          selectedInvariant: fc.record({
            name: fc.ascii(),
            access: fc.ascii(),
          }),
          invariantArgsArb: fc.array(
            fc.oneof(fc.ascii(), fc.nat(), fc.boolean())
          ),
          errorMessage: fc.ascii(),
          sutCaller: fc.constantFrom(
            ...new Map(
              [...simnet.getAccounts()].filter(([key]) => key !== "faucet")
            ).entries()
          ),
          invariantCaller: fc.constantFrom(
            ...new Map(
              [...simnet.getAccounts()].filter(([key]) => key !== "faucet")
            ).entries()
          ),
        }),
        (r: {
          failed: boolean;
          numRuns: number;
          seed: number;
          contractName: string;
          selectedFunction: {
            name: string;
            access: string;
            outputs: string[];
          };
          functionArgsArb: (string | number | boolean)[];
          selectedInvariant: {
            name: string;
            access: string;
          };
          invariantArgsArb: (string | number | boolean)[];
          errorMessage: string;
          sutCaller: [string, string];
          invariantCaller: [string, string];
        }) => {
          const emittedErrorLogs: string[] = [];
          const radio = new EventEmitter();
          const rendezvousContractId = `ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.${r.contractName}_rendezvous`;

          radio.on("logFailure", (message: string) => {
            emittedErrorLogs.push(message);
          });

          const runDetails = {
            failed: r.failed,
            numRuns: r.numRuns,
            seed: r.seed,
            counterexample: [
              {
                rendezvousContractId: rendezvousContractId,
                selectedFunction: {
                  name: r.selectedFunction.name,
                  access: r.selectedFunction.access,
                  outputs: r.selectedFunction.outputs,
                },
                functionArgsArb: r.functionArgsArb,
                selectedInvariant: {
                  name: r.selectedInvariant.name,
                  access: r.selectedInvariant.access,
                },
                invariantArgsArb: r.invariantArgsArb,
                sutCaller: r.sutCaller,
                invariantCaller: r.invariantCaller,
              },
            ],
            error: new Error(r.errorMessage),
          };

          // Act
          reporter(runDetails, radio, "invariant");

          // Assert
          const expectedMessages = [
            `Error: Property failed after ${r.numRuns} tests.`,
            `Seed : ${r.seed}`,
            `\nCounterexample:`,
            `- Contract : ${getContractNameFromRendezvousId(
              rendezvousContractId
            )}`,
            `- Function : ${r.selectedFunction.name} (${r.selectedFunction.access})`,
            `- Arguments: ${JSON.stringify(r.functionArgsArb)}`,
            `- Caller   : ${r.sutCaller[0]}`,
            `- Outputs  : ${JSON.stringify(r.selectedFunction.outputs)}`,
            `- Invariant: ${r.selectedInvariant.name} (${r.selectedInvariant.access})`,
            `- Arguments: ${JSON.stringify(r.invariantArgsArb)}`,
            `- Caller   : ${r.invariantCaller[0]}`,
            `\nWhat happened? Rendezvous went on a rampage and found a weak spot:\n`,
            `The invariant "${
              r.selectedInvariant.name
            }" returned:\n\n${runDetails.error
              ?.toString()
              .split("\n")
              .map((line) => "    " + line)
              .join("\n")}\n`,
          ];

          expect(emittedErrorLogs).toEqual(expectedMessages);
        }
      ),
      { numRuns: 10 }
    );
  });

  it("handles cases with a specified path on failure for invariant testing type", async () => {
    const manifestPath = resolve(__dirname, "./example/Clarinet.toml");
    const simnet = await initSimnet(manifestPath);

    fc.assert(
      fc.property(
        fc.record({
          path: fc.ascii(),
          failed: fc.constant(true),
          numRuns: fc.nat(),
          seed: fc.nat(),
          contractName: fc.ascii(),
          selectedFunction: fc.record({
            name: fc.ascii(),
            access: fc.ascii(),
            outputs: fc.array(fc.ascii()),
          }),
          functionArgsArb: fc.array(
            fc.oneof(fc.ascii(), fc.nat(), fc.boolean())
          ),
          selectedInvariant: fc.record({
            name: fc.ascii(),
            access: fc.ascii(),
          }),
          invariantArgsArb: fc.array(
            fc.oneof(fc.ascii(), fc.nat(), fc.boolean())
          ),
          errorMessage: fc.ascii(),
          sutCaller: fc.constantFrom(
            ...new Map(
              [...simnet.getAccounts()].filter(([key]) => key !== "faucet")
            ).entries()
          ),
          invariantCaller: fc.constantFrom(
            ...new Map(
              [...simnet.getAccounts()].filter(([key]) => key !== "faucet")
            ).entries()
          ),
        }),
        (r: {
          path: string;
          failed: boolean;
          numRuns: number;
          seed: number;
          contractName: string;
          selectedFunction: {
            name: string;
            access: string;
            outputs: string[];
          };
          functionArgsArb: (string | number | boolean)[];
          selectedInvariant: {
            name: string;
            access: string;
          };
          invariantArgsArb: (string | number | boolean)[];
          errorMessage: string;
          sutCaller: [string, string];
          invariantCaller: [string, string];
        }) => {
          const emittedErrorLogs: string[] = [];
          const radio = new EventEmitter();
          const rendezvousContractId = `ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.${r.contractName}_rendezvous`;

          radio.on("logFailure", (message: string) => {
            emittedErrorLogs.push(message);
          });

          const runDetails = {
            path: r.path,
            failed: r.failed,
            numRuns: r.numRuns,
            seed: r.seed,
            counterexample: [
              {
                rendezvousContractId: rendezvousContractId,
                selectedFunction: {
                  name: r.selectedFunction.name,
                  access: r.selectedFunction.access,
                  outputs: r.selectedFunction.outputs,
                },
                functionArgsArb: r.functionArgsArb,
                selectedInvariant: {
                  name: r.selectedInvariant.name,
                  access: r.selectedInvariant.access,
                },
                invariantArgsArb: r.invariantArgsArb,
                sutCaller: r.sutCaller,
                invariantCaller: r.invariantCaller,
              },
            ],
            error: new Error(r.errorMessage),
          };

          // Act
          reporter(runDetails, radio, "invariant");

          // Assert
          const expectedMessages = [
            `Error: Property failed after ${r.numRuns} tests.`,
            `Seed : ${r.seed}`,
            `Path : ${r.path}`,
            `\nCounterexample:`,
            `- Contract : ${getContractNameFromRendezvousId(
              rendezvousContractId
            )}`,
            `- Function : ${r.selectedFunction.name} (${r.selectedFunction.access})`,
            `- Arguments: ${JSON.stringify(r.functionArgsArb)}`,
            `- Caller   : ${r.sutCaller[0]}`,
            `- Outputs  : ${JSON.stringify(r.selectedFunction.outputs)}`,
            `- Invariant: ${r.selectedInvariant.name} (${r.selectedInvariant.access})`,
            `- Arguments: ${JSON.stringify(r.invariantArgsArb)}`,
            `- Caller   : ${r.invariantCaller[0]}`,
            `\nWhat happened? Rendezvous went on a rampage and found a weak spot:\n`,
            `The invariant "${
              r.selectedInvariant.name
            }" returned:\n\n${runDetails.error
              ?.toString()
              .split("\n")
              .map((line) => "    " + line)
              .join("\n")}\n`,
          ];

          expect(emittedErrorLogs).toEqual(expectedMessages);
          radio.removeAllListeners();
        }
      ),
      { numRuns: 10 }
    );
  });

  it("does not log anything on success for invariant testing type", async () => {
    const manifestPath = resolve(__dirname, "./example/Clarinet.toml");
    const simnet = await initSimnet(manifestPath);

    fc.assert(
      fc.property(
        fc.record({
          path: fc.ascii(),
          failed: fc.constant(false),
          numRuns: fc.nat(),
          seed: fc.nat(),
          contractName: fc.ascii(),
          selectedFunction: fc.record({
            name: fc.ascii(),
            access: fc.ascii(),
            outputs: fc.array(fc.ascii()),
          }),
          functionArgsArb: fc.array(
            fc.oneof(fc.ascii(), fc.nat(), fc.boolean())
          ),
          selectedInvariant: fc.record({
            name: fc.ascii(),
            access: fc.ascii(),
          }),
          invariantArgsArb: fc.array(
            fc.oneof(fc.ascii(), fc.nat(), fc.boolean())
          ),
          errorMessage: fc.ascii(),
          sutCaller: fc.constantFrom(
            ...new Map(
              [...simnet.getAccounts()].filter(([key]) => key !== "faucet")
            ).entries()
          ),
          invariantCaller: fc.constantFrom(
            ...new Map(
              [...simnet.getAccounts()].filter(([key]) => key !== "faucet")
            ).entries()
          ),
        }),
        (r: {
          path: string;
          failed: boolean;
          numRuns: number;
          seed: number;
          contractName: string;
          selectedFunction: {
            name: string;
            access: string;
            outputs: string[];
          };
          functionArgsArb: (string | number | boolean)[];
          selectedInvariant: {
            name: string;
            access: string;
          };
          invariantArgsArb: (string | number | boolean)[];
          errorMessage: string;
          sutCaller: [string, string];
          invariantCaller: [string, string];
        }) => {
          const emittedErrorLogs: string[] = [];
          const radio = new EventEmitter();
          const rendezvousContractId = `ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.${r.contractName}_rendezvous`;

          radio.on("logFailure", (message: string) => {
            emittedErrorLogs.push(message);
          });

          const runDetails = {
            path: r.path,
            failed: r.failed,
            numRuns: r.numRuns,
            seed: r.seed,
            counterexample: [
              {
                rendezvousContractId: rendezvousContractId,
                selectedFunction: {
                  name: r.selectedFunction.name,
                  access: r.selectedFunction.access,
                  outputs: r.selectedFunction.outputs,
                },
                functionArgsArb: r.functionArgsArb,
                selectedInvariant: {
                  name: r.selectedInvariant.name,
                  access: r.selectedInvariant.access,
                },
                invariantArgsArb: r.invariantArgsArb,
                sutCaller: r.sutCaller,
                invariantCaller: r.invariantCaller,
              },
            ],
            error: new Error(r.errorMessage),
          };

          // Act
          reporter(runDetails, radio, "invariant");

          // Assert
          expect(emittedErrorLogs).toEqual([]);
          radio.removeAllListeners();
        }
      ),
      { numRuns: 10 }
    );
  });

  it("handles cases with missing path on failure for property testing type", async () => {
    const manifestPath = resolve(__dirname, "./example/Clarinet.toml");
    const simnet = await initSimnet(manifestPath);

    fc.assert(
      fc.property(
        fc.record({
          failed: fc.constant(true),
          numRuns: fc.nat(),
          seed: fc.nat(),
          contractName: fc.ascii(),
          selectedTestFunction: fc.record({
            name: fc.ascii(),
            access: fc.ascii(),
            outputs: fc.array(fc.ascii()),
          }),
          functionArgsArb: fc.array(
            fc.oneof(fc.ascii(), fc.nat(), fc.boolean())
          ),
          errorMessage: fc.ascii(),
          testCaller: fc.constantFrom(
            ...new Map(
              [...simnet.getAccounts()].filter(([key]) => key !== "faucet")
            ).entries()
          ),
        }),
        (r: {
          failed: boolean;
          numRuns: number;
          seed: number;
          contractName: string;
          selectedTestFunction: {
            name: string;
            access: string;
            outputs: string[];
          };
          functionArgsArb: (string | number | boolean)[];
          errorMessage: string;
          testCaller: [string, string];
        }) => {
          const emittedErrorLogs: string[] = [];
          const radio = new EventEmitter();
          const testContractId = `ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.${r.contractName}_tests`;

          radio.on("logFailure", (message: string) => {
            emittedErrorLogs.push(message);
          });

          const runDetails = {
            failed: r.failed,
            numRuns: r.numRuns,
            seed: r.seed,
            counterexample: [
              {
                testContractId: testContractId,
                selectedTestFunction: {
                  name: r.selectedTestFunction.name,
                  access: r.selectedTestFunction.access,
                  outputs: r.selectedTestFunction.outputs,
                },
                functionArgsArb: r.functionArgsArb,
                testCaller: r.testCaller,
              },
            ],
            error: new Error(r.errorMessage),
          };

          // Act
          reporter(runDetails, radio, "test");

          // Assert
          const expectedMessages = [
            `Error: Property failed after ${r.numRuns} tests.`,
            `Seed : ${r.seed}`,
            `\nCounterexample:`,
            `- Test Contract : ${testContractId.split(".")[1]}`,
            `- Test Function : ${r.selectedTestFunction.name} (${r.selectedTestFunction.access})`,
            `- Arguments     : ${JSON.stringify(r.functionArgsArb)}`,
            `- Caller        : ${r.testCaller[0]}`,
            `- Outputs       : ${JSON.stringify(
              r.selectedTestFunction.outputs
            )}`,
            `\nWhat happened? Rendezvous went on a rampage and found a weak spot:\n`,
            `The test function "${
              r.selectedTestFunction.name
            }" returned:\n\n${runDetails.error
              ?.toString()
              .split("\n")
              .map((line) => "    " + line)
              .join("\n")}\n`,
          ];

          expect(emittedErrorLogs).toEqual(expectedMessages);
        }
      ),
      { numRuns: 10 }
    );
  });

  it("handles cases with a specified path on failure for property testing type", async () => {
    const manifestPath = resolve(__dirname, "./example/Clarinet.toml");
    const simnet = await initSimnet(manifestPath);

    fc.assert(
      fc.property(
        fc.record({
          path: fc.ascii(),
          failed: fc.constant(true),
          numRuns: fc.nat(),
          seed: fc.nat(),
          contractName: fc.ascii(),
          selectedTestFunction: fc.record({
            name: fc.ascii(),
            access: fc.ascii(),
            outputs: fc.array(fc.ascii()),
          }),
          functionArgsArb: fc.array(
            fc.oneof(fc.ascii(), fc.nat(), fc.boolean())
          ),
          errorMessage: fc.ascii(),
          testCaller: fc.constantFrom(
            ...new Map(
              [...simnet.getAccounts()].filter(([key]) => key !== "faucet")
            ).entries()
          ),
        }),
        (r: {
          path: string;
          failed: boolean;
          numRuns: number;
          seed: number;
          contractName: string;
          selectedTestFunction: {
            name: string;
            access: string;
            outputs: string[];
          };
          functionArgsArb: (string | number | boolean)[];
          errorMessage: string;
          testCaller: [string, string];
        }) => {
          const emittedErrorLogs: string[] = [];
          const radio = new EventEmitter();
          const testContractId = `ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.${r.contractName}_tests`;

          radio.on("logFailure", (message: string) => {
            emittedErrorLogs.push(message);
          });

          const runDetails = {
            path: r.path,
            failed: r.failed,
            numRuns: r.numRuns,
            seed: r.seed,
            counterexample: [
              {
                testContractId: testContractId,
                selectedTestFunction: {
                  name: r.selectedTestFunction.name,
                  access: r.selectedTestFunction.access,
                  outputs: r.selectedTestFunction.outputs,
                },
                functionArgsArb: r.functionArgsArb,
                testCaller: r.testCaller,
              },
            ],
            error: new Error(r.errorMessage),
          };

          // Act
          reporter(runDetails, radio, "test");

          // Assert
          const expectedMessages = [
            `Error: Property failed after ${r.numRuns} tests.`,
            `Seed : ${r.seed}`,
            `Path : ${r.path}`,
            `\nCounterexample:`,
            `- Test Contract : ${testContractId.split(".")[1]}`,
            `- Test Function : ${r.selectedTestFunction.name} (${r.selectedTestFunction.access})`,
            `- Arguments     : ${JSON.stringify(r.functionArgsArb)}`,
            `- Caller        : ${r.testCaller[0]}`,
            `- Outputs       : ${JSON.stringify(
              r.selectedTestFunction.outputs
            )}`,
            `\nWhat happened? Rendezvous went on a rampage and found a weak spot:\n`,
            `The test function "${
              r.selectedTestFunction.name
            }" returned:\n\n${runDetails.error
              ?.toString()
              .split("\n")
              .map((line) => "    " + line)
              .join("\n")}\n`,
          ];

          expect(emittedErrorLogs).toEqual(expectedMessages);
        }
      ),
      { numRuns: 10 }
    );
  });

  it("does not log anything on success for property testing type", async () => {
    const manifestPath = resolve(__dirname, "./example/Clarinet.toml");
    const simnet = await initSimnet(manifestPath);

    fc.assert(
      fc.property(
        fc.record({
          failed: fc.constant(false),
          numRuns: fc.nat(),
          seed: fc.nat(),
          contractName: fc.ascii(),
          selectedTestFunction: fc.record({
            name: fc.ascii(),
            access: fc.ascii(),
            outputs: fc.array(fc.ascii()),
          }),
          functionArgsArb: fc.array(
            fc.oneof(fc.ascii(), fc.nat(), fc.boolean())
          ),
          errorMessage: fc.ascii(),
          testCaller: fc.constantFrom(
            ...new Map(
              [...simnet.getAccounts()].filter(([key]) => key !== "faucet")
            ).entries()
          ),
        }),
        (r: {
          failed: boolean;
          numRuns: number;
          seed: number;
          contractName: string;
          selectedTestFunction: {
            name: string;
            access: string;
            outputs: string[];
          };
          functionArgsArb: (string | number | boolean)[];
          errorMessage: string;
          testCaller: [string, string];
        }) => {
          const emittedErrorLogs: string[] = [];
          const radio = new EventEmitter();
          const testContractId = `ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.${r.contractName}_tests`;

          radio.on("logFailure", (message: string) => {
            emittedErrorLogs.push(message);
          });

          const runDetails = {
            failed: r.failed,
            numRuns: r.numRuns,
            seed: r.seed,
            counterexample: [
              {
                testContractId: testContractId,
                selectedTestFunction: {
                  name: r.selectedTestFunction.name,
                  access: r.selectedTestFunction.access,
                  outputs: r.selectedTestFunction.outputs,
                },
                functionArgsArb: r.functionArgsArb,
                testCaller: r.testCaller,
              },
            ],
            error: new Error(r.errorMessage),
          };

          // Act
          reporter(runDetails, radio, "test");

          // Assert

          expect(emittedErrorLogs).toEqual([]);
        }
      ),
      { numRuns: 10 }
    );
  });
});
