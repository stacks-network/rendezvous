import { initSimnet } from "@hirosystems/clarinet-sdk";
import {
  scheduleRendezvous,
  deployRendezvous,
  filterRendezvousInterfaces,
  buildRendezvousData,
  deriveRendezvousName,
  getContractNameFromRendezvousName,
  getFunctionsFromContractInterfaces,
  getFunctionsListForContract,
  getInvariantContractSource,
  getSimnetContractSource,
  getSimnetDeployerContractsInterfaces,
  initializeClarityContext,
  initializeLocalContext,
  main,
} from "../app";
import fc from "fast-check";
import fs from "fs";
import { resolve } from "path";
import { Cl } from "@stacks/transactions";

describe("Command-line arguments handling", () => {
  const initialArgv = process.argv;
  const helpMessage = `
  Usage: ./rv <path-to-clarinet-project> <contract-name> [--strategy=<strategy>] [--seed=<seed>] [--path=<path>]
  
  Positional arguments:
    path-to-clarinet-project - The path to the Clarinet project.
    contract-name - The name of the contract to be fuzzed.
  
  Options:
    --seed - The seed to use for the replay functionality.
    --path - The path to use for the replay functionality.
    --strategy - The strategy to use for the testing. Possible values: test, invariant. Default: invariant.
    --help - Show the help message.
  `;
  const noManifestMessage = `\nNo path to Clarinet project provided. Supply it immediately or face the relentless scrutiny of your contract's vulnerabilities.`;
  const noContractNameMessage = `\nNo target contract name provided. Please provide the contract name to be fuzzed.`;

  it.each([
    ["manifest path", ["node", "app.js"]],
    ["target contract name", ["node", "app.js", "./path/to/clarinet/project"]],
    ["--help flag", ["node", "app.js", "--help"]],
  ])(
    "returns undefined when %s is not provided",
    async (_testCase: string, argv: string[]) => {
      process.argv = argv;
      expect(await main()).toBeUndefined();
      process.argv = initialArgv;
    }
  );

  it("logs the help message at the end when --help is specified", async () => {
    // Arrange
    process.argv = ["node", "app.js", "--help"];

    const consoleLogs: string[] = [];
    jest.spyOn(console, "log").mockImplementation((message: string) => {
      consoleLogs.push(message);
    });

    // Act
    await main();

    const actual = consoleLogs[consoleLogs.length - 1];

    // Assert
    const expected = helpMessage;
    expect(actual).toBe(expected);

    process.argv = initialArgv;
    jest.restoreAllMocks();
  });

  it.each([
    ["manifest path", ["node", "app.js"], noManifestMessage],
    [
      "target contract name",
      ["node", "app.js", "./path/to/clarinet/project"],
      noContractNameMessage,
    ],
  ])(
    "logs the info and the help message when the %s is not provided",
    async (_testCase: string, argv: string[], expected: string) => {
      // Arrange
      process.argv = argv;
      const consoleLogs: string[] = [];
      jest.spyOn(console, "log").mockImplementation((message: string) => {
        consoleLogs.push(message);
      });

      // Act
      await main();

      const actualLastLog = consoleLogs[consoleLogs.length - 1];
      const actualSecondToLastLog = consoleLogs[consoleLogs.length - 2];

      // Assert
      const expectedLastLog = helpMessage;

      expect(actualLastLog).toBe(expectedLastLog);
      expect(actualSecondToLastLog).toBe(expected);

      process.argv = initialArgv;
      jest.restoreAllMocks();
    }
  );

  it.each([
    [
      ["manifest path", "contract name"],
      ["node", "app.js", "example", "counter"],
      [
        `Using manifest path: example/Clarinet.toml`,
        `Target contract: counter`,
      ],
    ],
    [
      ["manifest path", "contract name", "seed"],
      ["node", "app.js", "example", "counter", "--seed=123"],
      [
        `Using manifest path: example/Clarinet.toml`,
        `Target contract: counter`,
        `Using seed: 123`,
      ],
    ],
    [
      ["manifest path", "contract name", "seed", "path"],
      ["node", "app.js", "example", "counter", "--seed=123", "--path=84:0"],
      [
        `Using manifest path: example/Clarinet.toml`,
        `Target contract: counter`,
        `Using seed: 123`,
        `Using path: 84:0`,
      ],
    ],
    [
      ["manifest path", "contract name", "path"],
      ["node", "app.js", "example", "counter", "--path=84:0"],
      [
        `Using manifest path: example/Clarinet.toml`,
        `Target contract: counter`,
        `Using path: 84:0`,
      ],
    ],
  ])(
    "logs the correct values when arguments %p are provided",
    async (_testCase: string[], argv: string[], expectedLogs: string[]) => {
      // Arrange
      process.argv = argv;
      const consoleLogs: string[] = [];
      jest.spyOn(console, "log").mockImplementation((message: string) => {
        consoleLogs.push(message);
      });
      jest.spyOn(console, "error").mockImplementation(() => {});

      // Act
      try {
        await main();
      } catch {
        // Do nothing.
      }

      // Assert
      expectedLogs.forEach((expectedLog) => {
        expect(consoleLogs).toContain(expectedLog);
      });

      process.argv = initialArgv;
      jest.restoreAllMocks();
    }
  );
});

