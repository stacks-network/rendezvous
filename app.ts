import { initSimnet, Simnet } from "@hirosystems/clarinet-sdk";
import {
  ContractInterface,
  ContractInterfaceFunction,
} from "@hirosystems/clarinet-sdk/dist/esm/contractInterface";
import { Cl, cvToJSON } from "@stacks/transactions";
import fc from "fast-check";
import fs from "fs";

export type BaseType = "int128" | "uint128" | "bool" | "principal";
export type ComplexType =
  | { buffer: { length: number } }
  | { "string-ascii": { length: number } }
  | { "string-utf8": { length: number } }
  | { list: { type: ArgType; length: number } }
  | { tuple: { name: string; type: ArgType }[] }
  | { optional: ArgType }
  | { response: { ok: ArgType; error: ArgType } };

export type ArgType = BaseType | ComplexType;

/**
 * LocalContext is a data structure used to track the number of times each SUT function is called
 * for every contract. It is a nested map where:
 * - The outer key is the contract name.
 * - The inner key is the SUT function name within the contract.
 * - The value is the count of times the SUT function has been invoked.
 */
export type LocalContext = {
  [contractName: string]: {
    [functionName: string]: number;
  };
};

export type BaseTypesToFcType = {
  int128: ReturnType<typeof fc.integer>;
  uint128: ReturnType<typeof fc.nat>;
  bool: ReturnType<typeof fc.boolean>;
  principal: (addresses: string[]) => ReturnType<typeof fc.constantFrom>;
};

export type ComplexTypesToFcType = {
  buffer: (length: number) => fc.Arbitrary<string>;
  "string-ascii": (length: number) => fc.Arbitrary<string>;
  "string-utf8": (length: number) => fc.Arbitrary<string>;
  list: (
    type: ArgType,
    length: number,
    addresses: string[]
  ) => fc.Arbitrary<any[]>;
  tuple: (
    items: { name: string; type: ArgType }[],
    addresses: string[]
  ) => fc.Arbitrary<object>;
  optional: (type: ArgType, addresses: string[]) => fc.Arbitrary<any>;
  response: (
    okType: ArgType,
    errType: ArgType,
    addresses: string[]
  ) => fc.Arbitrary<any>;
};

/** The character set used for generating ASCII strings.*/
const charSet =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 !\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~";

/**
 * The context contract that will be concatenated with the SUT and the invariants contracts.
 * It is a map that stores the number of times each SUT function is called.
 */
const contextContract = `(define-map context (string-ascii 100) {
  called: uint
  ;; other data
})

(define-public (update-context (function-name (string-ascii 100)) (called uint))
  (ok (map-set context function-name {called: called})))`;

/**
 * Base types to fast-check arbitraries mapping.
 */
export const baseTypesToFC: BaseTypesToFcType = {
  int128: fc.integer(),
  uint128: fc.nat(),
  bool: fc.boolean(),
  principal: (addresses: string[]) => fc.constantFrom(...addresses),
};

/**
 * Complex types to fast-check arbitraries mapping.
 */
const complexTypesToFC: ComplexTypesToFcType = {
  buffer: (length: number) => fc.hexaString({ maxLength: length }),
  "string-ascii": (length: number) =>
    fc.stringOf(fc.constantFrom(...charSet), {
      maxLength: length,
      minLength: 1,
    }),
  "string-utf8": (length: number) => fc.string({ maxLength: length }),
  list: (type: ArgType, length: number, addresses: string[]) =>
    fc.array(generateArbitrary(type, addresses), { maxLength: length }),
  tuple: (items: { name: string; type: ArgType }[], addresses: string[]) => {
    const tupleArbitraries: { [key: string]: fc.Arbitrary<any> } = {};
    items.forEach((item) => {
      tupleArbitraries[item.name] = generateArbitrary(item.type, addresses);
    });
    return fc.record(tupleArbitraries);
  },
  optional: (type: ArgType, addresses: string[]) =>
    fc.option(generateArbitrary(type, addresses)),
  response: (okType: ArgType, errType: ArgType, addresses: string[]) =>
    fc.oneof(
      fc.record({
        status: fc.constant("ok"),
        value: generateArbitrary(okType, addresses),
      }),
      fc.record({
        status: fc.constant("error"),
        value: generateArbitrary(errType, addresses),
      })
    ),
};

/** For a given function, dynamically generate fast-check arbitraries.
 * @param fn ContractFunction
 * @returns Array of fast-check arbitraries
 */
export const generateArbitrariesForFunction = (
  fn: ContractInterfaceFunction,
  addresses: string[]
): fc.Arbitrary<any>[] => {
  return fn.args.map((arg) => {
    return generateArbitrary(arg.type as ArgType, addresses);
  });
};

/**
 * For a given type, generate a fast-check arbitrary.
 * @param type
 * @returns fast-check arbitrary
 */
