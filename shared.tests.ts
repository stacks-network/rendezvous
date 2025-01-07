import { initSimnet } from "@hirosystems/clarinet-sdk";
import {
  getFunctionsFromContractInterfaces,
  getFunctionsListForContract,
  getSimnetDeployerContractsInterfaces,
  isTraitReferenceFunction,
  hexaString,
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

  it("trait reference finder returns false for a function witout traits", async () => {
    // Arrange
    const noTraitContractInterfaceFunction = {
      name: "create-new-shipment",
      access: "public",
      args: [
        {
          name: "starting-location",
          type: {
            "string-ascii": {
              length: 25,
            },
          },
        },
        {
          name: "receiver",
          type: "principal",
        },
      ],
      outputs: {
        type: {
          response: {
            ok: {
              "string-ascii": {
                length: 29,
              },
            },
            error: "none",
          },
        },
      },
    } as ContractInterfaceFunction;

    // Act
    const hasTrait = isTraitReferenceFunction(noTraitContractInterfaceFunction);

    // Assert
    expect(hasTrait).toBe(false);
  });

  it("trait reference finder returns true for a function with traits", async () => {
    // Arrange
    const traitContractInterfaceFunction = {
      name: "transfer-two",
      access: "public",
      args: [
        {
          name: "ft-contract",
          type: {
            tuple: [
              {
                name: "token",
                type: "trait_reference",
              },
            ],
          },
        },
        {
          name: "nft-contract",
          type: {
            tuple: [
              {
                name: "token",
                type: "trait_reference",
              },
            ],
          },
        },
        {
          name: "amount",
          type: "uint128",
        },
        {
          name: "recipient",
          type: "principal",
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
    const hasTrait = isTraitReferenceFunction(traitContractInterfaceFunction);

    // Assert
    expect(hasTrait).toBe(true);
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
