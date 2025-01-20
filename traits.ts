import {
  Atom,
  ContractInterfaceFunction,
  IContractAST,
  List,
  TraitReference,
} from "@hirosystems/clarinet-sdk-wasm";
import {
  EnrichedContractInterfaceFunction,
  ParameterTypeBeforeEnrich,
  TraitImportType,
} from "./shared.types";
import { Simnet } from "@hirosystems/clarinet-sdk";

// TODO: Should handle list, tuple, optional, response nesting.
export const enrichInterfaceWithTraitData = (
  ast: IContractAST,
  traitReferenceMap: Map<string, any>,
  functionInterfaceList: ContractInterfaceFunction[],
  targetContractId: string
): Map<string, EnrichedContractInterfaceFunction[]> => {
  const enriched = new Map<string, EnrichedContractInterfaceFunction[]>();

  const enrichListArgs = (
    listArg: any,
    functionName: string,
    paramMap: any,
    path: string[]
  ): any => {
    const currentPath = [...path, "list"];
    const [traitReferenceName, traitReferenceImport] = getTraitReferenceData(
      ast,
      functionName,
      currentPath
    );
    if (traitReferenceName && traitReferenceImport) {
      return {
        ...listArg,
        type: {
          trait_reference: {
            name: traitReferenceName,
            import: traitReferenceImport,
          },
        },
      };
    } else if (listArg.type && listArg.type.list) {
      return {
        ...listArg,
        type: {
          list: enrichListArgs(
            listArg.type.list,
            functionName,
            paramMap?.list,
            currentPath
          ),
        },
      };
    }
    return listArg;
  };

  const enrichArgs = (
    args: any[],
    functionName: string,
    paramMap: any,
    path: string[] = []
  ): any[] => {
    return args.map((arg) => {
      const currentPath = [...path, arg.name];
      if (arg.type && arg.type.tuple) {
        return {
          ...arg,
          type: {
            tuple: enrichArgs(
              arg.type.tuple,
              functionName,
              paramMap[arg.name]?.tuple,
              currentPath
            ),
          },
        };
      } else if (arg.type && arg.type.list) {
        return {
          ...arg,
          type: {
            list: enrichArgs(
              [arg.type.list],
              functionName,
              paramMap[arg.name].list,
              currentPath
            )[0],
          },
        };
      } else if (paramMap[arg.name]) {
        const [traitReferenceName, traitReferenceImport] =
          getTraitReferenceData(ast, functionName, currentPath);
        if (traitReferenceName && traitReferenceImport) {
          return {
            ...arg,
            type: {
              trait_reference: {
                name: traitReferenceName,
                import: traitReferenceImport,
              },
            },
          };
        }
      }
      return arg;
    });
  };

  const enrichedFunctions = functionInterfaceList.map((f) => {
    return {
      ...f,
      args: enrichArgs(f.args, f.name, traitReferenceMap.get(f.name)),
    };
  });

  enriched.set(targetContractId, enrichedFunctions);
  return enriched;
};

export const getTraitReferenceData = (
  ast: IContractAST,
  functionName: string,
  paramPath: string[]
): [string, any] | [undefined, undefined] => {
  const findTraitReference = (
    paramList: any[],
    path: string[]
  ): [string, any] | [undefined, undefined] => {
    for (const param of paramList) {
      if (param.expr && (param.expr as TraitReference).TraitReference) {
        const [name, importData] = (param.expr as TraitReference)
          .TraitReference;
        return [name, importData];
      }
      if (!param.expr || !(param.expr as List).List) continue;

      const paramNameNode = (param.expr as List).List[0];
      if (!paramNameNode || !(paramNameNode.expr as Atom).Atom) continue;

      const currentParamName = (paramNameNode.expr as Atom).Atom.toString();
      if (currentParamName === path[0]) {
        if (path.length === 1) {
          const traitReferenceNode = (param.expr as List).List[1];
          if (
            traitReferenceNode &&
            (traitReferenceNode.expr as TraitReference).TraitReference
          ) {
            const [name, importData] = (
              traitReferenceNode.expr as TraitReference
            ).TraitReference;
            return [name, importData];
          }
        } else {
          if (
            (param.expr as List).List[1] &&
            ((param.expr as List).List[1].expr as List)
          ) {
            const nestedParamList = (param.expr as List).List[1].expr as List;
            const result = findTraitReference(
              nestedParamList.List,
              path.slice(1)
            );
            if (result[0] !== undefined) return result;
          }
        }
      }
    }
    return [undefined, undefined];
  };

  for (const node of ast.expressions) {
    if (!node.expr || !(node.expr as List).List) continue;

    const functionList = (node.expr as List).List;
    const definePublicNode = functionList[0];
    if (
      !definePublicNode ||
      (definePublicNode.expr as Atom).Atom !== "define-public"
    )
      continue;

    const functionNameNode = functionList[1];
    if (!functionNameNode || !(functionNameNode.expr as List).List) continue;

    const functionDefinitionList = (functionNameNode.expr as List).List;
    const functionNameAtom = functionDefinitionList[0];
    if (!functionNameAtom || !(functionNameAtom.expr as Atom).Atom) continue;

    const currentFunctionName = (functionNameAtom.expr as Atom).Atom.toString();
    if (currentFunctionName !== functionName) continue;

    const params = functionDefinitionList.slice(1);
    const result = findTraitReference(params, paramPath);
    if (result[0] !== undefined) return result;
  }
  return [undefined, undefined];
};