describe("Successfully schedules rendez-vous", () => {
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
        const actual = scheduleRendezvous(contract, invariants);
        // Assert
        const expected = `${contract}\n\n${context}\n\n${invariants}`;
        expect(actual).toBe(expected);
      })
    );
  });

  it("generates Rendezvous contract name", () => {
    const addressCharset = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const contractNameCharset =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    fc.assert(
      // Arrange
      fc.property(
        fc.stringOf(fc.constantFrom(...addressCharset)),
        fc.stringOf(fc.constantFrom(...contractNameCharset)),
        (address, contractName) => {
          // Act
          const actual = deriveRendezvousName(`${address}.${contractName}`);
          // Assert
          const expected = `${contractName}_rendezvous`;
          expect(actual).toBe(expected);
        }
      )
    );
  });

  it("gets contract name from Rendezvous contract name", () => {
    const addressCharset = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const contractNameCharset =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    fc.assert(
      // Arrange
      fc.property(
        fc.stringOf(fc.constantFrom(...addressCharset)),
        fc.stringOf(fc.constantFrom(...contractNameCharset)),
        (address, contractName) => {
          const rendezvousName = `${address}.${contractName}_rendezvous`;

          // Act
          const actual = getContractNameFromRendezvousName(rendezvousName);

          // Assert
          expect(actual).toBe(contractName);
        }
      )
    );
  });
});

describe("File stream operations", () => {
  it("retrieves the invariant contract source", async () => {
    // Arrange
    const manifestPath = resolve(__dirname, "../example/Clarinet.toml");
    const contractsPath = resolve(__dirname, "../example/contracts");
    const simnet = await initSimnet(manifestPath);
    const sutContractsInterfaces = getSimnetDeployerContractsInterfaces(simnet);
    const sutContractsList = Array.from(sutContractsInterfaces.keys());
    const expectedInvariantContractSources = sutContractsList.map(
      (contractName) => {
        const invariantContractName = `${
          contractName.split(".")[1]
        }.invariants`;
        const invariantContractPath = `${contractsPath}/${invariantContractName}.clar`;
        return fs.readFileSync(invariantContractPath).toString();
      }
    );

    // Act
    const actualInvariantContractSources = sutContractsList.map(
      (contractName) => getInvariantContractSource(contractsPath, contractName)
    );

    // Assert
    expect(actualInvariantContractSources).toEqual(
      expectedInvariantContractSources
    );
  });
});

