import { EventEmitter } from "events";
import { resolve } from "path";
import { initSimnet } from "@hirosystems/clarinet-sdk";
import { ContractInterfaceFunction } from "@hirosystems/clarinet-sdk-wasm";
import fc from "fast-check";
import { reporter } from "./heatstroke";
import { getContractNameFromContractId } from "./shared";

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
          selectedFunctions: fc.array(
            fc.record({
              name: fc.ascii(),
              access: fc.ascii(),
              outputs: fc.array(fc.ascii()),
              args: fc.anything(),
            })
          ),
          selectedFunctionsArgsList: fc.tuple(
            fc.array(fc.oneof(fc.ascii(), fc.nat(), fc.boolean()))
          ),
          selectedInvariant: fc.record({
            name: fc.ascii(),
            access: fc.ascii(),
            outputs: fc.array(fc.ascii()),
            args: fc.anything(),
          }),
          invariantArgs: fc.array(fc.oneof(fc.ascii(), fc.nat(), fc.boolean())),
          errorMessage: fc.ascii(),
          sutCallers: fc.array(
            fc.constantFrom(
              ...new Map(
                [...simnet.getAccounts()].filter(([key]) => key !== "faucet")
              ).entries()
            )
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
          selectedFunctions: {
            name: string;
            access: string;
            outputs: string[];
            args: any;
          }[];
          selectedFunctionsArgsList: (string | number | boolean)[][];
          selectedInvariant: {
            name: string;
            access: string;
            outputs: string[];
            args: any;
          };
          invariantArgs: (string | number | boolean)[];
          errorMessage: string;
          sutCallers: [string, string][];
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
                selectedFunctions:
                  r.selectedFunctions as any as ContractInterfaceFunction[],
                selectedFunctionsArgsList: r.selectedFunctionsArgsList,
                selectedInvariant:
                  r.selectedInvariant as any as ContractInterfaceFunction,
                invariantArgs: r.invariantArgs,
                sutCallers: r.sutCallers,
                invariantCaller: r.invariantCaller,
              },
            ],
            error: new Error(r.errorMessage),
          };

          // Act
          reporter(runDetails, radio, "invariant");

          // Assert
          const expectedMessages = [
            `\nError: Property failed after ${r.numRuns} tests.`,
            `Seed : ${r.seed}`,
            `\nCounterexample:`,
            `- Contract : ${getContractNameFromContractId(
              rendezvousContractId
            )}`,
            `- Functions: ${r.selectedFunctions
              .map((selectedFunction) => selectedFunction.name)
              .join(", ")} (${r.selectedFunctions
              .map((selectedFunction) => selectedFunction.access)
              .join(", ")})`,
            `- Arguments: ${r.selectedFunctionsArgsList
              .map((selectedFunctionArgs) =>
                JSON.stringify(selectedFunctionArgs)
              )
              .join(", ")}`,
            `- Callers  : ${r.sutCallers
              .map((sutCaller) => sutCaller[0])
              .join(", ")}`,
            `- Outputs  : ${r.selectedFunctions
              .map((selectedFunction) =>
                JSON.stringify(selectedFunction.outputs)
              )
              .join(", ")}`,
            `- Invariant: ${r.selectedInvariant.name} (${r.selectedInvariant.access})`,
            `- Arguments: ${JSON.stringify(r.invariantArgs)}`,
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
          selectedFunctions: fc.array(
            fc.record({
              name: fc.ascii(),
              access: fc.ascii(),
              outputs: fc.array(fc.ascii()),
              args: fc.anything(),
            })
          ),
          selectedFunctionsArgsList: fc.tuple(
            fc.array(fc.oneof(fc.ascii(), fc.nat(), fc.boolean()))
          ),
          selectedInvariant: fc.record({
            name: fc.ascii(),
            access: fc.ascii(),
            outputs: fc.array(fc.ascii()),
            args: fc.anything(),
          }),
          invariantArgs: fc.array(fc.oneof(fc.ascii(), fc.nat(), fc.boolean())),
          errorMessage: fc.ascii(),
          sutCallers: fc.array(
            fc.constantFrom(
              ...new Map(
                [...simnet.getAccounts()].filter(([key]) => key !== "faucet")
              ).entries()
            )
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
          selectedFunctions: {
            name: string;
            access: string;
            outputs: string[];
            args: any;
          }[];
          selectedFunctionsArgsList: (string | number | boolean)[][];
          selectedInvariant: {
            name: string;
            access: string;
            outputs: string[];
            args: any;
          };
          invariantArgs: (string | number | boolean)[];
          errorMessage: string;
          sutCallers: [string, string][];
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
                selectedFunctions:
                  r.selectedFunctions as any as ContractInterfaceFunction[],
                selectedFunctionsArgsList: r.selectedFunctionsArgsList,
                selectedInvariant:
                  r.selectedInvariant as any as ContractInterfaceFunction,
                invariantArgs: r.invariantArgs,
                sutCallers: r.sutCallers,
                invariantCaller: r.invariantCaller,
              },
            ],
            error: new Error(r.errorMessage),
          };

          // Act
          reporter(runDetails, radio, "invariant");

          // Assert
          const expectedMessages = [
            `\nError: Property failed after ${r.numRuns} tests.`,
            `Seed : ${r.seed}`,
            `Path : ${r.path}`,
            `\nCounterexample:`,
            `- Contract : ${getContractNameFromContractId(
              rendezvousContractId
            )}`,
            `- Functions: ${r.selectedFunctions
              .map((selectedFunction) => selectedFunction.name)
              .join(", ")} (${r.selectedFunctions
              .map((selectedFunction) => selectedFunction.access)
              .join(", ")})`,
            `- Arguments: ${r.selectedFunctionsArgsList
              .map((selectedFunctionArgs) =>
                JSON.stringify(selectedFunctionArgs)
              )
              .join(", ")}`,
            `- Callers  : ${r.sutCallers
              .map((sutCaller) => sutCaller[0])
              .join(", ")}`,
            `- Outputs  : ${r.selectedFunctions
              .map((selectedFunction) =>
                JSON.stringify(selectedFunction.outputs)
              )
              .join(", ")}`,
            `- Invariant: ${r.selectedInvariant.name} (${r.selectedInvariant.access})`,
            `- Arguments: ${JSON.stringify(r.invariantArgs)}`,
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
          selectedFunctions: fc.array(
            fc.record({
              name: fc.ascii(),
              access: fc.ascii(),
              outputs: fc.array(fc.ascii()),
              args: fc.anything(),
            })
          ),
          selectedFunctionsArgsList: fc.tuple(
            fc.array(fc.oneof(fc.ascii(), fc.nat(), fc.boolean()))
          ),
          selectedInvariant: fc.record({
            name: fc.ascii(),
            access: fc.ascii(),
            outputs: fc.array(fc.ascii()),
            args: fc.anything(),
          }),
          invariantArgs: fc.array(fc.oneof(fc.ascii(), fc.nat(), fc.boolean())),
          errorMessage: fc.ascii(),
          sutCallers: fc.array(
            fc.constantFrom(
              ...new Map(
                [...simnet.getAccounts()].filter(([key]) => key !== "faucet")
              ).entries()
            )
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
          selectedFunctions: {
            name: string;
            access: string;
            outputs: string[];
            args: any;
          }[];
          selectedFunctionsArgsList: (string | number | boolean)[][];
          selectedInvariant: {
            name: string;
            access: string;
            args: any;
            outputs: string[];
          };
          invariantArgs: (string | number | boolean)[];
          errorMessage: string;
          sutCallers: [string, string][];
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
                selectedFunctions:
                  r.selectedFunctions as any as ContractInterfaceFunction[],
                selectedFunctionsArgsList: r.selectedFunctionsArgsList,
                selectedInvariant:
                  r.selectedInvariant as any as ContractInterfaceFunction,
                invariantArgs: r.invariantArgs,
                sutCallers: r.sutCallers,
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
            args: fc.anything(),
          }),
          functionArgs: fc.array(fc.oneof(fc.ascii(), fc.nat(), fc.boolean())),
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
            args: any;
          };
          functionArgs: (string | number | boolean)[];
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
                selectedTestFunction:
                  r.selectedTestFunction as any as ContractInterfaceFunction,
                functionArgs: r.functionArgs,
                testCaller: r.testCaller,
              },
            ],
            error: new Error(r.errorMessage),
          };

          // Act
          reporter(runDetails, radio, "test");

          // Assert
          const expectedMessages = [
            `\nError: Property failed after ${r.numRuns} tests.`,
            `Seed : ${r.seed}`,
            `\nCounterexample:`,
            `- Test Contract : ${getContractNameFromContractId(
              testContractId
            )}`,
            `- Test Function : ${r.selectedTestFunction.name} (${r.selectedTestFunction.access})`,
            `- Arguments     : ${JSON.stringify(r.functionArgs)}`,
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
            args: fc.anything(),
          }),
          functionArgs: fc.array(fc.oneof(fc.ascii(), fc.nat(), fc.boolean())),
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
            args: any;
          };
          functionArgs: (string | number | boolean)[];
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
                selectedTestFunction:
                  r.selectedTestFunction as any as ContractInterfaceFunction,
                functionArgs: r.functionArgs,
                testCaller: r.testCaller,
              },
            ],
            error: new Error(r.errorMessage),
          };

          // Act
          reporter(runDetails, radio, "test");

          // Assert
          const expectedMessages = [
            `\nError: Property failed after ${r.numRuns} tests.`,
            `Seed : ${r.seed}`,
            `Path : ${r.path}`,
            `\nCounterexample:`,
            `- Test Contract : ${getContractNameFromContractId(
              testContractId
            )}`,
            `- Test Function : ${r.selectedTestFunction.name} (${r.selectedTestFunction.access})`,
            `- Arguments     : ${JSON.stringify(r.functionArgs)}`,
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
            args: fc.anything(),
          }),
          functionArgs: fc.array(fc.oneof(fc.ascii(), fc.nat(), fc.boolean())),
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
            args: any;
          };
          functionArgs: (string | number | boolean)[];
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
                selectedTestFunction:
                  r.selectedTestFunction as any as ContractInterfaceFunction,
                functionArgs: r.functionArgs,
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
