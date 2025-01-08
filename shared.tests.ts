import { initSimnet } from "@hirosystems/clarinet-sdk";
import {
  getFunctionsFromContractInterfaces,
  getFunctionsListForContract,
  getSimnetDeployerContractsInterfaces,
  isTraitReferenceFunction,
  hexaString,
  getContractNameFromContractId,
} from "./shared";
import { resolve } from "path";
import fc from "fast-check";
import { ContractInterfaceFunction } from "@hirosystems/clarinet-sdk-wasm";

describe("Simnet contracts operations", () => {
  it("retrieves the contracts from the simnet", async () => {
    // Arrange
    const manifestPath = resolve(__dirname, "./example/Clarinet.toml");
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

  it("retrieves the contract functions from the simnet", async () => {
    // Arrange
    const manifestPath = resolve(__dirname, "./example/Clarinet.toml");
    const simnet = await initSimnet(manifestPath);
    const sutContractsInterfaces = getSimnetDeployerContractsInterfaces(simnet);
    const sutContractsList = Array.from(sutContractsInterfaces.keys());
    const allFunctionsMap = new Map(
      Array.from(sutContractsInterfaces, ([contractId, contractInterface]) => [
        contractId,
        contractInterface.functions,
      ])
    );
    const expectedContractFunctionsList = sutContractsList.map(
      (contractId) => allFunctionsMap.get(contractId) || []
    );

    // Act
    const actualContractFunctionsList = sutContractsList.map((contractId) =>
      getFunctionsListForContract(allFunctionsMap, contractId)
    );

    // Assert
    expect(actualContractFunctionsList).toEqual(expectedContractFunctionsList);
  });

  it("extracts the functions from the contract interfaces", async () => {
    // Arrange
    const manifestPath = resolve(__dirname, "./example/Clarinet.toml");
    const simnet = await initSimnet(manifestPath);
    const sutContractsInterfaces = getSimnetDeployerContractsInterfaces(simnet);
    const expectedAllFunctionsMap = new Map(
      Array.from(sutContractsInterfaces, ([contractId, contractInterface]) => [
        contractId,
        contractInterface.functions,
      ])
    );

    // Act
    const actualAllFunctionsMap = getFunctionsFromContractInterfaces(
      sutContractsInterfaces
    );

    // Assert
    expect(actualAllFunctionsMap).toEqual(expectedAllFunctionsMap);
  });
});

describe("Trait reference detection", () => {
  it("returns false when no arguments contain a trait reference", async () => {
    // Arrange
    const noTraitFunction = {
      name: "function-without-traits",
      access: "public",
      args: [
        { name: "arg1", type: "uint128" },
        { name: "arg2", type: { buffer: { length: 10 } } },
        { name: "arg3", type: { "string-ascii": { length: 20 } } },
        { name: "arg4", type: "principal" },
        { name: "arg5", type: "bool" },
        { name: "arg6", type: "int128" },
      ],
      outputs: {
        type: {
          response: {
            ok: "bool",
            error: "uint128",
          },
        },
      },
    } as ContractInterfaceFunction;

    // Act
    const result = isTraitReferenceFunction(noTraitFunction);

    // Assert
    expect(result).toBe(false);
  });

  it("returns true when an argument contains a trait reference", async () => {
    // Arrange
    const traitFunction = {
      name: "function-with-traits",
      access: "public",
      args: [
        { name: "arg1", type: "trait_reference" },
        { name: "arg2", type: "uint128" },
      ],
      outputs: {
        type: {
          response: {
            ok: "bool",
            error: "uint128",
          },
        },
      },
    } as ContractInterfaceFunction;

    // Act
    const result = isTraitReferenceFunction(traitFunction);

    // Assert
    expect(result).toBe(true);
  });

  it("returns false for a list argument without traits", async () => {
    // Arrange
    const listFunction = {
      name: "list-without-traits",
      access: "public",
      args: [
        {
          name: "listArg",
          type: { list: { type: "uint128", length: 5 } },
        },
      ],
      outputs: {
        type: {
          response: {
            ok: "bool",
            error: "uint128",
          },
        },
      },
    } as ContractInterfaceFunction;

    // Act
    const result = isTraitReferenceFunction(listFunction);

    // Assert
    expect(result).toBe(false);
  });

  it("returns true for a list argument with traits", async () => {
    // Arrange
    const listWithTraitFunction = {
      name: "list-with-traits",
      access: "public",
      args: [
        {
          name: "listArg",
          type: { list: { type: "trait_reference", length: 5 } },
        },
      ],
      outputs: {
        type: {
          response: {
            ok: "bool",
            error: "uint128",
          },
        },
      },
    } as ContractInterfaceFunction;

    // Act
    const result = isTraitReferenceFunction(listWithTraitFunction);

    // Assert
    expect(result).toBe(true);
  });

  it("returns false for a tuple argument without traits", async () => {
    // Arrange
    const tupleFunction = {
      name: "tuple-without-traits",
      access: "public",
      args: [
        {
          name: "tupleArg",
          type: {
            tuple: [
              { name: "field1", type: "uint128" },
              { name: "field2", type: { buffer: { length: 10 } } },
            ],
          },
        },
      ],
      outputs: {
        type: {
          response: {
            ok: "bool",
            error: "uint128",
          },
        },
      },
    } as ContractInterfaceFunction;

    // Act
    const result = isTraitReferenceFunction(tupleFunction);

    // Assert
    expect(result).toBe(false);
  });

  it("returns true for a tuple argument with traits", async () => {
    // Arrange
    const tupleWithTraitFunction = {
      name: "tuple-with-traits",
      access: "public",
      args: [
        {
          name: "tupleArg",
          type: {
            tuple: [
              { name: "field1", type: "uint128" },
              { name: "field2", type: "trait_reference" },
            ],
          },
        },
      ],
      outputs: {
        type: {
          response: {
            ok: "bool",
            error: "uint128",
          },
        },
      },
    } as ContractInterfaceFunction;

    // Act
    const result = isTraitReferenceFunction(tupleWithTraitFunction);

    // Assert
    expect(result).toBe(true);
  });

  it("returns false for an optional argument without traits", async () => {
    // Arrange
    const optionalFunction = {
      name: "optional-without-traits",
      access: "public",
      args: [{ name: "optionalArg", type: { optional: "uint128" } }],
      outputs: {
        type: {
          response: {
            ok: "bool",
            error: "uint128",
          },
        },
      },
    } as ContractInterfaceFunction;

    // Act
    const result = isTraitReferenceFunction(optionalFunction);

    // Assert
    expect(result).toBe(false);
  });

  it("returns true for an optional argument with traits", async () => {
    // Arrange
    const optionalWithTraitFunction = {
      name: "optional-with-traits",
      access: "public",
      args: [{ name: "optionalArg", type: { optional: "trait_reference" } }],
      outputs: {
        type: {
          response: {
            ok: "bool",
            error: "uint128",
          },
        },
      },
    } as ContractInterfaceFunction;

    // Act
    const result = isTraitReferenceFunction(optionalWithTraitFunction);

    // Assert
    expect(result).toBe(true);
  });

  it("returns false for a response argument without traits", async () => {
    // Arrange
    const responseFunction = {
      name: "response-without-traits",
      access: "public",
      args: [
        {
          name: "responseArg",
          type: {
            response: { ok: "uint128", error: "bool" },
          },
        },
      ],
      outputs: {
        type: {
          response: {
            ok: "bool",
            error: "uint128",
          },
        },
      },
    } as ContractInterfaceFunction;

    // Act
    const result = isTraitReferenceFunction(responseFunction);

    // Assert
    expect(result).toBe(false);
  });

  it("returns true for a response argument with traits", async () => {
    // Arrange
    const responseWithTraitFunction = {
      name: "response-with-traits",
      access: "public",
      args: [
        {
          name: "responseArg",
          type: {
            response: { ok: "trait_reference", error: "uint128" },
          },
        },
      ],
      outputs: {
        type: {
          response: {
            ok: "bool",
            error: "uint128",
          },
        },
      },
    } as ContractInterfaceFunction;

    // Act
    const result = isTraitReferenceFunction(responseWithTraitFunction);

    // Assert
    expect(result).toBe(true);
  });

  it("returns false for unexpected argument types", async () => {
    // Arrange
    const unexpectedTypeFunction = {
      name: "unexpected-type-function",
      access: "public",
      args: [{ name: "unexpectedArg", type: "custom_type" as any }],
      outputs: {
        type: {
          response: {
            ok: "bool",
            error: "uint128",
          },
        },
      },
    } as ContractInterfaceFunction;

    // Act
    const result = isTraitReferenceFunction(unexpectedTypeFunction);

    // Assert
    expect(result).toBe(false);
  });

  it("returns false for an argument with an unrecognized complex type", async () => {
    // Arrange
    const unrecognizedTypeFunction = {
      name: "unrecognized-type-function",
      access: "public",
      args: [{ name: "unknownArg", type: { unknown: "some_value" } as any }],
      outputs: { type: "bool" },
    } as ContractInterfaceFunction;

    // Act
    const result = isTraitReferenceFunction(unrecognizedTypeFunction);

    // Assert
    expect(result).toBe(false);
  });
});

describe("Fast-check deprecated generators replacement validation", () => {
  it("string-ascii Clarity type corresponding generator", () => {
    // Arrange
    const charSet =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 !\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~";
    const size = 100;
    const seed = Math.floor(Math.random() * size);

    const outdated = fc.stringOf(fc.constantFrom(...charSet), {
      maxLength: size,
      minLength: 0,
    });

    const proposed = fc.string({
      unit: fc.constantFrom(...charSet),
      maxLength: size,
    });

    // Act
    const a: string[] = fc.sample(outdated, { seed: seed });
    const b: string[] = fc.sample(proposed, { seed: seed });

    // Assert
    // Strict, same-order comparison.
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });

  it("buff Clarity type corresponding generator", () => {
    // Arrange
    const size = 100;
    const seed = Math.floor(Math.random() * size);

    const outdated = fc.hexaString({ maxLength: size });
    const proposed = hexaString({ maxLength: size });

    // Act
    const a: string[] = fc.sample(outdated, { seed: seed });
    const b: string[] = fc.sample(proposed, { seed: seed });

    // Assert
    // Strict, same-order comparison.
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });
});

describe("Contract identifier parsing", () => {
  it("gets correct contract name from contract identifier", () => {
    const addressCharset = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const contractNameCharset =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    fc.assert(
      // Arrange
      fc.property(
        fc.string({ unit: fc.constantFrom(...addressCharset) }),
        fc.string({ unit: fc.constantFrom(...contractNameCharset) }),
        (address, contractName) => {
          const contractId = `${address}.${contractName}`;

          // Act
          const actual = getContractNameFromContractId(contractId);

          // Assert
          expect(actual).toBe(contractName);
        }
      )
    );
  });
});
