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
};

// Types used for argument generation.

export type BaseType =
  | "int128"
  | "uint128"
  | "bool"
  | "principal"
  | "trait_reference";

type ComplexType =
  | { buffer: { length: number } }
  | { "string-ascii": { length: number } }
  | { "string-utf8": { length: number } }
  | { list: { type: ParameterType; length: number } }
  | { tuple: { name: string; type: ParameterType }[] }
  | { optional: ParameterType }
  | { response: { ok: ParameterType; error: ParameterType } };

export type ParameterType = BaseType | ComplexType;

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
