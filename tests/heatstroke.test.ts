import fc from "fast-check";
import { reporter } from "../heatstroke";

describe("Custom reporter logging", () => {
  it("handles cases with missing path on failure", () => {
    try {
      fc.assert(
        fc.property(
          fc.record({
            failed: fc.constant(true),
            numRuns: fc.nat(),
            seed: fc.nat(),
            rendezvousContractId: fc.ascii(),
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
            rendezvousContractId: string;
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
            const consoleErrorLogs: string[] = [];

            jest
              .spyOn(console, "error")
              .mockImplementation((message: string) => {
                consoleErrorLogs.push(message);
              });

            const runDetails = {
              failed: r.failed,
              numRuns: r.numRuns,
              seed: r.seed,
              counterexample: [
                {
                  rendezvousContractId: r.rendezvousContractId,
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
            reporter(runDetails);

            // Assert
            const expectedMessages = [
              `Error: Property failed after ${r.numRuns} tests.`,
              `Seed : ${r.seed}`,
              `\nCounterexample:`,
              `- Contract : ${r.rendezvousContractId}`,
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

            expect(consoleErrorLogs).toEqual(expectedMessages);
          }
        ),
        { numRuns: 10 }
      );
    } finally {
      jest.restoreAllMocks();
    }
  });

  it("handles cases with a specified path on failure", () => {
    try {
      fc.assert(
        fc.property(
          fc.record({
            path: fc.ascii(),
            failed: fc.constant(true),
            numRuns: fc.nat(),
            seed: fc.nat(),
            rendezvousContractId: fc.ascii(),
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
            rendezvousContractId: string;
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
            const consoleErrorLogs: string[] = [];

            jest
              .spyOn(console, "error")
              .mockImplementation((message: string) => {
                consoleErrorLogs.push(message);
              });

            const runDetails = {
              path: r.path,
              failed: r.failed,
              numRuns: r.numRuns,
              seed: r.seed,
              counterexample: [
                {
                  rendezvousContractId: r.rendezvousContractId,
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
            reporter(runDetails);

            // Assert
            const expectedMessages = [
              `Error: Property failed after ${r.numRuns} tests.`,
              `Seed : ${r.seed}`,
              `Path : ${r.path}`,
              `\nCounterexample:`,
              `- Contract : ${r.rendezvousContractId}`,
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

            expect(consoleErrorLogs).toEqual(expectedMessages);
          }
        ),
        { numRuns: 10 }
      );
    } finally {
      jest.restoreAllMocks();
    }
  });

  it("does not log anything on success", () => {
    try {
      fc.assert(
        fc.property(
          fc.record({
            path: fc.ascii(),
            failed: fc.constant(false),
            numRuns: fc.nat(),
            seed: fc.nat(),
            rendezvousContractId: fc.ascii(),
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
            rendezvousContractId: string;
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
            const consoleErrorLogs: string[] = [];

            jest
              .spyOn(console, "error")
              .mockImplementation((message: string) => {
                consoleErrorLogs.push(message);
              });

            const runDetails = {
              path: r.path,
              failed: r.failed,
              numRuns: r.numRuns,
              seed: r.seed,
              counterexample: [
                {
                  rendezvousContractId: r.rendezvousContractId,
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
            reporter(runDetails);

            // Assert
            expect(consoleErrorLogs).toEqual([]);
          }
        ),
        { numRuns: 10 }
      );
    } finally {
      jest.restoreAllMocks();
    }
  });
});
