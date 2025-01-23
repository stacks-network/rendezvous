import fc from "fast-check";
import {
  BaseTypeAfterEnrich,
  BaseTypesToArbitrary,
  BaseTypesToCV,
  ComplexTypesToArbitrary,
  ComplexTypesToCV,
  EnrichedContractInterfaceFunction,
  EnrichedParameterType,
  ResponseStatus,
  TupleData,
} from "./shared.types";
import { Simnet } from "@hirosystems/clarinet-sdk";
import {
  ContractInterfaceFunction,
  IContractInterface,
} from "@hirosystems/clarinet-sdk-wasm";
import {
  Cl,
  ClarityValue,
  optionalCVOf,
  principalCV,
  responseErrorCV,
  responseOkCV,
} from "@stacks/transactions";
import { getContractIdsImplementingTrait } from "./traits";
import { ImplementedTraitType, ImportedTraitType } from "./traits.types";

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
  functionsMap: Map<string, any[]>,
  contractId: string
) => functionsMap.get(contractId) || [];

/** For a given function, dynamically generate fast-check arbitraries.
 * @param fn The function interface.
 * @returns Array of fast-check arbitraries.
 */
export const functionToArbitrary = (
  fn: EnrichedContractInterfaceFunction,
  addresses: string[],
  projectTraitImplementations: Record<string, ImplementedTraitType[]>
): fc.Arbitrary<any>[] =>
  fn.args.map((arg) =>
    parameterTypeToArbitrary(
      arg.type as EnrichedParameterType,
      addresses,
      projectTraitImplementations
    )
  );

/**
 * For a given type, generate a fast-check arbitrary.
 * @param type The parameter type.
 * @returns Fast-check arbitrary.
 */
