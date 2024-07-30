import { initSimnet, Simnet } from "@hirosystems/clarinet-sdk";
import { ContractInterface } from "@hirosystems/clarinet-sdk/dist/esm/contractInterface";

type ContractFunction = {
  name: string;
  access: "public" | "private" | "read_only";
  args: any[];
  outputs: object;
};

/**
 * Get the contracts interfaces from the simnet. If a deployer is provided,
 * only the contracts deployed by the deployer are returned.
 * @param simnet The simnet instance.
 * @param deployer The deployer address - optional.
 * @returns The contracts interfaces.
 */
export const getContractsInterfacesFromSimnet = (
  simnet: Simnet,
  deployer?: string
): Map<string, ContractInterface> => {
  const allContractsInterfaces = simnet.getContractsInterfaces();

  if (!deployer) {
    return allContractsInterfaces;
  }
  const filteredContracts = new Map<string, ContractInterface>();

  allContractsInterfaces.forEach((contractInterface, key) => {
    const [address] = key.split(".");

    if (address === deployer) {
      filteredContracts.set(key, contractInterface);
    }
  });

  return filteredContracts;
};

/**
 * Get the functions from the smart contract interfaces.
 * @param contractsInterfaces The smart contract interfaces map.
 * @returns A map containing the contracts functions.
 */
export const getFunctionsFromScInterfaces = (
  contractsInterfaces: Map<string, ContractInterface>
): Map<string, ContractFunction[]> => {
  const contractsFunctions = new Map<string, ContractFunction[]>();

  contractsInterfaces.forEach((scInterface, scName) => {
    contractsFunctions.set(scName, scInterface.functions);
  });

  return contractsFunctions;
};

export async function main() {
  // Get the arguments from the command-line.
  const args = process.argv;
  // 0: NodeJs path.
  // 1: app.js path.
  // 2: command-line arg 1.
  // 3: command-line arg 2.
  // 4: command-line arg 3.
  // ...
  args.forEach(arg => {
    console.log(arg);
  });

  const manifestPath = args[2];

  if (!manifestPath) {
    throw new Error("Please provide a path to the Clarinet.toml manifest.");
  }

  console.log(`Using manifest path: ${manifestPath}`);

  const simnet = await initSimnet(manifestPath);
  const deployer = simnet.deployer;

  const sutContractsInterfaces = getContractsInterfacesFromSimnet(
    simnet,
    deployer
  );

  const sutContractsAllFunctions = getFunctionsFromScInterfaces(
    sutContractsInterfaces
  );

  // FIXME
  // --------------------------------------------------------------------------
  // With the path to the Clarinet.toml above (manifestPath), use the code off
  // of the prototype branch to read the contracts, concatenate them, and then
  // run the invariant checker, on the concatenated contracts.
  // (Add the mininum required code needed for the above task.)
  //
  // Once everything is added, we expect that running `rv <path-to-manifest>`
  // will catch the bug in the contracts.
  //
  // At this point we must consider covering the code we copied over from the
  // prototype branch with unit tests, parameterized unit tests, and property
  // -based tests. See examples in the `app.test.ts` file for how to do this.
  //
  // Once tests are added and passing we can get rid of the ice-breaker tests
  // in app.test.ts (those having to do with the calculator function) and the
  // calculator function itself, defined in app.ts.
  // --------------------------------------------------------------------------
}

if (require.main === module) {
  main();
}