export const buildTraitReferenceMap = (
  functionInterfaces: ContractInterfaceFunction[]
): Map<string, any> => {
  const traitReferenceMap = new Map<string, any>();

  const findTraitReferences = (args: any[]): any => {
    const traitReferences: any = {};
    args.forEach((arg) => {
      if (arg.type && arg.type.tuple) {
        const nestedTraitReferences = findTraitReferences(arg.type.tuple);
        if (Object.keys(nestedTraitReferences).length > 0) {
          traitReferences[arg.name] = { tuple: nestedTraitReferences };
        }
      } else if (arg.type && arg.type.list) {
        const nestedTraitReferences = findTraitReferences([arg.type.list]);
        if (Object.keys(nestedTraitReferences).length > 0) {
          traitReferences[arg.name] = { list: nestedTraitReferences };
        }
      } else if (arg.type === "trait_reference") {
        traitReferences[arg.name] = "trait_reference";
      }
    });
    return traitReferences;
  };

  functionInterfaces.forEach((fn) => {
    const traitReferences = findTraitReferences(fn.args);
    if (Object.keys(traitReferences).length > 0) {
      traitReferenceMap.set(fn.name, traitReferences);
    }
  });

  return traitReferenceMap;
};

export const getTraitReferencePath = (
  functionInterface: ContractInterfaceFunction
) => {
  const traitReferencePath: any = {};

  const extractTraitReference = (type: any): any => {
    if (typeof type === "string") {
      return type === "trait_reference" ? type : null;
    } else {
      if ("list" in type) return extractTraitReference(type.list.type);
      if ("tuple" in type) {
        const tupleReferences = type.tuple
          .map((item: any) => extractTraitReference(item.type))
          .filter((ref: any) => ref !== null);
        return tupleReferences.length > 0 ? tupleReferences : null;
      }
      if ("optional" in type) return extractTraitReference(type.optional);
      if ("response" in type) {
        const okRef = extractTraitReference(type.response.ok);
        const errorRef = extractTraitReference(type.response.error);
        return okRef || errorRef ? { ok: okRef, error: errorRef } : null;
      }
      return null;
    }
  };

  functionInterface.args.forEach((arg) => {
    const traitRef = extractTraitReference(arg.type);
    if (traitRef) {
      if (!traitReferencePath[arg.name]) {
        traitReferencePath[arg.name] = {};
      }
      traitReferencePath[arg.name] = "trait_reference";
    }
  });

  return traitReferencePath;
};

export const getContractIdsImplementingTrait = (
  trait: TraitImportType,
  simnet: Simnet
): string[] => {
  const contracts = [...simnet.getContractsInterfaces().keys()];
  const filteredContracts = contracts.filter((contractId) => {
    return (
      contractId.split(".")[0] !== "SP000000000000000000002Q6VF78" &&
      contractId.split(".")[0] !== "ST000000000000000000002AMW42H"
    );
  });

  const astRecord = filteredContracts.reduce<Record<string, IContractAST>>(
    (acc, contractId: string) => {
      // TODO: Move AST parsing to a pre-processing step.
      const ast = simnet.getContractAST(contractId);

      // Check if the trait is implemented based on properties.
      const implementsTrait = ast.implemented_traits.some(
        (implementedTrait: {
          name: string;
          contract_identifier: { issuer: object; name: string };
        }) => {
          return (
            implementedTrait.name === trait.import.Imported?.name &&
            JSON.stringify(implementedTrait.contract_identifier.issuer) ===
              JSON.stringify(trait.import.Imported?.contract_identifier.issuer)
          );
        }
      );

      if (implementsTrait) {
        acc[contractId] = ast;
      }
      return acc;
    },
    {}
  );

  return Object.keys(astRecord);
};

/**
 * Checks if any parameter of the function contains a `trait_reference` type.
 * @param fn The function interface.
 * @returns Boolean - true if the function contains a trait reference, false
 * otherwise.
 */
export const isTraitReferenceFunction = (
  fn: ContractInterfaceFunction
): boolean => {
  const hasTraitReference = (type: ParameterTypeBeforeEnrich): boolean => {
    if (typeof type === "string") {
      // The type is a base type.
      return type === "trait_reference";
    } else {
      // The type is a complex type.
      if ("buffer" in type) return false;
      if ("string-ascii" in type) return false;
      if ("string-utf8" in type) return false;
      if ("list" in type)
        return hasTraitReference(type.list.type as ParameterTypeBeforeEnrich);
      if ("tuple" in type)
        return type.tuple.some((item) =>
          hasTraitReference(item.type as ParameterTypeBeforeEnrich)
        );
      if ("optional" in type)
        return hasTraitReference(type.optional as ParameterTypeBeforeEnrich);
      if ("response" in type)
        return (
          hasTraitReference(type.response.ok as ParameterTypeBeforeEnrich) ||
          hasTraitReference(type.response.error as ParameterTypeBeforeEnrich)
        );
      // Default to false for unexpected types.
      return false;
    }
  };

  return fn.args.some((arg) =>
    hasTraitReference(arg.type as ParameterTypeBeforeEnrich)
  );
};
