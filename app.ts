// Single file (app.ts) is flexible, keeps git history clean. Better early on.
// Multiple files improve organization, readability, and collaboration as the project grows.
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
import fc, { VerbosityLevel } from "fast-check";
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
    fc.array(parameterTypeToArbitrary(type, addresses), { maxLength: length }),
  tuple: (
    items: { name: string; type: ParameterType }[],
    addresses: string[]
  ) => {
    const tupleArbitraries: { [key: string]: fc.Arbitrary<any> } = {};
    items.forEach((item) => {
      tupleArbitraries[item.name] = parameterTypeToArbitrary(
        item.type,
        addresses
      );
    });
    return fc.record(tupleArbitraries);
  },
  optional: (type: ParameterType, addresses: string[]) =>
    fc.option(parameterTypeToArbitrary(type, addresses)),
  response: (
    okType: ParameterType,
    errType: ParameterType,
    addresses: string[]
  ) =>
    fc.oneof(
      fc.record({
        status: fc.constant("ok"),
        value: parameterTypeToArbitrary(okType, addresses),
      }),
      fc.record({
        status: fc.constant("error"),
        value: parameterTypeToArbitrary(errType, addresses),
      })
    ),
};

/** For a given function, dynamically generate fast-check arbitraries.
 * @param fn ContractInterfaceFunction
 * @returns Array of fast-check arbitraries
 */
const functionToArbitrary = (
  fn: ContractInterfaceFunction,
  addresses: string[]
): fc.Arbitrary<any>[] =>
  fn.args.map((arg) =>
    parameterTypeToArbitrary(arg.type as ParameterType, addresses)
  );

/**
 * For a given type, generate a fast-check arbitrary.
 * @param type
 * @returns fast-check arbitrary
 */
