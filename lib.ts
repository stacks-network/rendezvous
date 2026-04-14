import type { Simnet } from "@stacks/clarinet-sdk";
import type { ContractInterfaceFunction } from "@stacks/clarinet-sdk-wasm";
import type { ClarityValue } from "@stacks/transactions";
import fc from "fast-check";

import { argsToCV, functionToArbitrary } from "./shared";
import type { EnrichedContractInterfaceFunction } from "./shared.types";
import {
  buildTraitReferenceMap,
  enrichInterfaceWithTraitData,
  extractProjectTraitImplementations,
  isTraitReferenceFunction,
} from "./traits";

export type { EnrichedContractInterfaceFunction } from "./shared.types";

/**
 * Retrieves a function interface from a simnet contract by name. The returned
 * interface is enriched with trait reference data when applicable, making it
 * ready for use with {@link strategyFor}.
 *
 * @param simnet The simnet instance.
 * @param contractName The contract name (e.g., "counter").
 * @param functionName The function name (e.g., "increment").
 * @param deployer The deployer address. Defaults to `simnet.deployer`.
 * @returns The enriched function interface.
 *
 * @example
 * ```ts
 * const simnet = await initSimnet("./Clarinet.toml");
 * const increment = getContractFunction(simnet, "counter", "increment");
 * ```
 */
export const getContractFunction = (
  simnet: Simnet,
  contractName: string,
  functionName: string,
  deployer?: string,
): EnrichedContractInterfaceFunction => {
  const targetDeployer = deployer ?? simnet.deployer;
  const allContracts = simnet.getContractsInterfaces();

  const contractId = `${targetDeployer}.${contractName}`;
  const contractInterface = allContracts.get(contractId);

  if (!contractInterface) {
    throw new Error(`Contract "${contractId}" not found.`);
  }

  const fn = contractInterface.functions.find(
    (f: ContractInterfaceFunction) => f.name === functionName,
  );

  if (!fn) {
    throw new Error(
      `Function "${functionName}" not found in contract "${contractName}".`,
    );
  }

  // Enrich with trait data if the function uses trait references.
  if (isTraitReferenceFunction(fn)) {
    const traitReferenceMap = buildTraitReferenceMap([fn]);
    const enriched = enrichInterfaceWithTraitData(
      simnet.getContractAST(contractName),
      traitReferenceMap,
      [fn],
      contractId,
    );
    return enriched.get(contractId)![0];
  }

  return fn as EnrichedContractInterfaceFunction;
};

/**
 * Generates a fast-check arbitrary that produces `ClarityValue[]` arrays
 * ready for use with `simnet.callPublicFn` or similar.
 *
 * Automatically resolves principal addresses and trait implementations from
 * the simnet instance.
 *
 * @param fn The enriched function interface (from {@link getContractFunction}).
 * @param simnet The simnet instance.
 * @returns A fast-check arbitrary producing Clarity argument arrays.
 *
 * @example
 * ```ts
 * import fc from "fast-check";
 * import { initSimnet } from "@stacks/clarinet-sdk";
 * import { getContractFunction, strategyFor } from "@stacks/rendezvous";
 *
 * const simnet = await initSimnet("./Clarinet.toml");
 * const increment = getContractFunction(simnet, "counter", "increment");
 * const argsArb = strategyFor(increment, simnet);
 *
 * fc.assert(
 *   fc.asyncProperty(argsArb, async (args) => {
 *     const { result } = simnet.callPublicFn(
 *       "deployer.counter", "increment", args, "deployer"
 *     );
 *     return result.type !== "err";
 *   })
 * );
 * ```
 */
export const strategyFor = (
  fn: EnrichedContractInterfaceFunction,
  simnet: Simnet,
): fc.Arbitrary<ClarityValue[]> => {
  const allAddresses = [...simnet.getAccounts().values()];
  const projectTraitImplementations =
    extractProjectTraitImplementations(simnet);

  const arbitraries = functionToArbitrary(
    fn,
    allAddresses,
    projectTraitImplementations,
  );

  if (arbitraries.length === 0) {
    return fc.constant([]);
  }

  return fc
    .tuple(...arbitraries)
    .map((generated: unknown[]) => argsToCV(fn, generated));
};