const parameterTypeToArbitrary = (
  type: EnrichedParameterType,
  addresses: string[],
  projectTraitImplementations: Record<string, ImplementedTraitType[]>
): fc.Arbitrary<any> => {
  if (typeof type === "string") {
    // The type is a base type.
    if (type === "principal") {
      if (addresses.length === 0)
        throw new Error(
          "No addresses could be retrieved from the simnet instance!"
        );
      return baseTypesToArbitrary.principal(addresses);
    } else return baseTypesToArbitrary[type];
  } else {
    // The type is a complex type.
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
        addresses,
        projectTraitImplementations
      );
    } else if ("tuple" in type) {
      return complexTypesToArbitrary["tuple"](
        type.tuple,
        addresses,
        projectTraitImplementations
      );
    } else if ("optional" in type) {
      return complexTypesToArbitrary["optional"](
        type.optional,
        addresses,
        projectTraitImplementations
      );
    } else if ("response" in type) {
      return complexTypesToArbitrary.response(
        type.response.ok,
        type.response.error,
        addresses,
        projectTraitImplementations
      );
    } else if ("trait_reference" in type) {
      return complexTypesToArbitrary.trait_reference(
        type.trait_reference,
        projectTraitImplementations
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
  trait_reference: undefined,
};

/**
 * Custom hexadecimal string generator. The `hexaString` generator from
 * fast-check has been deprecated. This generator is implemented to precisely
 * match the behavior of the deprecated generator.
 *
 * @param constraints Fast-check string constraints.
 * @returns Fast-check arbitrary for hexadecimal strings.
 *
 * Reference for the proposed replacement of the deprecated `hexaString`
 * generator:
 * https://github.com/dubzzz/fast-check/commit/3f4f1203a8863c07d22b45591bf0de1fac02b948
 */
export const hexaString = (
  constraints: fc.StringConstraints = {}
): fc.Arbitrary<string> => {
  const hexa = (): fc.Arbitrary<string> => {
    const hexCharSet = "0123456789abcdef";
    return fc.integer({ min: 0, max: 15 }).map((n) => hexCharSet[n]);
  };

  return fc.string({ ...constraints, unit: hexa() });
};

/**
 * Complex types to fast-check arbitraries mapping.
 */
const complexTypesToArbitrary: ComplexTypesToArbitrary = {
  // For buffer types, the length must be doubled because they are represented
  // in hex. The `argToCV` function expects this format for `buff` ClarityValue
  // conversion. The UInt8Array will have half the length of the corresponding
  // hex string. Stacks.js reference:
  // https://github.com/hirosystems/stacks.js/blob/fd0bf26b5f29fc3c1bf79581d0ad9b89f0d7f15a/packages/common/src/utils.ts#L522
  buffer: (length: number) => hexaString({ maxLength: 2 * length }),
  "string-ascii": (length: number) =>
    fc.string({
      unit: fc.constantFrom(...charSet),
      maxLength: length,
    }),
  "string-utf8": (length: number) => fc.string({ maxLength: length }),
  list: (
    type: EnrichedParameterType,
    length: number,
    addresses: string[],
    projectTraitImplementations: Record<string, ImplementedTraitType[]>
  ) =>
    fc.array(
      parameterTypeToArbitrary(type, addresses, projectTraitImplementations),
      {
        maxLength: length,
      }
    ),
  tuple: (
    items: { name: string; type: EnrichedParameterType }[],
    addresses: string[],
    projectTraitImplementations: Record<string, ImplementedTraitType[]>
  ) => {
    const tupleArbitraries: { [key: string]: fc.Arbitrary<any> } = {};
    items.forEach((item) => {
      tupleArbitraries[item.name] = parameterTypeToArbitrary(
        item.type,
        addresses,
        projectTraitImplementations
      );
    });
    return fc.record(tupleArbitraries);
  },
  optional: (
    type: EnrichedParameterType,
    addresses: string[],
    projectTraitImplementations: Record<string, ImplementedTraitType[]>
  ) =>
    fc.option(
      parameterTypeToArbitrary(type, addresses, projectTraitImplementations)
    ),
  response: (
    okType: EnrichedParameterType,
    errType: EnrichedParameterType,
    addresses: string[],
    projectTraitImplementations: Record<string, ImplementedTraitType[]>
  ) =>
    fc.oneof(
      fc.record({
        status: fc.constant("ok"),
        value: parameterTypeToArbitrary(
          okType,
          addresses,
          projectTraitImplementations
        ),
      }),
      fc.record({
        status: fc.constant("error"),
        value: parameterTypeToArbitrary(
          errType,
          addresses,
          projectTraitImplementations
        ),
      })
    ),
  trait_reference: (
    traitData: ImportedTraitType,
    projectTraitImplementations: Record<string, ImplementedTraitType[]>
  ) => {
    return fc.constantFrom(
      ...getContractIdsImplementingTrait(traitData, projectTraitImplementations)
    );
  },
};

/** The character set used for generating ASCII strings.*/
const charSet =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 !\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~";

/**
 * Convert function arguments to Clarity values.
 * @param fn The function interface.
 * @param args Array of arguments.
 * @returns Array of Clarity values.
 */
export const argsToCV = (fn: EnrichedContractInterfaceFunction, args: any[]) =>
  fn.args.map((arg, i) => argToCV(args[i], arg.type as EnrichedParameterType));

/**
 * Convert a function argument to a Clarity value.
 * @param arg Generated argument.
 * @param type Argument type (base or complex).
 * @returns Clarity value.
 */
const argToCV = (arg: any, type: EnrichedParameterType): ClarityValue => {
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
        throw new Error(`Unsupported base parameter type: ${type}`);
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
    } else if ("trait_reference" in type) {
      return complexTypesToCV.trait_reference(arg);
    } else {
      throw new Error(
        `Unsupported complex parameter type: ${JSON.stringify(type)}`
      );
    }
  }
};

/**
 * Base types to Clarity values mapping.
 */
const baseTypesToCV: BaseTypesToCV = {
  int128: (arg: number) => Cl.int(arg),
  uint128: (arg: number) => Cl.uint(arg),
  bool: (arg: boolean) => Cl.bool(arg),
  principal: (arg: string) => Cl.principal(arg),
};

/**
 * Complex types to Clarity values mapping.
 */
const complexTypesToCV: ComplexTypesToCV = {
  buffer: (arg: string) => Cl.bufferFromHex(arg),
  "string-ascii": (arg: string) => Cl.stringAscii(arg),
  "string-utf8": (arg: string) => Cl.stringUtf8(arg),
  list: (items: ClarityValue[]) => {
    return Cl.list(items);
  },
  tuple: (tupleData: TupleData<ClarityValue>) => {
    return Cl.tuple(tupleData);
  },
  optional: (arg: ClarityValue | null) =>
    arg ? optionalCVOf(arg) : optionalCVOf(undefined),
  response: (status: ResponseStatus, value: ClarityValue) => {
    if (status === "ok") return responseOkCV(value);
    else if (status === "error") return responseErrorCV(value);
    else throw new Error(`Unsupported response status: ${status}`);
  },
  trait_reference: (traitImplementation: string) =>
    principalCV(traitImplementation),
};

const isBaseType = (
  type: EnrichedParameterType
): type is BaseTypeAfterEnrich => {
  return ["int128", "uint128", "bool", "principal"].includes(
    type as BaseTypeAfterEnrich
  );
};

export const getContractNameFromContractId = (contractId: string): string =>
  contractId.split(".")[1];
