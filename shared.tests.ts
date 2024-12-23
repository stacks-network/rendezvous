import { initSimnet } from "@hirosystems/clarinet-sdk";
import {
  getFunctionsFromContractInterfaces,
  getFunctionsListForContract,
  getSimnetDeployerContractsInterfaces,
  hexaString,
} from "./shared";
import { resolve } from "path";
import fc from "fast-check";

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
