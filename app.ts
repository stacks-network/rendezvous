import { initSimnet, Simnet } from "@hirosystems/clarinet-sdk";
import {
  ContractInterface,
  ContractInterfaceFunction,
} from "@hirosystems/clarinet-sdk/dist/esm/contractInterface";
import {
  boolCV,
  bufferCV,
  Cl,
  ClarityValue,
  cvToJSON,
  intCV,
  listCV,
  optionalCVOf,
  principalCV,
  responseErrorCV,
  responseOkCV,
  stringAsciiCV,
  stringUtf8CV,
  tupleCV,
  uintCV,
} from "@stacks/transactions";
import fc from "fast-check";
import fs from "fs";

type BaseType = "int128" | "uint128" | "bool" | "principal";
type ComplexType =
  | { buffer: { length: number } }
  | { "string-ascii": { length: number } }
  | { "string-utf8": { length: number } }
  | { list: { type: ParameterType; length: number } }
  | { tuple: { name: string; type: ParameterType }[] }
  | { optional: ParameterType }
  | { response: { ok: ParameterType; error: ParameterType } };

type ParameterType = BaseType | ComplexType;

/**
 * LocalContext is a data structure used to track the number of times each SUT
 * function is called for every contract. It is a nested map where:
 * - The outer key is the contract name.
 * - The inner key is the SUT function name within the contract.
 * - The value is the count of times the SUT function has been invoked.
 */
type LocalContext = {
  [contractName: string]: {
    [functionName: string]: number;
  };
};

type BaseTypesToArbitrary = {
  int128: ReturnType<typeof fc.integer>;
  uint128: ReturnType<typeof fc.nat>;
  bool: ReturnType<typeof fc.boolean>;
  principal: (addresses: string[]) => ReturnType<typeof fc.constantFrom>;
};

type ComplexTypesToArbitrary = {
  buffer: (length: number) => fc.Arbitrary<string>;
  "string-ascii": (length: number) => fc.Arbitrary<string>;
  "string-utf8": (length: number) => fc.Arbitrary<string>;
  list: (
    type: ParameterType,
    length: number,
    addresses: string[]
  ) => fc.Arbitrary<any[]>;
  tuple: (
    items: { name: string; type: ParameterType }[],
    addresses: string[]
  ) => fc.Arbitrary<object>;
  optional: (type: ParameterType, addresses: string[]) => fc.Arbitrary<any>;
  response: (
    okType: ParameterType,
    errType: ParameterType,
    addresses: string[]
  ) => fc.Arbitrary<any>;
};

type TupleData<T extends ClarityValue = ClarityValue> = {
  [key: string]: T;
};

type ResponseStatus = "ok" | "error";

type BaseTypesToCV = {
  int128: (arg: number) => ReturnType<typeof intCV>;
  uint128: (arg: number) => ReturnType<typeof uintCV>;
  bool: (arg: boolean) => ReturnType<typeof boolCV>;
  principal: (arg: string) => ReturnType<typeof principalCV>;
};

type ComplexTypesToCV = {
  buffer: (arg: string) => ReturnType<typeof bufferCV>;
  "string-ascii": (arg: string) => ReturnType<typeof stringAsciiCV>;
  "string-utf8": (arg: string) => ReturnType<typeof stringUtf8CV>;
  list: (type: ClarityValue[]) => ReturnType<typeof listCV>;
  tuple: (tupleData: TupleData) => ReturnType<typeof tupleCV>;
  optional: (arg: ClarityValue | null) => ReturnType<typeof optionalCVOf>;
  response: (
    status: ResponseStatus,
    value: ClarityValue
  ) => ReturnType<typeof responseOkCV | typeof responseErrorCV>;
};

const baseTypes: BaseType[] = ["int128", "uint128", "bool", "principal"];

/** The character set used for generating ASCII strings.*/
const charSet =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 !\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~";

/**
 * Base types to fast-check arbitraries mapping.
 */
const baseTypesToArbitrary: BaseTypesToArbitrary = {
  int128: fc.integer(),
  uint128: fc.nat(),
  bool: fc.boolean(),
  principal: (addresses: string[]) => fc.constantFrom(...addresses),
};

