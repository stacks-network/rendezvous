/**
 * The trait reference structure, as it appears in the AST under the
 * `implemented_traits` field.
 */
export type ImplementedTraitType = {
  name: string;
  contract_identifier: { issuer: number[]; name: string };
};

/**
 * The imported trait reference structure, as it appears in the AST under a
 * `TraitReference` node. Used to represent the `trait_reference` data for an
 * imported trait `(use-trait <contract_id>.<trait_name>)`.
 */
export type ImportedTraitType = {
  name: string;
  import: {
    Imported: TraitData;
  };
};

/**
 * The defined trait reference structure, as it appears in the AST under a
 * `TraitReference` node. Used to represent the `trait_reference` data for a
 * defined trait `(define-trait <trait_name> (<trait_definition>))`.
 */
export type DefinedTraitType = {
  name: string;
  import: {
    Defined: TraitData;
  };
};

type TraitData = {
  name: string;
  contract_identifier: { issuer: Array<any>; name: string };
};
