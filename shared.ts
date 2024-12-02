import fc from "fast-check";
import {
  BaseType,
  BaseTypesToArbitrary,
  BaseTypesToCV,
  ComplexTypesToArbitrary,
  ComplexTypesToCV,
  ParameterType,
  ResponseStatus,
  TupleData,
} from "./shared.types";
import {
  boolCV,
  bufferCV,
  ClarityValue,
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
import { Simnet } from "@hirosystems/clarinet-sdk";
import {
  ContractInterfaceFunction,
  IContractInterface,
} from "@hirosystems/clarinet-sdk-wasm";
import { join } from "path";
import fs, { readFileSync } from "fs";
import { ClarinetToml } from "./citizen.types";

// TODO: Move to `citizen.ts`.
/**
 * Get contract source code from the simnet.
 * @param clarinetToml The parsed Clarinet.toml file.
 * @param manifestDir The relative path to the manifest directory.
 * @param sutContractName The target contract name.
 * @returns The contract source code.
 */
export const getClarinetTomlContractSource = (
  clarinetToml: ClarinetToml,
  manifestDir: string,
  sutContractName: string
) => {
  const contractInfo = clarinetToml.contracts[sutContractName];
  if (contractInfo == undefined) {
    throw new Error(
      `Contract ${sutContractName} not found in the Clarinet.toml.`
    );
  }
  return readFileSync(join(manifestDir, contractInfo.path)).toString();
  // if (simnet.getContractSource(sutContractId) === undefined)
  //   throw new Error(`Contract ${sutContractId} not found in the network.`);
  // return simnet.getContractSource(sutContractId);
};

/**
 * Get the interfaces of contracts deployed by the specified deployer from the
 * simnet.
 * @param simnet The simnet instance.
 * @param deployer The deployer address.
 * @returns The contracts interfaces.
 */
export const getSimnetDeployerContractsInterfaces = (
  simnet: Simnet
): Map<string, IContractInterface> =>
  new Map(
    Array.from(simnet.getContractsInterfaces()).filter(
      ([key]) => key.split(".")[0] === simnet.deployer
    )
  );

/**
 * Get the functions from the smart contract interfaces.
 * @param contractsInterfaces The smart contract interfaces map.
 * @returns A map containing the contracts functions.
 */
export const getFunctionsFromContractInterfaces = (
  contractsInterfaces: Map<string, IContractInterface>
): Map<string, ContractInterfaceFunction[]> =>
  new Map(
    Array.from(contractsInterfaces, ([contractId, contractInterface]) => [
      contractId,
      contractInterface.functions,
    ])
  );

export const getFunctionsListForContract = (
  functionsMap: Map<string, ContractInterfaceFunction[]>,
  contractId: string
): ContractInterfaceFunction[] => functionsMap.get(contractId) || [];

/** For a given function, dynamically generate fast-check arbitraries.
 * @param fn ContractInterfaceFunction
 * @returns Array of fast-check arbitraries
 */
export const functionToArbitrary = (
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

/** The character set used for generating ASCII strings.*/
const charSet =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 !\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~";

/**
 * Convert function arguments to Clarity values.
 * @param fn ContractFunction.
 * @param args Array of arguments.
 * @returns Array of Clarity values.
 */
export const argsToCV = (fn: ContractInterfaceFunction, args: any[]) => {
  return fn.args.map((arg, i) => argToCV(args[i], arg.type as ParameterType));
};

/**
 * Convert a function argument to a Clarity value.
 * @param arg Generated argument.
 * @param type Argument type (base or complex).
 * @returns Clarity value.
 */
const argToCV = (arg: any, type: ParameterType): ClarityValue => {
  if (isBaseType(type)) {
    // Base type.
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
    // Complex type.
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
  return ["int128", "uint128", "bool", "principal"].includes(type as BaseType);
};

/**
 * Get the test contract source code.
 * @param contractsPath The relative path to the contracts directory.
 * @param sutContractName The target contract name.
 * @returns The test contract source code.
 */
export const getTestContractSource = (
  contractsPath: string,
  sutContractName: string
) => {
  // FIXME: Here, we can encounter a failure if the contract file name is
  // not the same as the contract name in the manifest.
  // Example:
  // - Contract name in the manifest: [contracts.counter-xyz]
  // - Contract file name: path = "contracts/counter.clar"
  const testContractName = `${sutContractName}.tests.clar`;
  const testContractPath = join(contractsPath, testContractName);
  try {
    return fs.readFileSync(testContractPath).toString();
  } catch (e: any) {
    throw new Error(
      `Error retrieving the corresponding test contract for the "${sutContractName}" contract. ${e.message}`
    );
  }
};

/**
 * Schedule a Rendezvous between the System Under Test (`SUT`) and the
 * invariants.
 * @param contract The SUT contract source code.
 * @param invariants The invariants contract source code.
 * @returns The Rendezvous source code.
 */
export function scheduleRendezvous(
  contract: string,
  invariants: string
): string {
  /**
   * The `context` map tracks how many times each function has been called.
   * This data can be useful for invariant tests to check behavior over time.
   */
  const context = `(define-map context (string-ascii 100) {
    called: uint
    ;; other data
  })

  (define-public (update-context (function-name (string-ascii 100)) (called uint))
    (ok (map-set context function-name {called: called})))`;

  return `${contract}\n\n${context}\n\n${invariants}`;
}

// TODO: Move to `citizen.ts`.
/**
 * Build the Rendezvous data.
 * @param clarinetToml The parsed Clarinet.toml file.
 * @param contractName The contract name.
 * @param manifestDir The relative path to the manifest directory.
 * @returns The Rendezvous data representing an object. The returned object
 * contains the Rendezvous source code and the Rendezvous contract name.
 */
export const buildRendezvousData = (
  clarinetToml: ClarinetToml,
  contractName: string,
  manifestDir: string
) => {
  try {
    const sutContractSource = getClarinetTomlContractSource(
      clarinetToml,
      manifestDir,
      contractName
    );

    const testContractSource = getTestContractSource(
      join(manifestDir, "contracts"),
      contractName
    );

    const rendezvousSource = scheduleRendezvous(
      sutContractSource!,
      testContractSource
    );

    return {
      rendezvousSource: rendezvousSource,
      rendezvousContractName: contractName,
    };
  } catch (e: any) {
    throw new Error(
      `Error processing contract ${contractName.split(".")[1]}: ${e.message}`
    );
  }
};
