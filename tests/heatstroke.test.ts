import fc from "fast-check";
import { reporter } from "../heatstroke";
import { getContractNameFromRendezvousName } from "../app";
import { EventEmitter } from "events";

describe("Custom reporter logging", () => {
  it("handles cases with missing path on failure", () => {
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
              },
            ],
            error: new Error(r.errorMessage),
          };

          // Act
          reporter(runDetails, radio);

          // Assert
          const expectedMessages = [
            `Error: Property failed after ${r.numRuns} tests.`,
            `Seed : ${r.seed}`,
            `\nCounterexample:`,
            `- Contract : ${getContractNameFromRendezvousName(
              rendezvousContractId
            )}`,
            `- Function : ${r.selectedFunction.name} (${r.selectedFunction.access})`,
            `- Arguments: ${JSON.stringify(r.functionArgsArb)}`,
            `- Outputs  : ${JSON.stringify(r.selectedFunction.outputs)}`,
            `- Invariant: ${r.selectedInvariant.name} (${r.selectedInvariant.access})`,
            `- Arguments: ${JSON.stringify(r.invariantArgsArb)}`,
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

  it("handles cases with a specified path on failure", () => {
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
              },
            ],
            error: new Error(r.errorMessage),
          };

          // Act
          reporter(runDetails, radio);

          // Assert
          const expectedMessages = [
            `Error: Property failed after ${r.numRuns} tests.`,
            `Seed : ${r.seed}`,
            `Path : ${r.path}`,
            `\nCounterexample:`,
            `- Contract : ${getContractNameFromRendezvousName(
              rendezvousContractId
            )}`,
            `- Function : ${r.selectedFunction.name} (${r.selectedFunction.access})`,
            `- Arguments: ${JSON.stringify(r.functionArgsArb)}`,
            `- Outputs  : ${JSON.stringify(r.selectedFunction.outputs)}`,
            `- Invariant: ${r.selectedInvariant.name} (${r.selectedInvariant.access})`,
            `- Arguments: ${JSON.stringify(r.invariantArgsArb)}`,
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

  it("does not log anything on success", () => {
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
              },
            ],
            error: new Error(r.errorMessage),
          };

          // Act
          reporter(runDetails, radio);

          // Assert
          expect(emittedErrorLogs).toEqual([]);
          radio.removeAllListeners();
        }
      ),
      { numRuns: 10 }
    );
  });
});