describe("Simnet contracts operations", () => {
  // FIXME: We can have multiple manifest paths and randomly select one.
  // For now, we'll use the one we have.
  it("retrieves the contracts from the simnet", async () => {
    // Arrange
    const manifestPath = resolve(__dirname, "../example/Clarinet.toml");
    const simnet = await initSimnet(manifestPath);
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

  it("retrieves the contract source from the simnet", async () => {
    // Arrange
    const manifestPath = resolve(__dirname, "../example/Clarinet.toml");
    const simnet = await initSimnet(manifestPath);
    const sutContractsInterfaces = getSimnetDeployerContractsInterfaces(simnet);
    const sutContractsList = Array.from(sutContractsInterfaces.keys());

    const expectedContractSources = sutContractsList.map((contractName) =>
      simnet.getContractSource(contractName)
    );

    // Act
    const actualContractSources = sutContractsList.map((contractName) =>
      getSimnetContractSource(simnet, contractName)
    );

    // Assert
    expect(actualContractSources).toEqual(expectedContractSources);
  });

  it("retrieves the contract functions from the simnet", async () => {
    // Arrange
    const manifestPath = resolve(__dirname, "../example/Clarinet.toml");
    const simnet = await initSimnet(manifestPath);
    const sutContractsInterfaces = getSimnetDeployerContractsInterfaces(simnet);
    const sutContractsList = Array.from(sutContractsInterfaces.keys());
    const allFunctionsMap = new Map(
      Array.from(
        sutContractsInterfaces,
        ([contractName, contractInterface]) => [
          contractName,
          contractInterface.functions,
        ]
      )
    );
    const expectedContractFunctionsList = sutContractsList.map(
      (contractName) => allFunctionsMap.get(contractName) || []
    );

    // Act
    const actualContractFunctionsList = sutContractsList.map((contractName) =>
      getFunctionsListForContract(allFunctionsMap, contractName)
    );

    // Assert
    expect(actualContractFunctionsList).toEqual(expectedContractFunctionsList);
  });

  it("retrieves Rendezvous contracts data", async () => {
    // Arrange
    const manifestPath = resolve(__dirname, "../example/Clarinet.toml");
    const contractsPath = resolve(__dirname, "../example/contracts");
    const simnet = await initSimnet(manifestPath);
    const sutContractsInterfaces = getSimnetDeployerContractsInterfaces(simnet);
    const sutContractsList = Array.from(sutContractsInterfaces.keys());

    const expectedRendezvousData = sutContractsList.map((contractName) => {
      const sutContractSource = getSimnetContractSource(simnet, contractName);
      const invariantContractSource = getInvariantContractSource(
        contractsPath,
        contractName
      );
      const rendezvousSource = scheduleRendezvous(
        sutContractSource!,
        invariantContractSource
      );
      const rendezvousName = deriveRendezvousName(contractName);

      return {
        rendezvousName,
        rendezvousSource,
        rendezvousContractId: `${simnet.deployer}.${rendezvousName}`,
      };
    });

    // Act
    const actualRendezvousData = sutContractsList.map((contractName) =>
      buildRendezvousData(simnet, contractName, contractsPath)
    );

    // Assert
    expect(actualRendezvousData).toEqual(expectedRendezvousData);
  });

  it("deploys Rendezvous contracts to the simnet", async () => {
    // Arrange
    const manifestPath = resolve(__dirname, "../example/Clarinet.toml");
    const contractsPath = resolve(__dirname, "../example/contracts");
    const simnet = await initSimnet(manifestPath);
    const sutContractsInterfaces = getSimnetDeployerContractsInterfaces(simnet);
    const sutContractsList = Array.from(sutContractsInterfaces.keys());
    const rendezvousData = sutContractsList.map((contractName) =>
      buildRendezvousData(simnet, contractName, contractsPath)
    );

    // Act
    rendezvousData.forEach((contractData) => {
      deployRendezvous(
        simnet,
        contractData.rendezvousName,
        contractData.rendezvousSource
      );
    });

    // Re-fetch contract interfaces to check after deployment
    const actualSimnetContractsInterfacesAfterDeploy =
      getSimnetDeployerContractsInterfaces(simnet);
    const actualSimnetContractsListAfterDeploy = Array.from(
      actualSimnetContractsInterfacesAfterDeploy.keys()
    );

    // Assert
    // Check if all expected Rendezvous contracts are present in the result
    rendezvousData.forEach((contractData) => {
      expect(actualSimnetContractsListAfterDeploy).toContain(
        contractData.rendezvousContractId
      );
    });

    // Ensure there are exactly double the number of original contracts (pre-deployment and Rendezvous)
    expect(actualSimnetContractsListAfterDeploy).toHaveLength(
      2 * sutContractsList.length
    );
  });

  it("extracts the functions from the contract interfaces", async () => {
    // Arrange
    const manifestPath = resolve(__dirname, "../example/Clarinet.toml");
    const simnet = await initSimnet(manifestPath);
    const sutContractsInterfaces = getSimnetDeployerContractsInterfaces(simnet);
    const expectedAllFunctionsMap = new Map(
      Array.from(
        sutContractsInterfaces,
        ([contractName, contractInterface]) => [
          contractName,
          contractInterface.functions,
        ]
      )
    );

    // Act
    const actualAllFunctionsMap = getFunctionsFromContractInterfaces(
      sutContractsInterfaces
    );

    // Assert
    expect(actualAllFunctionsMap).toEqual(expectedAllFunctionsMap);
  });

  it("correctly initializes the local context for a given functions map", async () => {
    // Arrange
    const manifestPath = resolve(__dirname, "../example/Clarinet.toml");
    const simnet = await initSimnet(manifestPath);
    const sutContractsInterfaces = getSimnetDeployerContractsInterfaces(simnet);
    const sutContractsAllFunctions = getFunctionsFromContractInterfaces(
      sutContractsInterfaces
    );

    const expectedInitialContext = Object.fromEntries(
      Array.from(sutContractsAllFunctions.entries()).map(
        ([contractName, functions]) => [
          contractName,
          Object.fromEntries(functions.map((f) => [f.name, 0])),
        ]
      )
    );

    // Act
    const actualInitialContext = initializeLocalContext(
      sutContractsAllFunctions
    );

    // Assert
    expect(actualInitialContext).toEqual(expectedInitialContext);
  });

  it("correctly filters the Rendezvous contracts interfaces", async () => {
    // Arrange
    const manifestPath = resolve(__dirname, "../example/Clarinet.toml");
    const contractsPath = resolve(__dirname, "../example/contracts");
    const simnet = await initSimnet(manifestPath);
    const sutContractsInterfaces = getSimnetDeployerContractsInterfaces(simnet);
    const sutContractsList = Array.from(sutContractsInterfaces.keys());
    const rendezvousData = sutContractsList.map((contractName) =>
      buildRendezvousData(simnet, contractName, contractsPath)
    );
    const expectedRendezvousList = rendezvousData
      .map((contractData) => {
        deployRendezvous(
          simnet,
          contractData.rendezvousName,
          contractData.rendezvousSource
        );
        return contractData.rendezvousContractId;
      })
      .sort();

    // Act
    const rendezvousInterfaces = filterRendezvousInterfaces(
      getSimnetDeployerContractsInterfaces(simnet)
    );
    const actualRendezvousList = Array.from(rendezvousInterfaces.keys()).sort();

    // Assert
    expect(actualRendezvousList).toEqual(expectedRendezvousList);
  });

  it("correctly initializes the Clarity context", async () => {
    // Arrange
    const manifestPath = resolve(__dirname, "../example/Clarinet.toml");
    const contractsPath = resolve(__dirname, "../example/contracts");
    const simnet = await initSimnet(manifestPath);
    const sutContractsInterfaces = getSimnetDeployerContractsInterfaces(simnet);
    const sutContractsList = Array.from(sutContractsInterfaces.keys());
    const rendezvousData = sutContractsList.map((contractName) =>
      buildRendezvousData(simnet, contractName, contractsPath)
    );
    rendezvousData.forEach((contractData) => {
      deployRendezvous(
        simnet,
        contractData.rendezvousName,
        contractData.rendezvousSource
      );
    });
    const rendezvousInterfaces = filterRendezvousInterfaces(
      getSimnetDeployerContractsInterfaces(simnet)
    );
    const rendezvousAllFunctions =
      getFunctionsFromContractInterfaces(rendezvousInterfaces);

    // The JS representation of Clarity `(some (tuple (called uint)))`, where `called` is
    // initialized to 0.
    const expectedClarityValue = Cl.some(Cl.tuple({ called: Cl.uint(0) }));
    const expectedContext = Array.from(rendezvousAllFunctions).flatMap(
      ([contractName, functions]) =>
        functions.map((f) => {
          return {
            contractName,
            functionName: f.name,
            called: expectedClarityValue,
          };
        })
    );

    // Act
    initializeClarityContext(simnet, rendezvousAllFunctions);

    const actualContext = Array.from(rendezvousAllFunctions).flatMap(
      ([contractName, functions]) =>
        functions.map((f) => {
          const actualValue = simnet.getMapEntry(
            contractName,
            "context",
            Cl.stringAscii(f.name)
          );
          return { contractName, functionName: f.name, called: actualValue };
        })
    );

    // Assert
    expect(actualContext).toEqual(expectedContext);
  });
});
