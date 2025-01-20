import { Simnet } from "@hirosystems/clarinet-sdk";
import {
  ContractInterfaceFunctionAccess,
  ContractInterfaceFunctionArg,
  ContractInterfaceFunctionOutput,
} from "@hirosystems/clarinet-sdk-wasm";
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
import fc from "fast-check";

// Types used for Clarity Value conversion.

export type EnrichedContractInterfaceFunction = {
  args: (
    | ContractInterfaceFunctionArg
    | {
        type: {
          trait_reference: TraitImportType;
        };
        name: string;
      }
  )[];
  name: string;
  access: ContractInterfaceFunctionAccess;
  outputs: ContractInterfaceFunctionOutput;
};

export type ResponseStatus = "ok" | "error";

export type TupleData<T extends ClarityValue = ClarityValue> = {
  [key: string]: T;
};

export type BaseTypesToCV = {
  int128: (arg: number) => ReturnType<typeof intCV>;
  uint128: (arg: number) => ReturnType<typeof uintCV>;
  bool: (arg: boolean) => ReturnType<typeof boolCV>;
  principal: (arg: string) => ReturnType<typeof principalCV>;
};

export type ComplexTypesToCV = {
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
  trait_reference: (trait: string) => ReturnType<typeof principalCV>;
};

// Types used for argument generation.
export type BaseTypeBeforeEnrich =
  | "int"
  | "uint"
  | "bool"
  | "principal"
  | "trait_reference";

export type BaseTypeAfterEnrich = "int128" | "uint128" | "bool" | "principal";

type ComplexTypeAfterEnrich =
  | { buffer: { length: number } }
  | { "string-ascii": { length: number } }
  | { "string-utf8": { length: number } }
  | { list: { type: EnrichedParameterType; length: number } }
  | { tuple: { name: string; type: EnrichedParameterType }[] }
  | { optional: EnrichedParameterType }
  | { response: { ok: EnrichedParameterType; error: EnrichedParameterType } }
  | { trait_reference: TraitImportType };

type ComplexTypeBeforeEnrich =
  | { buffer: { length: number } }
  | { "string-ascii": { length: number } }
  | { "string-utf8": { length: number } }
  | { list: { type: EnrichedParameterType; length: number } }
  | { tuple: { name: string; type: EnrichedParameterType }[] }
  | { optional: EnrichedParameterType }
  | { response: { ok: EnrichedParameterType; error: EnrichedParameterType } };

export type EnrichedParameterType =
  | BaseTypeAfterEnrich
  | ComplexTypeAfterEnrich;

export type ParameterTypeBeforeEnrich =
  | BaseTypeBeforeEnrich
  | ComplexTypeBeforeEnrich;

export type BaseTypesToArbitrary = {
  int128: ReturnType<typeof fc.integer>;
  uint128: ReturnType<typeof fc.nat>;
  bool: ReturnType<typeof fc.boolean>;
  principal: (addresses: string[]) => ReturnType<typeof fc.constantFrom>;
  // Trait reference is not yet supported. This is a placeholder.
  trait_reference: undefined;
};

export type ComplexTypesToArbitrary = {
  buffer: (length: number) => fc.Arbitrary<string>;
  "string-ascii": (length: number) => fc.Arbitrary<string>;
  "string-utf8": (length: number) => fc.Arbitrary<string>;
  list: (
    type: EnrichedParameterType,
    length: number,
    addresses: string[],
    simnet: Simnet
  ) => fc.Arbitrary<any[]>;
  tuple: (
    items: { name: string; type: EnrichedParameterType }[],
    addresses: string[],
    simnet: Simnet
  ) => fc.Arbitrary<object>;
  optional: (
    type: EnrichedParameterType,
    addresses: string[],
    simnet: Simnet
  ) => fc.Arbitrary<any>;
  response: (
    okType: EnrichedParameterType,
    errType: EnrichedParameterType,
    addresses: string[],
    simnet: Simnet
  ) => fc.Arbitrary<any>;
  trait_reference: (
    traitData: TraitImportType,
    simnet: Simnet
  ) => fc.Arbitrary<any>;
};

export type TraitImportType = {
  name: string;
  import: {
    Imported: {
      name: string;
      contract_identifier: { issuer: Array<any>; name: string };
    };
  };
};
