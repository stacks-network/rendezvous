/**
 * The trait reference structure, as it appears in the AST under the
 * `implemented_traits` field.
 */
export type ImplementedTraitType = {
  name: string;
  contract_identifier: { issuer: number[]; name: string };
};

/**
 * The trait reference structure, as it appears in the AST under a
 * `TraitReference` node. This is used to represent the `trait_reference`
 * import data.
 */
export type ImportedTraitType = {
  name: string;
  import: {
    Imported: {
      name: string;
      contract_identifier: { issuer: Array<any>; name: string };
    };
  };
};
