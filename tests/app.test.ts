import { initSimnet, Simnet } from "@hirosystems/clarinet-sdk";
import {
  contexatenate,
  getSimnetDeployerContractsInterfaces,
  main,
} from "../app";
import fc from "fast-check";
import path from "path";

describe("Manifest handling", () => {
  it("throws error when manifest path is not provided", () => {
    expect(async () => await main()).rejects.toThrow(
      "No path to Clarinet.toml manifest provided. Supply it immediately or face the relentless scrutiny of your contract's vulnerabilities."
    );
  });
});

describe("Contract concatenation", () => {
  const context = `(define-map context (string-ascii 100) {
    called: uint
    ;; other data
  })

  (define-public (update-context (function-name (string-ascii 100)) (called uint))
    (ok (map-set context function-name {called: called})))`;

  it("adds context between contract and invariants", () => {
    fc.assert(
      // Arrange
      fc.property(fc.string(), fc.string(), (contract, invariants) => {
        // Act
        const actual = contexatenate(contract, invariants);
        // Assert
        const expected = `${contract}\n\n${context}\n\n${invariants}`;
        expect(actual).toBe(expected);
      })
    );
  });
});

describe("Simnet contracts operations", () => {
  let simnet: Simnet;
  const manifestPath = path.resolve(__dirname, "Clarinet.toml");

  beforeEach(async () => {
    simnet = await initSimnet(manifestPath);
  });
  it("retrieves the contracts from the simnet", async () => {
    // Arrange
    const expectedDeployerContracts = new Map(
      Array.from(simnet.getContractsInterfaces()).filter(
        ([key]) => key.split(".")[0] === simnet.deployer
      )
    );

    // Act
    const actualDeployerContracts =
      getSimnetDeployerContractsInterfaces(simnet);

    // Assert
    expect(actualDeployerContracts).toEqual(expectedDeployerContracts);
  });
});