const parameterTypeToArbitrary = (
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
 * Filter the Rendezvous interfaces from the contracts interfaces map.
 * @param contractsInterfaces The contracts interfaces map.
 * @returns The Rendezvous interfaces.
 */
export const filterRendezvousInterfaces = (
  contractsInterfaces: Map<string, ContractInterface>
) =>
  new Map(
    Array.from(contractsInterfaces).filter(([contractName]) =>
      contractName.endsWith("_rendezvous")
    )
  );

/**
 * Get the functions from the smart contract interfaces.
 * @param contractsInterfaces The smart contract interfaces map.
 * @returns A map containing the contracts functions.
 */
export const getFunctionsFromContractInterfaces = (
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
export const getSimnetContractSource = (
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
export const getInvariantContractSource = (
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

/**
 * Derive the Rendezvous name.
 * @param contract The contract name.
 * @returns The Rendezvous name.
 */
export const deriveRendezvousName = (contract: string) =>
  `${contract.split(".")[1]}_rendezvous`;

/**
 * Get the contract name from the Rendezvous name.
 * @param rendezvousName The Rendezvous name.
 * @returns The contract name.
 */
export const getContractNameFromRendezvousName = (rendezvousName: string) =>
  rendezvousName.split(".")[1].replace("_rendezvous", "");

export function scheduleRendezvous(
  contract: string,
  invariants: string
): string {
  /**
   * The context is like the secret sauce for a successful rendez-vous. It can
   * totally change the conversation from "meh" to "wow" and set the mood for
   * a legendary chat. Handle with care!
   */
  const context = `(define-map context (string-ascii 100) {
    called: uint
    ;; other data
  })

  (define-public (update-context (function-name (string-ascii 100)) (called uint))
    (ok (map-set context function-name {called: called})))`;

  return `${contract}\n\n${context}\n\n${invariants}`;
}

/**
 * Build the Rendezvous data.
 * @param simnet The simnet instance.
 * @param contractName The contract name.
 * @param contractsPath The contracts path.
 * @returns The Rendezvous data.
 */
export const buildRendezvousData = (
  simnet: Simnet,
  contractName: string,
  contractsPath: string
) => {
  try {
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
      fullContractName: `${simnet.deployer}.${rendezvousName}`,
    };
  } catch (e: any) {
    throw new Error(`Error processing contract ${contractName}: ${e.message}`);
  }
};

/**
 * Initialize the local context, setting the number of times each function
 * has been called to zero.
 * @param rendezvousSutFunctions The Rendezvous functions.
 * @returns The initialized local context.
 */
export const initializeLocalContext = (
  rendezvousSutFunctions: Map<string, ContractInterfaceFunction[]>
): LocalContext =>
  Object.fromEntries(
    Array.from(rendezvousSutFunctions.entries()).map(
      ([contractName, functions]) => [
        contractName,
        Object.fromEntries(functions.map((f) => [f.name, 0])),
      ]
    )
  );

export const initializeClarityContext = (
  simnet: Simnet,
  rendezvousSutFunctions: Map<string, ContractInterfaceFunction[]>
) =>
  rendezvousSutFunctions.forEach((fns, contractName) => {
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

/**
 * Deploy the Rendezvous to the simnet.
 * @param simnet The simnet instance.
 * @param rendezvousName The Rendezvous name.
 * @param rendezvousSource The Rendezvous source code.
 */
export const deployRendezvous = (
  simnet: Simnet,
  rendezvousName: string,
  rendezvousSource: string
) => {
  try {
    simnet.deployContract(
      rendezvousName,
      rendezvousSource,
      { clarityVersion: 2 },
      simnet.deployer
    );
  } catch (e: any) {
    throw new Error(
      `Something went wrong. Please double check the invariants contract: ${rendezvousName.replace(
        "_rendezvous",
        ""
      )}.invariant.clar:\n${e}`
    );
  }
};

export const getFunctionsListForContract = (
  functionsMap: Map<string, ContractInterfaceFunction[]>,
  contractName: string
) => functionsMap.get(contractName) || [];

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
      "No path to Clarinet project provided. Supply it immediately or face the relentless scrutiny of your contract's vulnerabilities."
    );
  }

  const manifestPath = manifestDir + "/Clarinet.toml";
  const contractsPath = manifestDir + "/contracts";

  console.log(`Using manifest path: ${manifestPath}`);

  const simnet = await initSimnet(manifestPath);

  const sutContractsInterfaces = getSimnetDeployerContractsInterfaces(simnet);

  // Get all the contracts from the interfaces.
  const sutContracts = Array.from(sutContractsInterfaces.keys());

  const rendezvousData = sutContracts.map((contractName) =>
    buildRendezvousData(simnet, contractName, contractsPath)
  );

  const rendezvousList = rendezvousData.map((contractData) => {
    deployRendezvous(
      simnet,
      contractData.rendezvousName,
      contractData.rendezvousSource
    );
    return contractData.fullContractName;
  });

  const rendezvousInterfaces = filterRendezvousInterfaces(
    getSimnetDeployerContractsInterfaces(simnet)
  );

  const rendezvousAllFunctions =
    getFunctionsFromContractInterfaces(rendezvousInterfaces);

  // A map where the keys are the Rendezvous names and the values
  // are arrays of their SUT (System Under Test) functions.
  const rendezvousSutFunctions = filterSutFunctions(rendezvousAllFunctions);

  // A map where the keys are the Rendezvous names and the values
  // are arrays of their invariant functions.
  const rendezvousInvariantFunctions = filterInvariantFunctions(
    rendezvousAllFunctions
  );

  // Initialize the local context.
  const localContext = initializeLocalContext(rendezvousSutFunctions);

  // Initialize the Clarity context.
  initializeClarityContext(simnet, rendezvousSutFunctions);

  fc.assert(
    fc.property(
      fc
        .record({
          contractName: fc.constantFrom(...rendezvousList),
          sutCaller: fc.constantFrom(
            ...new Map(
              [...simnet.getAccounts()].filter(([key]) => key !== "faucet")
            ).entries()
          ),
          invariantCaller: fc.constantFrom(
            ...new Map(
              [...simnet.getAccounts()].filter(([key]) => key !== "faucet")
            ).entries()
          ),
        })
        .chain((r) => {
          const functions = getFunctionsListForContract(
            rendezvousSutFunctions,
            r.contractName
          );
          const invariantFunctions = getFunctionsListForContract(
            rendezvousInvariantFunctions,
            r.contractName
          );

          if (functions?.length === 0) {
            throw new Error(
              `No public functions found for the "${getContractNameFromRendezvousName(
                r.contractName
              )}" contract.`
            );
          }
          if (invariantFunctions?.length === 0) {
            throw new Error(
              `No invariant functions found for the "${getContractNameFromRendezvousName(
                r.contractName
              )}" contract. Beware, for your contract may be exposed to unforeseen issues.`
            );
          }
          const functionArbitrary = fc.constantFrom(
            ...(functions as ContractInterfaceFunction[])
          );
          // FIXME: For invariants, we have to be able to select a random
          // number of them (zero or more).
          const invariantFunctionArbitrary = fc.constantFrom(
            ...(invariantFunctions as ContractInterfaceFunction[])
          );

          return fc
            .record({
              selectedFunction: functionArbitrary,
              selectedInvariant: invariantFunctionArbitrary,
            })
            .map((selectedFunctions) => ({ ...r, ...selectedFunctions }));
        })
        .chain((r) => {
          const functionArgsArb = functionToArbitrary(
            r.selectedFunction,
            Array.from(simnet.getAccounts().values())
          );

          const invariantArgsArb = functionToArbitrary(
            r.selectedInvariant,
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
        const selectedFunctionArgs = argsToCV(
          r.selectedFunction,
          r.functionArgsArb
        );
        const selectedInvariantArgs = argsToCV(
          r.selectedInvariant,
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
          r.selectedFunction.name,
          selectedFunctionArgs,
          r.sutCaller[1]
        );

        const functionCallResultJson = cvToJSON(functionCallResult);

        if (functionCallResultJson.success) {
          localContext[r.contractName][r.selectedFunction.name]++;

          simnet.callPublicFn(
            r.contractName,
            "update-context",
            [
              Cl.stringAscii(r.selectedFunction.name),
              Cl.uint(localContext[r.contractName][r.selectedFunction.name]),
            ],
            simnet.deployer
          );

          console.log(
            " ✔ ",
            r.sutCaller[0],
            getContractNameFromRendezvousName(r.contractName),
            r.selectedFunction.name,
            printedFunctionArgs
          );
        } else {
          console.log(
            " ✗ ",
            r.sutCaller[0],
            getContractNameFromRendezvousName(r.contractName),
            r.selectedFunction.name,
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
          r.selectedInvariant.name,
          selectedInvariantArgs,
          r.invariantCaller[1]
        );

        const invariantCallResultJson = cvToJSON(invariantCallResult);

        console.log(
          "🤺 ",
          r.invariantCaller[0],
          r.selectedInvariant.name,
          printedInvariantArgs
        );
        console.log("\n");

        if (!invariantCallResultJson.value) {
          throw new Error(
            `Invariant failed for ${getContractNameFromRendezvousName(
              r.contractName
            )} contract: "${r.selectedInvariant.name}" returned ${
              invariantCallResultJson.value
            }`
          );
        }
      }
    ),
    { verbose: VerbosityLevel.VeryVerbose }
  );
}

if (require.main === module) {
  main();
}