/**
 * Complex types to fast-check arbitraries mapping.
 */
const complexTypesToArbitrary: ComplexTypesToArbitrary = {
  buffer: (length: number) => fc.hexaString({ maxLength: length }),
  "string-ascii": (length: number) =>
    fc.stringOf(fc.constantFrom(...charSet), {
      maxLength: length,
      minLength: 1,
    }),
  "string-utf8": (length: number) => fc.string({ maxLength: length }),
  list: (type: ParameterType, length: number, addresses: string[]) =>
    fc.array(generateArbitrary(type, addresses), { maxLength: length }),
  tuple: (
    items: { name: string; type: ParameterType }[],
    addresses: string[]
  ) => {
    const tupleArbitraries: { [key: string]: fc.Arbitrary<any> } = {};
    items.forEach((item) => {
      tupleArbitraries[item.name] = generateArbitrary(item.type, addresses);
    });
    return fc.record(tupleArbitraries);
  },
  optional: (type: ParameterType, addresses: string[]) =>
    fc.option(generateArbitrary(type, addresses)),
  response: (
    okType: ParameterType,
    errType: ParameterType,
    addresses: string[]
  ) =>
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
 * @param fn ContractInterfaceFunction
 * @returns Array of fast-check arbitraries
 */
const generateArbitrariesForFunction = (
  fn: ContractInterfaceFunction,
  addresses: string[]
): fc.Arbitrary<any>[] =>
  fn.args.map((arg) => generateArbitrary(arg.type as ParameterType, addresses));

/**
 * For a given type, generate a fast-check arbitrary.
 * @param type
 * @returns fast-check arbitrary
 */
const generateArbitrary = (
  type: ParameterType,
  addresses: string[]
): fc.Arbitrary<any> => {
  if (typeof type === "string") {
    // The type is a base type
    if (type === "principal") {
      if (addresses.length === 0)
        throw new Error(
          "No addresses could be retrieved from the simnet instance!"
        );
      return baseTypesToArbitrary.principal(addresses);
    } else return baseTypesToArbitrary[type];
  } else {
    // The type is a complex type
    if ("buffer" in type) {
      return complexTypesToArbitrary["buffer"](type.buffer.length);
    } else if ("string-ascii" in type) {
      return complexTypesToArbitrary["string-ascii"](
        type["string-ascii"].length
      );
    } else if ("string-utf8" in type) {
      return complexTypesToArbitrary["string-utf8"](type["string-utf8"].length);
    } else if ("list" in type) {
      return complexTypesToArbitrary["list"](
        type.list.type,
        type.list.length,
        addresses
      );
    } else if ("tuple" in type) {
      return complexTypesToArbitrary["tuple"](type.tuple, addresses);
    } else if ("optional" in type) {
      return complexTypesToArbitrary["optional"](type.optional, addresses);
    } else if ("response" in type) {
      return complexTypesToArbitrary.response(
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
 * Base types to Clarity values mapping.
 */
const baseTypesToCV: BaseTypesToCV = {
  int128: (arg: number) => intCV(arg),
  uint128: (arg: number) => uintCV(arg),
  bool: (arg: boolean) => boolCV(arg),
  principal: (arg: string) => principalCV(arg),
};

/**
 * Complex types to Clarity values mapping.
 */
const complexTypesToCV: ComplexTypesToCV = {
  buffer: (arg: string) => bufferCV(Uint8Array.from(Buffer.from(arg, "hex"))),
  "string-ascii": (arg: string) => stringAsciiCV(arg),
  "string-utf8": (arg: string) => stringUtf8CV(arg),
  list: (items: ClarityValue[]) => {
    return listCV(items);
  },
  tuple: (tupleData: TupleData<ClarityValue>) => {
    return tupleCV(tupleData);
  },
  optional: (arg: ClarityValue | null) =>
    arg ? optionalCVOf(arg) : optionalCVOf(undefined),
  response: (status: ResponseStatus, value: ClarityValue) => {
    if (status === "ok") return responseOkCV(value);
    else if (status === "error") return responseErrorCV(value);
    else throw new Error(`Unsupported response status: ${status}`);
  },
};

const isBaseType = (type: ParameterType): type is BaseType => {
  return baseTypes.includes(type as BaseType);
};

/**
 * Convert function arguments to Clarity values.
 * @param fn ContractFunction
 * @param args Array of arguments
 * @returns Array of Clarity values
 */
const argsToCV = (fn: ContractInterfaceFunction, args: any[]) => {
  return fn.args.map((arg, i) => argToCV(args[i], arg.type as ParameterType));
};

/**
 * Convert a function argument to a Clarity value.
 * @param arg Generated argument
 * @param type Argument type (base or complex)
 * @returns Clarity value
 */
const argToCV = (arg: any, type: ParameterType): ClarityValue => {
  if (isBaseType(type)) {
    // Base type
    switch (type) {
      case "int128":
        return baseTypesToCV.int128(arg as number);
      case "uint128":
        return baseTypesToCV.uint128(arg as number);
      case "bool":
        return baseTypesToCV.bool(arg as boolean);
      case "principal":
        return baseTypesToCV.principal(arg as string);
      default:
        throw new Error(`Unsupported base type: ${type}`);
    }
  } else {
    // Complex type
    if ("buffer" in type) {
      return complexTypesToCV.buffer(arg);
    } else if ("string-ascii" in type) {
      return complexTypesToCV["string-ascii"](arg);
    } else if ("string-utf8" in type) {
      return complexTypesToCV["string-utf8"](arg);
    } else if ("list" in type) {
      const listItems = arg.map((item: any) => argToCV(item, type.list.type));
      return complexTypesToCV.list(listItems);
    } else if ("tuple" in type) {
      const tupleData: { [key: string]: ClarityValue } = {};
      type.tuple.forEach((field) => {
        tupleData[field.name] = argToCV(arg[field.name], field.type);
      });
      return complexTypesToCV.tuple(tupleData);
    } else if ("optional" in type) {
      return optionalCVOf(arg ? argToCV(arg, type.optional) : undefined);
    } else if ("response" in type) {
      const status = arg.status as ResponseStatus;
      const branchType = type.response[status];
      const responseValue = argToCV(arg.value, branchType);
      return complexTypesToCV.response(status, responseValue);
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
  simnet: Simnet
): Map<string, ContractInterface> =>
  new Map(
    Array.from(simnet.getContractsInterfaces()).filter(
      ([key]) => key.split(".")[0] === simnet.deployer
    )
  );

/**
 * Filter the concatenated contracts interfaces from the contracts interfaces map.
 * @param contractsInterfaces The contracts interfaces map.
 * @returns The concatenated contracts interfaces.
 */
const filterConcatContractsInterfaces = (
  contractsInterfaces: Map<string, ContractInterface>
) =>
  new Map(
    Array.from(contractsInterfaces).filter(([contractName]) =>
      contractName.endsWith("_concat")
    )
  );

/**
 * Get the functions from the smart contract interfaces.
 * @param contractsInterfaces The smart contract interfaces map.
 * @returns A map containing the contracts functions.
 */
const getFunctionsFromContractInterfaces = (
  contractsInterfaces: Map<string, ContractInterface>
): Map<string, ContractInterfaceFunction[]> =>
  new Map(
    Array.from(contractsInterfaces, ([contractName, contractInterface]) => [
      contractName,
      contractInterface.functions,
    ])
  );

/**
 * Filter the System Under Test (`SUT`) functions from the map of all
 * contract functions.
 *
 * The SUT functions are the ones that have `public` access since they are
 * capable of changing the contract state.
 * @param allFunctionsMap The map containing all the functions for each contract.
 * @returns A map containing only the SUT functions for each contract.
 */
const filterSutFunctions = (
  allFunctionsMap: Map<string, ContractInterfaceFunction[]>
) =>
  new Map(
    Array.from(allFunctionsMap, ([contractName, functions]) => [
      contractName,
      functions.filter(
        (f) => f.access === "public" && f.name !== "update-context"
      ),
    ])
  );

const filterInvariantFunctions = (
  allFunctionsMap: Map<string, ContractInterfaceFunction[]>
) =>
  new Map(
    Array.from(allFunctionsMap, ([contractName, functions]) => [
      contractName,
      functions.filter(
        (f) => f.access === "read_only" && f.name.startsWith("invariant-")
      ),
    ])
  );

/**
 * Get contract source code from the simnet.
 * @param simnet The simnet instance.
 * @param sutContractName The contract name.
 * @returns The contract source code.
 */
const getSimnetContractSource = (simnet: Simnet, sutContractName: string) => {
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
const getInvariantContractSource = (
  contractsPath: string,
  sutContractName: string
) => {
  // FIXME: Here, we can encounter a failure if the contract file name is
  // not the same as the contract name in the manifest.
  // Example:
  // - Contract name in the manifest: [contracts.counter]
  // - Contract file name: path = "contracts/counter.clar"
  const invariantContractName = `${sutContractName.split(".")[1]}.invariants`;
  const invariantContractPath = `${contractsPath}/${invariantContractName}.clar`;
  try {
    return fs.readFileSync(invariantContractPath).toString();
  } catch (e: any) {
    throw new Error(
      `Error retrieving the corresponding invariant contract for the "${
        sutContractName.split(".")[1]
      }" contract. ${e.message}`
    );
  }
};

export function contexatenate(contract: string, invariants: string): string {
  /**
   * The context contract to be concatenated with the SUT and the invariants
   * contracts. It's a map that stores the number of times each SUT function
   * is called.
   */
  const context = `(define-map context (string-ascii 100) {
    called: uint
    ;; other data
  })

  (define-public (update-context (function-name (string-ascii 100)) (called uint))
    (ok (map-set context function-name {called: called})))`;

  return `${contract}\n\n${context}\n\n${invariants}`;
}

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
    throw new Error(
      "No path to Clarinet.toml manifest provided. Supply it immediately or face the relentless scrutiny of your contract's vulnerabilities."
    );
  }

  const manifestPath = manifestDir + "/Clarinet.toml";
  const contractsPath = manifestDir + "/contracts";

  console.log(`Using manifest path: ${manifestPath}`);

  const simnet = await initSimnet(manifestPath);

  const concatContractsList: string[] = [];

  const sutContractsInterfaces = getSimnetDeployerContractsInterfaces(simnet);

  // Get all the contracts from the interfaces.
  const sutContracts = Array.from(sutContractsInterfaces.keys());

  sutContracts.forEach((contract) => {
    // Get the source code of the SUT contract
    const sutContractSource = getSimnetContractSource(simnet, contract);
    // Get the source code of the invariants contract
    const invariantContractSource = getInvariantContractSource(
      contractsPath,
      contract
    );
    // Concatenate the contracts.
    const concatContractSource = contexatenate(
      sutContractSource!,
      invariantContractSource
    );
    // Get the name of the concatenated contract. This will be used for
    // the deployment
    const concatContractName = `${contract.split(".")[1]}_concat`;

    try {
      // Deploy the concatenated contract
      simnet.deployContract(
        concatContractName,
        concatContractSource,
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
    getSimnetDeployerContractsInterfaces(simnet)
  );

  const concatContractsAllFunctions = getFunctionsFromContractInterfaces(
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

  // Initialize the local context.
  const localContext: LocalContext = {};

  concatContractsSutFunctions.forEach((functions, contractName) => {
    localContext[contractName] = {};
    functions.forEach((f) => {
      localContext[contractName][f.name] = 0;
    });
  });

  // Initialize the Clarity context.
  concatContractsSutFunctions.forEach((fns, contractName) => {
    fns.forEach((fn) => {
      const { result: initialize } = simnet.callPublicFn(
        contractName,
        "update-context",
        [Cl.stringAscii(fn.name), Cl.uint(0)],
        simnet.deployer
      );
      const jsonResult = cvToJSON(initialize);
      if (!jsonResult.value || !jsonResult.success) {
        throw new Error(
          `Failed to initialize the context for function: ${fn.name}.`
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

          if (functions?.length === 0) {
            throw new Error(
              `No public functions found for the "${r.contractName
                .split(".")[1]
                .replace("_concat", "")}" contract.`
            );
          }
          if (invariantFunctions?.length === 0) {
            throw new Error(
              `No invariant functions found for the "${r.contractName
                .split(".")[1]
                .replace(
                  "_concat",
                  ""
                )}" contract. Beware, for your contract may be exposed to unforeseen issues.`
            );
          }
          const functionGenerator = fc.constantFrom(
            ...(functions as ContractInterfaceFunction[])
          );
          // FIXME: For invariants, we have to be able to pick a random
          // number of them (zero or more).
          const invariantFunctionGenerator = fc.constantFrom(
            ...(invariantFunctions as ContractInterfaceFunction[])
          );

          return fc
            .record({
              pickedFunction: functionGenerator,
              pickedInvariant: invariantFunctionGenerator,
            })
            .map((pickedFunctions) => ({ ...r, ...pickedFunctions }));
        })
        .chain((r) => {
          const functionArgsArb = generateArbitrariesForFunction(
            r.pickedFunction,
            Array.from(simnet.getAccounts().values())
          );

          const invariantArgsArb = generateArbitrariesForFunction(
            r.pickedInvariant,
            Array.from(simnet.getAccounts().values())
          );

          return fc
            .record({
              functionArgsArb: fc.tuple(...functionArgsArb),
              invariantArgsArb: fc.tuple(...invariantArgsArb),
            })
            .map((args) => ({ ...r, ...args }));
        }),
      (r) => {
        const pickedFunctionArgs = argsToCV(
          r.pickedFunction,
          r.functionArgsArb
        );
        const pickedInvariantArgs = argsToCV(
          r.pickedInvariant,
          r.invariantArgsArb
        );

        const printedFunctionArgs = r.functionArgsArb
          .map((arg) => {
            try {
              return typeof arg === "object"
                ? JSON.stringify(arg)
                : arg.toString();
            } catch {
              return "[Circular]";
            }
          })
          .join(" ");

        const { result: functionCallResult } = simnet.callPublicFn(
          r.contractName,
          r.pickedFunction.name,
          pickedFunctionArgs,
          simnet.deployer
        );

        const functionCallResultJson = cvToJSON(functionCallResult);

        if (functionCallResultJson.success) {
          localContext[r.contractName][r.pickedFunction.name]++;

          simnet.callPublicFn(
            r.contractName,
            "update-context",
            [
              Cl.stringAscii(r.pickedFunction.name),
              Cl.uint(localContext[r.contractName][r.pickedFunction.name]),
            ],
            simnet.deployer
          );

          console.log(
            " ✔ ",
            r.contractName.split(".")[1].replace("_concat", ""),
            r.pickedFunction.name,
            printedFunctionArgs
          );
        } else {
          console.log(
            " ✗ ",
            r.contractName.split(".")[1].replace("_concat", ""),
            r.pickedFunction.name,
            printedFunctionArgs
          );
        }

        const printedInvariantArgs = r.invariantArgsArb
          .map((arg) => {
            try {
              return typeof arg === "object"
                ? JSON.stringify(arg)
                : arg.toString();
            } catch {
              return "[Circular]";
            }
          })
          .join(" ");

        console.log("\nChecking invariants...");

        const { result: invariantCallResult } = simnet.callReadOnlyFn(
          r.contractName,
          r.pickedInvariant.name,
          pickedInvariantArgs,
          simnet.deployer
        );

        const invariantCallResultJson = cvToJSON(invariantCallResult);

        console.log("🤺 " + r.pickedInvariant.name, printedInvariantArgs);
        console.log("\n");

        if (!invariantCallResultJson.value) {
          throw new Error(
            `Invariant failed for ${r.contractName
              .split(".")[1]
              .replace("_concat", "")} contract: "${
              r.pickedInvariant.name
            }" returned ${invariantCallResultJson.value}`
          );
        }
      }
    )
  );
}

if (require.main === module) {
  main();
}