const generateArbitrary = (
  type: ArgType,
  addresses: string[]
): fc.Arbitrary<any> => {
  if (typeof type === "string") {
    // The type is a base type
    if (type === "principal") {
      if (addresses.length === 0)
        throw new Error(
          "No addresses could be retrieved from the simnet instance!"
        );
      return baseTypesToFC.principal(addresses);
    } else return baseTypesToFC[type];
  } else {
    // The type is a complex type
    if ("buffer" in type) {
      return complexTypesToFC["buffer"](type.buffer.length);
    } else if ("string-ascii" in type) {
      return complexTypesToFC["string-ascii"](type["string-ascii"].length);
    } else if ("string-utf8" in type) {
      return complexTypesToFC["string-utf8"](type["string-utf8"].length);
    } else if ("list" in type) {
      return complexTypesToFC["list"](
        type.list.type,
        type.list.length,
        addresses
      );
    } else if ("tuple" in type) {
      return complexTypesToFC["tuple"](type.tuple, addresses);
    } else if ("optional" in type) {
      return complexTypesToFC["optional"](type.optional, addresses);
    } else if ("response" in type) {
      return complexTypesToFC.response(
        type.response.ok,
        type.response.error,
        addresses
      );
    } else {
      throw new Error(`Unsupported complex type: ${JSON.stringify(type)}`);
    }
  }
};

/**
 * Get the interfaces of contracts deployed by the specified deployer from the simnet.
 * @param simnet The simnet instance.
 * @param deployer The deployer address.
 * @returns The contracts interfaces.
 */
