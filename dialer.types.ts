import { ParsedTransactionResult } from "@hirosystems/clarinet-sdk";
import { ClarityValue } from "@stacks/transactions";
import { EnrichedContractInterfaceFunction } from "./shared.types";

export type Dialer = (context: DialerContext) => Promise<void> | void;

type DialerContext = {
  clarityValueArguments: ClarityValue[];
  functionCall: ParsedTransactionResult;
  selectedFunction: EnrichedContractInterfaceFunction;
};