export const getSimnetDeployerContractsInterfaces = (
  simnet: Simnet,
  deployer: string
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
 * Filter the concatenated contracts interfaces from the contracts interfaces map.
 * @param contractsInterfaces The contracts interfaces map.
 * @returns The concatenated contracts interfaces.
 */
export const filterConcatContractsInterfaces = (
  contractsInterfaces: Map<string, ContractInterface>
) => {
  const concatContractsInterfaces = new Map<string, ContractInterface>();

  contractsInterfaces.forEach((scInterface, scName) => {
    if (scName.endsWith("_concat")) {
      concatContractsInterfaces.set(scName, scInterface);
    }
  });

  return concatContractsInterfaces;
};

/**
 * Get the functions from the smart contract interfaces.
 * @param contractsInterfaces The smart contract interfaces map.
 * @returns A map containing the contracts functions.
 */
export const getFunctionsFromScInterfaces = (
  contractsInterfaces: Map<string, ContractInterface>
): Map<string, ContractInterfaceFunction[]> => {
  const contractsFunctions = new Map<string, ContractInterfaceFunction[]>();

  contractsInterfaces.forEach((scInterface, scName) => {
    contractsFunctions.set(scName, scInterface.functions);
  });

  return contractsFunctions;
};

/**
 * Filter the System Under Test (`SUT`) functions from the map of all
 * contract functions.
 *
 * The SUT functions are the ones that have `public` access since they are
 * capable of changing the contract state.
 * @param allFunctionsMap The map containing all the functions for each contract.
 * @returns A map containing only the SUT functions for each contract.
 */
export const filterSutFunctions = (
  allFunctionsMap: Map<string, ContractInterfaceFunction[]>
) => {
  const sutFunctionsMap = new Map<string, ContractInterfaceFunction[]>();
  allFunctionsMap.forEach((functions, contractName) => {
    const contractSutFunctions = functions.filter(
      (f) => f.access === "public" && f.name !== "update-context"
    );
    sutFunctionsMap.set(contractName, contractSutFunctions);
  });

  return sutFunctionsMap;
};

export const filterInvariantFunctions = (
  allFunctionsMap: Map<string, ContractInterfaceFunction[]>
) => {
  const invariantFunctionsMap = new Map<string, ContractInterfaceFunction[]>();
  allFunctionsMap.forEach((functions, contractName) => {
    const contractInvariantFunctions = functions.filter(
      (f) => f.access === "read_only" && f.name.startsWith("invariant-")
    );
    invariantFunctionsMap.set(contractName, contractInvariantFunctions);
  });

  return invariantFunctionsMap;
};

/**
 * Get contract source code from the simnet.
 * @param simnet The simnet instance.
 * @param sutContractName The contract name.
 * @returns The contract source code.
 */
export const getSimnetContractSrc = (
  simnet: Simnet,
  sutContractName: string
) => {
  if (simnet.getContractSource(sutContractName) === undefined)
    throw new Error(`Contract ${sutContractName} not found in the network.`);
  return simnet.getContractSource(sutContractName);
};

/**
 * Get the invariant contract source code.
 * @param contractsPath The contracts path.
 * @param sutContractName The corresponding contract name.
 * @returns The invariant contract source code.
 */
export const getInvariantContractSrc = (
  contractsPath: string,
  sutContractName: string
) => {
  // FIXME: Here, we can encounter a failure if the contract file name is
  // not the same as the contract name in the manifest.
  // Example:
  // - Contract name in the manifest: [contracts.counter]
  // - Contract file name: path = "contracts/counter.clar"
  const invariantScName = `${sutContractName.split(".")[1]}.invariants`;
  const invariantScPath = `${contractsPath}/${invariantScName}.clar`;
  try {
    return fs.readFileSync(invariantScPath).toString();
  } catch (e: any) {
    throw new Error(
      `Error retrieving the corresponding invariant contract for the "${
        sutContractName.split(".")[1]
      }" contract. ${e.message}`
    );
  }
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
  args.forEach((arg) => {
    console.log(arg);
  });

  // FIXME: Decide if we want to pass only the directory or the full path.
  const manifestDir = args[2];

  if (!manifestDir) {
    throw new Error("No path to Clarinet.toml manifest provided. Supply it immediately or face the relentless scrutiny of your contract's vulnerabilities.");
  }

  const manifestPath = manifestDir + "/Clarinet.toml";
  const contractsPath = manifestDir + "/contracts";

  console.log(`Using manifest path: ${manifestPath}`);

  const simnet = await initSimnet(manifestPath);

  const concatContractsList: string[] = [];

  const sutContractsInterfaces = getSimnetDeployerContractsInterfaces(
    simnet,
    simnet.deployer
  );

  // Get all the contracts from the interfaces.
  const sutContracts = Array.from(sutContractsInterfaces.keys());

  sutContracts.forEach((contract) => {
    // Get the source code of the SUT contract
    const sutContractSrc = getSimnetContractSrc(simnet, contract);
    // Get the source code of the invariants contract
    const invariantContractSrc = getInvariantContractSrc(
      contractsPath,
      contract
    );
    // Concatenate the contracts.
    const concatContractSrc =
      sutContractSrc + "\n\n" + invariantContractSrc + "\n\n" + contextContract;
    // Get the name of the concatenated contract. This will be used for
    // the deployment
    const concatContractName = `${contract.split(".")[1]}_concat`;

    try {
      // Deploy the concatenated contract
      simnet.deployContract(
        concatContractName,
        concatContractSrc,
        { clarityVersion: 2 },
        simnet.deployer
      );

      concatContractsList.push(`${simnet.deployer}.${concatContractName}`);
    } catch (e: any) {
      throw new Error(
        `Something went wrong. Please double check the invariants contract: ${
          contract.split(".")[1]
        }.invariant.clar:\n${e}`
      );
    }
  });

  const concatContractsInterfaces = filterConcatContractsInterfaces(
    getSimnetDeployerContractsInterfaces(simnet, simnet.deployer)
  );

  const concatContractsAllFunctions = getFunctionsFromScInterfaces(
    concatContractsInterfaces
  );

  // A map where the keys are the concatenated contract names and the values
  // are arrays of their SUT (System Under Test) functions.
  const concatContractsSutFunctions = filterSutFunctions(
    concatContractsAllFunctions
  );

  // A map where the keys are the concatenated contract names and the values
  // are arrays of their invariant functions.
  const concatContractsInvariantFunctions = filterInvariantFunctions(
    concatContractsAllFunctions
  );

  // Initialize the local context
  const localContext: LocalContext = {};

  concatContractsSutFunctions.forEach((functions, contractName) => {
    localContext[contractName] = {};
    functions.forEach((f) => {
      localContext[contractName][f.name] = 0;
    });
  });

  // Initialize the Clarity context
  concatContractsSutFunctions.forEach((fns, scName) => {
    fns.forEach((fn) => {
      const { result: initialize } = simnet.callPublicFn(
        scName,
        "update-context",
        [Cl.stringAscii(fn.name), Cl.uint(0)],
        simnet.deployer
      );
      const jsonResult = cvToJSON(initialize);
      if (!jsonResult.value || !jsonResult.success) {
        throw new Error(
          `Failed to initialize the context for function: ${fn.name}`
        );
      }
    });
  });

  fc.assert(
    fc.property(
      fc
        .record({
          contractName: fc.oneof(
            ...concatContractsList.map((contractName) =>
              fc.constant(contractName)
            )
          ),
        })
        .chain((r) => {
          const functions = concatContractsSutFunctions.get(r.contractName);
          const invariantFunctions = concatContractsInvariantFunctions.get(
            r.contractName
          );
          const fnGenerator =
            functions?.length === 0
              ? fc.constant({})
              : fc.constantFrom(...(functions as ContractInterfaceFunction[]));
          const invariantFnGenerator =
            invariantFunctions?.length === 0
              ? fc.constant({})
              : fc.constantFrom(
                  ...(invariantFunctions as ContractInterfaceFunction[])
                );

          return fc
            .record({
              generatedFn: fnGenerator,
              generatedInvariant: invariantFnGenerator,
            })
            .map((fn) => ({ ...r, ...fn }));
        }),
      (r) => {
        console.log(r);
      }
    )
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
