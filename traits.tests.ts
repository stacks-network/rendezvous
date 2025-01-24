import {
  ContractInterfaceFunction,
  IContractAST,
} from "@hirosystems/clarinet-sdk-wasm";
import { initSimnet } from "@hirosystems/clarinet-sdk";
import { resolve } from "path";
import {
  buildTraitReferenceMap,
  enrichInterfaceWithTraitData,
  extractProjectTraitImplementations,
  getContractIdsImplementingTrait,
  isTraitReferenceFunction,
} from "./traits";

describe("Trait reference processing", () => {
  it("correctly builds the trait reference map for a direct trait that is the first parameter", () => {
    // Arrange
    const allFunctionsInterfaces = testInputs.directTrait1stParameter
      .functionsInterfaces as ContractInterfaceFunction[];

    const expected = new Map(
      Object.entries({
        "test-trait": { token: "trait_reference" },
      })
    );

    // Act
    const actual = buildTraitReferenceMap(allFunctionsInterfaces);

    // Assert
    expect(actual).toEqual(expected);
  });

  it("correctly builds the trait reference map for direct trait in two functions, public and read-only", () => {
    // Arrange
    const allFunctionsInterfaces = testInputs
      .directTraitParameterPublicAndReadOnlyFunctions
      .functionsInterfaces as ContractInterfaceFunction[];

    const expected = new Map(
      Object.entries({
        "test-trait": { token: "trait_reference" },
        "invariant-trait": { token: "trait_reference" },
      })
    );

    // Act
    const actual = buildTraitReferenceMap(allFunctionsInterfaces);

    // Assert
    expect(actual).toEqual(expected);
  });

  it("correctly builds the trait reference map for a direct trait that is the second parameter", () => {
    // Arrange
    const allFunctionsInterfaces = testInputs.directTrait2ndParameter
      .functionsInterfaces as ContractInterfaceFunction[];

    const expected = new Map(
      Object.entries({
        "test-trait": { token: "trait_reference" },
      })
    );

    // Act
    const actual = buildTraitReferenceMap(allFunctionsInterfaces);

    // Assert
    expect(actual).toEqual(expected);
  });

  it("correctly builds the trait reference map for a direct trait that is the fifth parameter", () => {
    // Arrange
    const allFunctionsInterfaces = testInputs.directTrait5thParameter
      .functionsInterfaces as ContractInterfaceFunction[];

    const expected = new Map(
      Object.entries({
        "test-trait": { e: "trait_reference" },
      })
    );

    // Act
    const actual = buildTraitReferenceMap(allFunctionsInterfaces);

    // Assert
    expect(actual).toEqual(expected);
  });

  it("correctly builds the trait reference map for a tuple nested trait that is the first parameter", () => {
    // Arrange
    const allFunctionsInterfaces = testInputs.tupleTraitParameter
      .functionsInterfaces as ContractInterfaceFunction[];

    const expected = new Map(
      Object.entries({
        "test-trait": {
          "tuple-param": { tuple: { token: "trait_reference" } },
        },
      })
    );

    // Act
    const actual = buildTraitReferenceMap(allFunctionsInterfaces);

    // Assert
    expect(actual).toEqual(expected);
  });

  it("correctly builds the trait reference map for a list nested trait", () => {
    // Arrange
    const allFunctionsInterfaces = testInputs.listTraitParameter
      .functionsInterfaces as ContractInterfaceFunction[];

    const expected = new Map(
      Object.entries({
        "test-trait": {
          "token-list": { list: "trait_reference" },
        },
      })
    );

    // Act
    const actual = buildTraitReferenceMap(allFunctionsInterfaces);

    // Assert
    expect(actual).toEqual(expected);
  });

  it("correctly builds the trait reference map for a response ok branch nested trait", () => {
    // Arrange
    const allFunctionsInterfaces = testInputs.responseOkTraitParameter
      .functionsInterfaces as ContractInterfaceFunction[];

    const expected = new Map(
      Object.entries({
        "test-trait": {
          "resp-trait-param": { response: { ok: "trait_reference" } },
        },
      })
    );

    // Act
    const actual = buildTraitReferenceMap(allFunctionsInterfaces);

    // Assert
    expect(actual).toEqual(expected);
  });

  it("correctly builds the trait reference map for a response error branch nested trait", () => {
    // Arrange
    const allFunctionsInterfaces = testInputs.responseErrTraitParameter
      .functionsInterfaces as ContractInterfaceFunction[];

    const expected = new Map(
      Object.entries({
        "test-trait": {
          "resp-trait-param": { response: { error: "trait_reference" } },
        },
      })
    );

    // Act
    const actual = buildTraitReferenceMap(allFunctionsInterfaces);

    // Assert
    expect(actual).toEqual(expected);
  });

  it("correctly builds the trait reference map for a response both branches nested trait", () => {
    // Arrange
    const allFunctionsInterfaces = testInputs.responseBothTraitParameter
      .functionsInterfaces as ContractInterfaceFunction[];

    const expected = new Map(
      Object.entries({
        "test-trait": {
          "resp-trait-param": {
            response: { ok: "trait_reference", error: "trait_reference" },
          },
        },
      })
    );

    // Act
    const actual = buildTraitReferenceMap(allFunctionsInterfaces);

    // Assert
    expect(actual).toEqual(expected);
  });

  it("correctly builds the trait reference map for an optional nested trait", () => {
    // Arrange
    const allFunctionsInterfaces = testInputs.optionalTraitParameter
      .functionsInterfaces as ContractInterfaceFunction[];

    const expected = new Map(
      Object.entries({
        "test-trait": {
          "opt-trait": {
            optional: "trait_reference",
          },
        },
      })
    );

    // Act
    const actual = buildTraitReferenceMap(allFunctionsInterfaces);

    // Assert
    expect(actual).toEqual(expected);
  });

  it("correctly builds the trait reference map for list-tuple nested traits", () => {
    // Arrange
    const allFunctionsInterfaces = testInputs.listTupleNestedTrait
      .functionsInterfaces as ContractInterfaceFunction[];

    const expected = new Map(
      Object.entries({
        "test-mixed-traits": {
          "list-tuple-trait": {
            list: { tuple: { "mad-inner": "trait_reference" } },
          },
        },
      })
    );

    // Act
    const actual = buildTraitReferenceMap(allFunctionsInterfaces);

    // Assert
    expect(actual).toEqual(expected);
  });

  it("correctly builds the trait reference map for mixed direct and nested traits", () => {
    // Arrange
    const allFunctionsInterfaces = testInputs.mixedDirectAndNestedTraits
      .functionsInterfaces as ContractInterfaceFunction[];

    const expected = new Map(
      Object.entries({
        "test-mixed-traits": {
          direct: "trait_reference",
          "list-1": { list: "trait_reference" },
          mad: {
            tuple: {
              "list-mad": {
                list: { tuple: { "mad-inner": "trait_reference" } },
              },
            },
          },
        },
      })
    );

    // Act
    const actual = buildTraitReferenceMap(allFunctionsInterfaces);

    // Assert
    expect(actual).toEqual(expected);
  });

  it("correctly enriches interface with trait reference data for a direct trait that is the first parameter", () => {
    // Arrange

    const allFunctionsInterfaces = (
      testInputs.directTrait1stParameter
        .functionsInterfaces as ContractInterfaceFunction[]
    ).filter((f) => f.name !== "update-context");

    const traitReferenceMap = buildTraitReferenceMap(allFunctionsInterfaces);

    const ast = testInputs.directTrait1stParameter.ast as any as IContractAST;

    const targetContractId = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.trait";

    const expected = new Map(
      Object.entries({
        [targetContractId]: [
          {
            name: "function",
            access: "public",
            args: [],
            outputs: {
              type: {
                response: {
                  error: "none",
                  ok: "bool",
                },
              },
            },
          },
          {
            name: "test-no-trait",
            access: "public",
            args: [],
            outputs: {
              type: {
                response: {
                  error: "none",
                  ok: "bool",
                },
              },
            },
          },
          {
            name: "test-trait",
            access: "public",
            args: [
              {
                name: "token",
                type: {
                  trait_reference: {
                    name: "ft-trait",
                    import: {
                      Imported: {
                        name: "sip-010-trait",
                        contract_identifier: {
                          name: "sip-010-trait-ft-standard",
                          issuer: [
                            22,
                            [
                              9, 159, 184, 137, 38, 216, 47, 48, 178, 244, 14,
                              175, 62, 228, 35, 203, 114, 91, 219, 59,
                            ],
                          ],
                        },
                      },
                    },
                  },
                },
              },
            ],
            outputs: {
              type: {
                response: {
                  error: "none",
                  ok: "bool",
                },
              },
            },
          },
        ],
      })
    );

    // Act
    const actual = enrichInterfaceWithTraitData(
      ast,
      traitReferenceMap,
      allFunctionsInterfaces,
      targetContractId
    );

    // Assert
    expect(actual).toEqual(expected);
  });

  it("correctly enriches interface with trait reference data for a direct trait that is the first parameter", () => {
    // Arrange
    const allFunctionsInterfaces = (
      testInputs.directTraitParameterPublicAndReadOnlyFunctions
        .functionsInterfaces as ContractInterfaceFunction[]
    ).filter((f) => f.name !== "update-context");

    const traitReferenceMap = buildTraitReferenceMap(allFunctionsInterfaces);

    const ast = testInputs.directTraitParameterPublicAndReadOnlyFunctions
      .ast as any as IContractAST;

    const targetContractId = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.trait";

    const expected = new Map(
      Object.entries({
        [targetContractId]: [
          {
            name: "function",
            access: "public",
            args: [],
            outputs: {
              type: {
                response: {
                  error: "none",
                  ok: "bool",
                },
              },
            },
          },
          {
            name: "test-no-trait",
            access: "public",
            args: [],
            outputs: {
              type: {
                response: {
                  error: "none",
                  ok: "bool",
                },
              },
            },
          },
          {
            name: "test-trait",
            access: "public",
            args: [
              {
                name: "token",
                type: {
                  trait_reference: {
                    name: "ft-trait",
                    import: {
                      Imported: {
                        name: "sip-010-trait",
                        contract_identifier: {
                          name: "sip-010-trait-ft-standard",
                          issuer: [
                            22,
                            [
                              9, 159, 184, 137, 38, 216, 47, 48, 178, 244, 14,
                              175, 62, 228, 35, 203, 114, 91, 219, 59,
                            ],
                          ],
                        },
                      },
                    },
                  },
                },
              },
            ],
            outputs: {
              type: {
                response: {
                  error: "none",
                  ok: "bool",
                },
              },
            },
          },
          {
            name: "invariant-trait",
            access: "read_only",
            args: [
              {
                name: "token",
                type: {
                  trait_reference: {
                    name: "ft-trait",
                    import: {
                      Imported: {
                        name: "sip-010-trait",
                        contract_identifier: {
                          name: "sip-010-trait-ft-standard",
                          issuer: [
                            22,
                            [
                              9, 159, 184, 137, 38, 216, 47, 48, 178, 244, 14,
                              175, 62, 228, 35, 203, 114, 91, 219, 59,
                            ],
                          ],
                        },
                      },
                    },
                  },
                },
              },
            ],
            outputs: {
              type: "bool",
            },
          },
        ],
      })
    );

    // Act
    const actual = enrichInterfaceWithTraitData(
      ast,
      traitReferenceMap,
      allFunctionsInterfaces,
      targetContractId
    );

    // Assert
    expect(actual).toEqual(expected);
  });

  it("correctly enriches interface with trait reference data for a direct trait that is the second parameter", () => {
    // Arrange
    const allFunctionsInterfaces = (
      testInputs.directTrait2ndParameter
        .functionsInterfaces as ContractInterfaceFunction[]
    ).filter((f) => f.name !== "update-context");

    const traitReferenceMap = buildTraitReferenceMap(allFunctionsInterfaces);

    const ast = testInputs.directTrait2ndParameter.ast as any as IContractAST;

    const targetContractId = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.trait";

    const expected = new Map(
      Object.entries({
        [targetContractId]: [
          {
            name: "function",
            access: "public",
            args: [],
            outputs: {
              type: {
                response: {
                  error: "none",
                  ok: "bool",
                },
              },
            },
          },
          {
            name: "test-no-trait",
            access: "public",
            args: [],
            outputs: {
              type: {
                response: {
                  error: "none",
                  ok: "bool",
                },
              },
            },
          },
          {
            name: "test-trait",
            access: "public",
            args: [
              { name: "a", type: "uint128" },
              {
                name: "token",
                type: {
                  trait_reference: {
                    name: "ft-trait",
                    import: {
                      Imported: {
                        name: "sip-010-trait",
                        contract_identifier: {
                          name: "sip-010-trait-ft-standard",
                          issuer: [
                            22,
                            [
                              9, 159, 184, 137, 38, 216, 47, 48, 178, 244, 14,
                              175, 62, 228, 35, 203, 114, 91, 219, 59,
                            ],
                          ],
                        },
                      },
                    },
                  },
                },
              },
            ],
            outputs: {
              type: {
                response: {
                  error: "none",
                  ok: "bool",
                },
              },
            },
          },
        ],
      })
    );

    // Act
    const actual = enrichInterfaceWithTraitData(
      ast,
      traitReferenceMap,
      allFunctionsInterfaces,
      targetContractId
    );

    // Assert
    expect(actual).toEqual(expected);
  });

  it("correctly enriches interface with trait reference data for a direct trait that is the fifth parameter", () => {
    // Arrange
    const allFunctionsInterfaces = (
      testInputs.directTrait5thParameter
        .functionsInterfaces as ContractInterfaceFunction[]
    ).filter((f) => f.name !== "update-context");

    const traitReferenceMap = buildTraitReferenceMap(allFunctionsInterfaces);

    const ast = testInputs.directTrait5thParameter.ast as any as IContractAST;

    const targetContractId = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.trait";

    const expected = new Map(
      Object.entries({
        [targetContractId]: [
          {
            name: "function",
            access: "public",
            args: [],
            outputs: {
              type: {
                response: {
                  error: "none",
                  ok: "bool",
                },
              },
            },
          },
          {
            name: "test-no-trait",
            access: "public",
            args: [],
            outputs: {
              type: {
                response: {
                  error: "none",
                  ok: "bool",
                },
              },
            },
          },
          {
            name: "test-trait",
            access: "public",
            args: [
              { name: "a", type: "uint128" },
              { name: "b", type: "int128" },
              { name: "c", type: "bool" },
              {
                name: "d",
                type: {
                  "string-ascii": {
                    length: 10,
                  },
                },
              },
              {
                name: "e",
                type: {
                  trait_reference: {
                    name: "ft-trait",
                    import: {
                      Imported: {
                        name: "sip-010-trait",
                        contract_identifier: {
                          name: "sip-010-trait-ft-standard",
                          issuer: [
                            22,
                            [
                              9, 159, 184, 137, 38, 216, 47, 48, 178, 244, 14,
                              175, 62, 228, 35, 203, 114, 91, 219, 59,
                            ],
                          ],
                        },
                      },
                    },
                  },
                },
              },
            ],
            outputs: {
              type: {
                response: {
                  error: "none",
                  ok: "bool",
                },
              },
            },
          },
        ],
      })
    );

    // Act
    const actual = enrichInterfaceWithTraitData(
      ast,
      traitReferenceMap,
      allFunctionsInterfaces,
      targetContractId
    );

    // Assert
    expect(actual).toEqual(expected);
  });
  // paramPath::: [ 'mad', 'list-mad', 'list', 'mad-inner' ]
  it("correctly enriches interface with trait reference data for a tuple nested trait that is the first parameter", () => {
    // Arrange
    const allFunctionsInterfaces = (
      testInputs.tupleTraitParameter
        .functionsInterfaces as ContractInterfaceFunction[]
    ).filter((f) => f.name !== "update-context");

    const traitReferenceMap = buildTraitReferenceMap(allFunctionsInterfaces);

    const ast = testInputs.tupleTraitParameter.ast as any as IContractAST;

    const targetContractId = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.trait";

    const expected = new Map(
      Object.entries({
        [targetContractId]: [
          {
            name: "function",
            access: "public",
            args: [],
            outputs: {
              type: {
                response: {
                  error: "none",
                  ok: "bool",
                },
              },
            },
          },
          {
            name: "test-no-trait",
            access: "public",
            args: [],
            outputs: {
              type: {
                response: {
                  error: "none",
                  ok: "bool",
                },
              },
            },
          },
          {
            name: "test-trait",
            access: "public",
            args: [
              {
                name: "tuple-param",
                type: {
                  tuple: [
                    {
                      name: "token",
                      type: {
                        trait_reference: {
                          name: "ft-trait",
                          import: {
                            Imported: {
                              name: "sip-010-trait",
                              contract_identifier: {
                                name: "sip-010-trait-ft-standard",
                                issuer: [
                                  22,
                                  [
                                    9, 159, 184, 137, 38, 216, 47, 48, 178, 244,
                                    14, 175, 62, 228, 35, 203, 114, 91, 219, 59,
                                  ],
                                ],
                              },
                            },
                          },
                        },
                      },
                    },
                  ],
                },
              },
            ],
            outputs: {
              type: {
                response: {
                  ok: "bool",
                  error: "none",
                },
              },
            },
          },
        ],
      })
    );

    // Act
    const actual = enrichInterfaceWithTraitData(
      ast,
      traitReferenceMap,
      allFunctionsInterfaces,
      targetContractId
    );

    // Assert
    expect(actual).toEqual(expected);
  });

  it("correctly enriches interface with trait reference data for a list nested trait", () => {
    // Arrange
    const allFunctionsInterfaces = (
      testInputs.listTraitParameter
        .functionsInterfaces as ContractInterfaceFunction[]
    ).filter((f) => f.name !== "update-context");

    const traitReferenceMap = buildTraitReferenceMap(allFunctionsInterfaces);

    const ast = testInputs.listTraitParameter.ast as any as IContractAST;

    const targetContractId = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.trait";

    const expected = new Map(
      Object.entries({
        [targetContractId]: [
          {
            name: "function",
            access: "public",
            args: [],
            outputs: {
              type: {
                response: {
                  error: "none",
                  ok: "bool",
                },
              },
            },
          },
          {
            name: "test-no-trait",
            access: "public",
            args: [],
            outputs: {
              type: {
                response: {
                  error: "none",
                  ok: "bool",
                },
              },
            },
          },
          {
            name: "test-trait",
            access: "public",
            args: [
              {
                name: "token-list",
                type: {
                  list: {
                    length: 5,
                    type: {
                      trait_reference: {
                        name: "ft-trait",
                        import: {
                          Imported: {
                            name: "sip-010-trait",
                            contract_identifier: {
                              name: "sip-010-trait-ft-standard",
                              issuer: [
                                22,
                                [
                                  9, 159, 184, 137, 38, 216, 47, 48, 178, 244,
                                  14, 175, 62, 228, 35, 203, 114, 91, 219, 59,
                                ],
                              ],
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            ],
            outputs: {
              type: {
                response: {
                  ok: "bool",
                  error: "none",
                },
              },
            },
          },
        ],
      })
    );

    // Act
    const actual = enrichInterfaceWithTraitData(
      ast,
      traitReferenceMap,
      allFunctionsInterfaces,
      targetContractId
    );

    // Assert
    expect(actual).toEqual(expected);
  });

  it("correctly enriches interface with trait reference data for a response ok branch nested trait", () => {
    // Arrange
    const allFunctionsInterfaces = (
      testInputs.responseOkTraitParameter
        .functionsInterfaces as ContractInterfaceFunction[]
    ).filter((f) => f.name !== "update-context");

    const traitReferenceMap = buildTraitReferenceMap(allFunctionsInterfaces);

    const ast = testInputs.responseOkTraitParameter.ast as any as IContractAST;

    const targetContractId = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.trait";

    const expected = new Map(
      Object.entries({
        [targetContractId]: [
          {
            name: "function",
            access: "public",
            args: [],
            outputs: {
              type: {
                response: {
                  error: "none",
                  ok: "bool",
                },
              },
            },
          },
          {
            name: "test-no-trait",
            access: "public",
            args: [],
            outputs: {
              type: {
                response: {
                  error: "none",
                  ok: "bool",
                },
              },
            },
          },
          {
            name: "test-trait",
            access: "public",
            args: [
              {
                name: "resp-trait-param",
                type: {
                  response: {
                    ok: {
                      trait_reference: {
                        name: "ft-trait",
                        import: {
                          Imported: {
                            name: "sip-010-trait",
                            contract_identifier: {
                              name: "sip-010-trait-ft-standard",
                              issuer: [
                                22,
                                [
                                  9, 159, 184, 137, 38, 216, 47, 48, 178, 244,
                                  14, 175, 62, 228, 35, 203, 114, 91, 219, 59,
                                ],
                              ],
                            },
                          },
                        },
                      },
                    },
                    error: "uint128",
                  },
                },
              },
            ],
            outputs: {
              type: {
                response: {
                  ok: "bool",
                  error: "none",
                },
              },
            },
          },
        ],
      })
    );

    // Act
    const actual = enrichInterfaceWithTraitData(
      ast,
      traitReferenceMap,
      allFunctionsInterfaces,
      targetContractId
    );

    // Assert
    expect(actual).toEqual(expected);
  });

  it("correctly enriches interface with trait reference data for a response error branch nested trait", () => {
    // Arrange
    const allFunctionsInterfaces = (
      testInputs.responseErrTraitParameter
        .functionsInterfaces as ContractInterfaceFunction[]
    ).filter((f) => f.name !== "update-context");

    const traitReferenceMap = buildTraitReferenceMap(allFunctionsInterfaces);

    const ast = testInputs.responseErrTraitParameter.ast as any as IContractAST;

    const targetContractId = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.trait";

    const expected = new Map(
      Object.entries({
        [targetContractId]: [
          {
            name: "function",
            access: "public",
            args: [],
            outputs: {
              type: {
                response: {
                  error: "none",
                  ok: "bool",
                },
              },
            },
          },
          {
            name: "test-no-trait",
            access: "public",
            args: [],
            outputs: {
              type: {
                response: {
                  error: "none",
                  ok: "bool",
                },
              },
            },
          },
          {
            name: "test-trait",
            access: "public",
            args: [
              {
                name: "resp-trait-param",
                type: {
                  response: {
                    ok: "uint128",
                    error: {
                      trait_reference: {
                        name: "ft-trait",
                        import: {
                          Imported: {
                            name: "sip-010-trait",
                            contract_identifier: {
                              name: "sip-010-trait-ft-standard",
                              issuer: [
                                22,
                                [
                                  9, 159, 184, 137, 38, 216, 47, 48, 178, 244,
                                  14, 175, 62, 228, 35, 203, 114, 91, 219, 59,
                                ],
                              ],
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            ],
            outputs: {
              type: {
                response: {
                  ok: "bool",
                  error: "none",
                },
              },
            },
          },
        ],
      })
    );

    // Act
    const actual = enrichInterfaceWithTraitData(
      ast,
      traitReferenceMap,
      allFunctionsInterfaces,
      targetContractId
    );

    // Assert
    expect(actual).toEqual(expected);
  });

  it("correctly enriches interface with trait reference data for a response both branches nested trait", () => {
    // Arrange
    const allFunctionsInterfaces = (
      testInputs.responseBothTraitParameter
        .functionsInterfaces as ContractInterfaceFunction[]
    ).filter((f) => f.name !== "update-context");

    const traitReferenceMap = buildTraitReferenceMap(allFunctionsInterfaces);

    const ast = testInputs.responseBothTraitParameter
      .ast as any as IContractAST;

    const targetContractId = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.trait";

    const expected = new Map(
      Object.entries({
        [targetContractId]: [
          {
            name: "function",
            access: "public",
            args: [],
            outputs: {
              type: {
                response: {
                  error: "none",
                  ok: "bool",
                },
              },
            },
          },
          {
            name: "test-no-trait",
            access: "public",
            args: [],
            outputs: {
              type: {
                response: {
                  error: "none",
                  ok: "bool",
                },
              },
            },
          },
          {
            name: "test-trait",
            access: "public",
            args: [
              {
                name: "resp-trait-param",
                type: {
                  response: {
                    ok: {
                      trait_reference: {
                        name: "ft-trait",
                        import: {
                          Imported: {
                            name: "sip-010-trait",
                            contract_identifier: {
                              name: "sip-010-trait-ft-standard",
                              issuer: [
                                22,
                                [
                                  9, 159, 184, 137, 38, 216, 47, 48, 178, 244,
                                  14, 175, 62, 228, 35, 203, 114, 91, 219, 59,
                                ],
                              ],
                            },
                          },
                        },
                      },
                    },
                    error: {
                      trait_reference: {
                        name: "ft-trait",
                        import: {
                          Imported: {
                            name: "sip-010-trait",
                            contract_identifier: {
                              name: "sip-010-trait-ft-standard",
                              issuer: [
                                22,
                                [
                                  9, 159, 184, 137, 38, 216, 47, 48, 178, 244,
                                  14, 175, 62, 228, 35, 203, 114, 91, 219, 59,
                                ],
                              ],
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            ],
            outputs: {
              type: {
                response: {
                  ok: "bool",
                  error: "none",
                },
              },
            },
          },
        ],
      })
    );

    // Act
    const actual = enrichInterfaceWithTraitData(
      ast,
      traitReferenceMap,
      allFunctionsInterfaces,
      targetContractId
    );

    // Assert
    expect(actual).toEqual(expected);
  });

  it("correctly enriches interface with trait reference data for a optional nested trait", () => {
    // Arrange
    const allFunctionsInterfaces = (
      testInputs.optionalTraitParameter
        .functionsInterfaces as ContractInterfaceFunction[]
    ).filter((f) => f.name !== "update-context");

    const traitReferenceMap = buildTraitReferenceMap(allFunctionsInterfaces);

    const ast = testInputs.optionalTraitParameter.ast as any as IContractAST;

    const targetContractId = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.trait";

    const expected = new Map(
      Object.entries({
        [targetContractId]: [
          {
            name: "function",
            access: "public",
            args: [],
            outputs: {
              type: {
                response: {
                  error: "none",
                  ok: "bool",
                },
              },
            },
          },
          {
            name: "test-no-trait",
            access: "public",
            args: [],
            outputs: {
              type: {
                response: {
                  error: "none",
                  ok: "bool",
                },
              },
            },
          },
          {
            name: "test-trait",
            access: "public",
            args: [
              {
                name: "opt-trait",
                type: {
                  optional: {
                    trait_reference: {
                      name: "ft-trait",
                      import: {
                        Imported: {
                          name: "sip-010-trait",
                          contract_identifier: {
                            name: "sip-010-trait-ft-standard",
                            issuer: [
                              22,
                              [
                                9, 159, 184, 137, 38, 216, 47, 48, 178, 244, 14,
                                175, 62, 228, 35, 203, 114, 91, 219, 59,
                              ],
                            ],
                          },
                        },
                      },
                    },
                  },
                },
              },
            ],
            outputs: {
              type: {
                response: {
                  ok: "bool",
                  error: "none",
                },
              },
            },
          },
        ],
      })
    );

    // Act
    const actual = enrichInterfaceWithTraitData(
      ast,
      traitReferenceMap,
      allFunctionsInterfaces,
      targetContractId
    );

    // Assert
    expect(actual).toEqual(expected);
  });

  it("correctly enriches interface with trait reference data for a list-tuple-nested trait", () => {
    // Arrange
    const allFunctionsInterfaces = (
      testInputs.listTupleNestedTrait
        .functionsInterfaces as ContractInterfaceFunction[]
    ).filter((f) => f.name !== "update-context");

    const traitReferenceMap = buildTraitReferenceMap(allFunctionsInterfaces);

    const ast = testInputs.listTupleNestedTrait.ast as any as IContractAST;

    const targetContractId = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.trait";

    const expected = new Map(
      Object.entries({
        [targetContractId]: [
          {
            name: "function",
            access: "public",
            args: [],
            outputs: {
              type: {
                response: {
                  error: "none",
                  ok: "bool",
                },
              },
            },
          },
          {
            name: "test-mixed-traits",
            access: "public",
            args: [
              {
                name: "list-tuple-trait",
                type: {
                  list: {
                    length: 4,
                    type: {
                      tuple: [
                        {
                          name: "mad-inner",
                          type: {
                            trait_reference: {
                              name: "ft-trait",
                              import: {
                                Imported: {
                                  name: "sip-010-trait",
                                  contract_identifier: {
                                    name: "sip-010-trait-ft-standard",
                                    issuer: [
                                      22,
                                      [
                                        9, 159, 184, 137, 38, 216, 47, 48, 178,
                                        244, 14, 175, 62, 228, 35, 203, 114, 91,
                                        219, 59,
                                      ],
                                    ],
                                  },
                                },
                              },
                            },
                          },
                        },
                      ],
                    },
                  },
                },
              },
            ],
            outputs: {
              type: {
                response: {
                  ok: "bool",
                  error: "none",
                },
              },
            },
          },
        ],
      })
    );

    // Act
    const actual = enrichInterfaceWithTraitData(
      ast,
      traitReferenceMap,
      allFunctionsInterfaces,
      targetContractId
    );

    // Assert
    expect(actual).toEqual(expected);
  });

  it("correctly enriches interface with trait reference data for mixed direct and nested traits", () => {
    // Arrange
    const allFunctionsInterfaces = (
      testInputs.mixedDirectAndNestedTraits
        .functionsInterfaces as ContractInterfaceFunction[]
    ).filter((f) => f.name !== "update-context");

    const traitReferenceMap = buildTraitReferenceMap(allFunctionsInterfaces);

    const ast = testInputs.mixedDirectAndNestedTraits
      .ast as any as IContractAST;

    const targetContractId = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.trait";

    const expected = new Map(
      Object.entries({
        [targetContractId]: [
          {
            name: "function",
            access: "public",
            args: [],
            outputs: {
              type: {
                response: {
                  error: "none",
                  ok: "bool",
                },
              },
            },
          },
          {
            name: "test-mixed-traits",
            access: "public",
            args: [
              {
                name: "direct",
                type: {
                  trait_reference: {
                    name: "ft-trait",
                    import: {
                      Imported: {
                        name: "sip-010-trait",
                        contract_identifier: {
                          name: "sip-010-trait-ft-standard",
                          issuer: [
                            22,
                            [
                              9, 159, 184, 137, 38, 216, 47, 48, 178, 244, 14,
                              175, 62, 228, 35, 203, 114, 91, 219, 59,
                            ],
                          ],
                        },
                      },
                    },
                  },
                },
              },
              {
                name: "list-1",
                type: {
                  list: {
                    length: 4,
                    type: {
                      trait_reference: {
                        name: "ft-trait",
                        import: {
                          Imported: {
                            name: "sip-010-trait",
                            contract_identifier: {
                              name: "sip-010-trait-ft-standard",
                              issuer: [
                                22,
                                [
                                  9, 159, 184, 137, 38, 216, 47, 48, 178, 244,
                                  14, 175, 62, 228, 35, 203, 114, 91, 219, 59,
                                ],
                              ],
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
              {
                name: "mad",
                type: {
                  tuple: [
                    {
                      name: "list-mad",
                      type: {
                        list: {
                          length: 7,
                          type: {
                            tuple: [
                              {
                                name: "mad-inner",
                                type: {
                                  trait_reference: {
                                    name: "ft-trait",
                                    import: {
                                      Imported: {
                                        name: "sip-010-trait",
                                        contract_identifier: {
                                          name: "sip-010-trait-ft-standard",
                                          issuer: [
                                            22,
                                            [
                                              9, 159, 184, 137, 38, 216, 47, 48,
                                              178, 244, 14, 175, 62, 228, 35,
                                              203, 114, 91, 219, 59,
                                            ],
                                          ],
                                        },
                                      },
                                    },
                                  },
                                },
                              },
                            ],
                          },
                        },
                      },
                    },
                  ],
                },
              },
            ],
            outputs: {
              type: {
                response: {
                  ok: "bool",
                  error: "none",
                },
              },
            },
          },
        ],
      })
    );

    // Act
    const actual = enrichInterfaceWithTraitData(
      ast,
      traitReferenceMap,
      allFunctionsInterfaces,
      targetContractId
    );

    // Assert
    expect(actual).toEqual(expected);
  });

  it("correctly retrieves the contracts implementing a trait from the Clarinet project", async () => {
    // Arrange
    const simnet = await initSimnet(
      resolve(__dirname, "example", "Clarinet.toml")
    );

    const projectTraitImplementations =
      extractProjectTraitImplementations(simnet);

    const traitData = {
      name: "ft-trait",
      import: {
        Imported: {
          name: "sip-010-trait",
          contract_identifier: {
            name: "sip-010-trait-ft-standard",
            issuer: [
              22,
              [
                9, 159, 184, 137, 38, 216, 47, 48, 178, 244, 14, 175, 62, 228,
                35, 203, 114, 91, 219, 59,
              ],
            ],
          },
        },
      },
    };

    const expected = [
      "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.rendezvous-token",
      "SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG.ststx-token",
    ];

    // Act
    const actual = getContractIdsImplementingTrait(
      traitData,
      projectTraitImplementations
    );

    // Assert
    expect(actual).toEqual(expected);
  });
});

describe("Trait reference detection", () => {
  it("returns false when no arguments contain a trait reference", async () => {
    // Arrange
    const noTraitFunction = {
      name: "function-without-traits",
      access: "public",
      args: [
        { name: "arg1", type: "uint128" },
        { name: "arg2", type: { buffer: { length: 10 } } },
        { name: "arg3", type: { "string-ascii": { length: 20 } } },
        { name: "arg4", type: "principal" },
        { name: "arg5", type: "bool" },
        { name: "arg6", type: "int128" },
      ],
      outputs: {
        type: {
          response: {
            ok: "bool",
            error: "uint128",
          },
        },
      },
    } as ContractInterfaceFunction;

    // Act
    const actual = isTraitReferenceFunction(noTraitFunction);

    // Assert
    expect(actual).toBe(false);
  });

  it("returns true when an argument contains a trait reference", async () => {
    // Arrange
    const traitFunction = {
      name: "function-with-traits",
      access: "public",
      args: [
        { name: "arg1", type: "trait_reference" },
        { name: "arg2", type: "uint128" },
      ],
      outputs: {
        type: {
          response: {
            ok: "bool",
            error: "uint128",
          },
        },
      },
    } as ContractInterfaceFunction;

    // Act
    const actual = isTraitReferenceFunction(traitFunction);

    // Assert
    expect(actual).toBe(true);
  });

  it("returns false for a list argument without traits", async () => {
    // Arrange
    const listFunction = {
      name: "list-without-traits",
      access: "public",
      args: [
        {
          name: "listArg",
          type: { list: { type: "uint128", length: 5 } },
        },
      ],
      outputs: {
        type: {
          response: {
            ok: "bool",
            error: "uint128",
          },
        },
      },
    } as ContractInterfaceFunction;

    // Act
    const actual = isTraitReferenceFunction(listFunction);

    // Assert
    expect(actual).toBe(false);
  });

  it("returns true for a list argument with traits", async () => {
    // Arrange
    const listWithTraitFunction = {
      name: "list-with-traits",
      access: "public",
      args: [
        {
          name: "listArg",
          type: { list: { type: "trait_reference", length: 5 } },
        },
      ],
      outputs: {
        type: {
          response: {
            ok: "bool",
            error: "uint128",
          },
        },
      },
    } as ContractInterfaceFunction;

    // Act
    const actual = isTraitReferenceFunction(listWithTraitFunction);

    // Assert
    expect(actual).toBe(true);
  });

  it("returns false for a tuple argument without traits", async () => {
    // Arrange
    const tupleFunction = {
      name: "tuple-without-traits",
      access: "public",
      args: [
        {
          name: "tupleArg",
          type: {
            tuple: [
              { name: "field1", type: "uint128" },
              { name: "field2", type: { buffer: { length: 10 } } },
            ],
          },
        },
      ],
      outputs: {
        type: {
          response: {
            ok: "bool",
            error: "uint128",
          },
        },
      },
    } as ContractInterfaceFunction;

    // Act
    const actual = isTraitReferenceFunction(tupleFunction);

    // Assert
    expect(actual).toBe(false);
  });

  it("returns true for a tuple argument with traits", async () => {
    // Arrange
    const tupleWithTraitFunction = {
      name: "tuple-with-traits",
      access: "public",
      args: [
        {
          name: "tupleArg",
          type: {
            tuple: [
              { name: "field1", type: "uint128" },
              { name: "field2", type: "trait_reference" },
            ],
          },
        },
      ],
      outputs: {
        type: {
          response: {
            ok: "bool",
            error: "uint128",
          },
        },
      },
    } as ContractInterfaceFunction;

    // Act
    const actual = isTraitReferenceFunction(tupleWithTraitFunction);

    // Assert
    expect(actual).toBe(true);
  });

  it("returns false for an optional argument without traits", async () => {
    // Arrange
    const optionalFunction = {
      name: "optional-without-traits",
      access: "public",
      args: [{ name: "optionalArg", type: { optional: "uint128" } }],
      outputs: {
        type: {
          response: {
            ok: "bool",
            error: "uint128",
          },
        },
      },
    } as ContractInterfaceFunction;

    // Act
    const actual = isTraitReferenceFunction(optionalFunction);

    // Assert
    expect(actual).toBe(false);
  });

  it("returns true for an optional argument with traits", async () => {
    // Arrange
    const optionalWithTraitFunction = {
      name: "optional-with-traits",
      access: "public",
      args: [{ name: "optionalArg", type: { optional: "trait_reference" } }],
      outputs: {
        type: {
          response: {
            ok: "bool",
            error: "uint128",
          },
        },
      },
    } as ContractInterfaceFunction;

    // Act
    const actual = isTraitReferenceFunction(optionalWithTraitFunction);

    // Assert
    expect(actual).toBe(true);
  });

  it("returns false for a response argument without traits", async () => {
    // Arrange
    const responseFunction = {
      name: "response-without-traits",
      access: "public",
      args: [
        {
          name: "responseArg",
          type: {
            response: { ok: "uint128", error: "bool" },
          },
        },
      ],
      outputs: {
        type: {
          response: {
            ok: "bool",
            error: "uint128",
          },
        },
      },
    } as ContractInterfaceFunction;

    // Act
    const actual = isTraitReferenceFunction(responseFunction);

    // Assert
    expect(actual).toBe(false);
  });

  it("returns true for a response argument with traits", async () => {
    // Arrange
    const responseWithTraitFunction = {
      name: "response-with-traits",
      access: "public",
      args: [
        {
          name: "responseArg",
          type: {
            response: { ok: "trait_reference", error: "uint128" },
          },
        },
      ],
      outputs: {
        type: {
          response: {
            ok: "bool",
            error: "uint128",
          },
        },
      },
    } as ContractInterfaceFunction;

    // Act
    const actual = isTraitReferenceFunction(responseWithTraitFunction);

    // Assert
    expect(actual).toBe(true);
  });

  it("returns false for unexpected argument types", async () => {
    // Arrange
    const unexpectedTypeFunction = {
      name: "unexpected-type-function",
      access: "public",
      args: [{ name: "unexpectedArg", type: "custom_type" as any }],
      outputs: {
        type: {
          response: {
            ok: "bool",
            error: "uint128",
          },
        },
      },
    } as ContractInterfaceFunction;

    // Act
    const actual = isTraitReferenceFunction(unexpectedTypeFunction);

    // Assert
    expect(actual).toBe(false);
  });

  it("returns false for an argument with an unrecognized complex type", async () => {
    // Arrange
    const unrecognizedTypeFunction = {
      name: "unrecognized-type-function",
      access: "public",
      args: [{ name: "unknownArg", type: { unknown: "some_value" } as any }],
      outputs: { type: "bool" },
    } as ContractInterfaceFunction;

    // Act
    const actual = isTraitReferenceFunction(unrecognizedTypeFunction);

    // Assert
    expect(actual).toBe(false);
  });
});

const testInputs = {
  directTrait1stParameter: {
    functionsInterfaces: [
      {
        name: "function",
        access: "public",
        args: [],
        outputs: {
          type: {
            response: {
              ok: "bool",
              error: "none",
            },
          },
        },
      },
      {
        name: "test-no-trait",
        access: "public",
        args: [],
        outputs: {
          type: {
            response: {
              ok: "bool",
              error: "none",
            },
          },
        },
      },
      {
        name: "test-trait",
        access: "public",
        args: [
          {
            name: "token",
            type: "trait_reference",
          },
        ],
        outputs: {
          type: {
            response: {
              ok: "bool",
              error: "none",
            },
          },
        },
      },
      {
        name: "update-context",
        access: "public",
        args: [
          {
            name: "function-name",
            type: {
              "string-ascii": {
                length: 100,
              },
            },
          },
          {
            name: "called",
            type: "uint128",
          },
        ],
        outputs: {
          type: {
            response: {
              ok: "bool",
              error: "none",
            },
          },
        },
      },
    ],
    ast: {
      contract_identifier: {
        issuer: [
          26,
          [
            109, 120, 222, 123, 6, 37, 223, 191, 193, 108, 58, 138, 87, 53, 246,
            220, 61, 195, 242, 206,
          ],
        ],
        name: "trait",
      },
      pre_expressions: [],
      expressions: [
        {
          expr: {
            List: [
              {
                expr: {
                  Atom: "use-trait",
                },
                id: 2,
                span: {
                  start_line: 1,
                  start_column: 2,
                  end_line: 1,
                  end_column: 10,
                },
              },
              {
                expr: {
                  Atom: "ft-trait",
                },
                id: 3,
                span: {
                  start_line: 1,
                  start_column: 12,
                  end_line: 1,
                  end_column: 19,
                },
              },
              {
                expr: {
                  Field: {
                    name: "sip-010-trait",
                    contract_identifier: {
                      issuer: [
                        22,
                        [
                          9, 159, 184, 137, 38, 216, 47, 48, 178, 244, 14, 175,
                          62, 228, 35, 203, 114, 91, 219, 59,
                        ],
                      ],
                      name: "sip-010-trait-ft-standard",
                    },
                  },
                },
                id: 4,
                span: {
                  start_line: 1,
                  start_column: 21,
                  end_line: 1,
                  end_column: 101,
                },
              },
            ],
          },
          id: 1,
          span: {
            start_line: 1,
            start_column: 1,
            end_line: 1,
            end_column: 102,
          },
        },
        {
          expr: {
            List: [
              {
                expr: {
                  Atom: "define-public",
                },
                id: 6,
                span: {
                  start_line: 3,
                  start_column: 2,
                  end_line: 3,
                  end_column: 14,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "trait-transfer-function",
                      },
                      id: 8,
                      span: {
                        start_line: 3,
                        start_column: 17,
                        end_line: 3,
                        end_column: 39,
                      },
                    },
                    {
                      expr: {
                        List: [
                          {
                            expr: {
                              Atom: "token",
                            },
                            id: 10,
                            span: {
                              start_line: 3,
                              start_column: 42,
                              end_line: 3,
                              end_column: 46,
                            },
                          },
                          {
                            expr: {
                              TraitReference: [
                                "ft-trait",
                                {
                                  Imported: {
                                    name: "sip-010-trait",
                                    contract_identifier: {
                                      issuer: [
                                        22,
                                        [
                                          9, 159, 184, 137, 38, 216, 47, 48,
                                          178, 244, 14, 175, 62, 228, 35, 203,
                                          114, 91, 219, 59,
                                        ],
                                      ],
                                      name: "sip-010-trait-ft-standard",
                                    },
                                  },
                                },
                              ],
                            },
                            id: 11,
                            span: {
                              start_line: 3,
                              start_column: 48,
                              end_line: 3,
                              end_column: 57,
                            },
                          },
                        ],
                      },
                      id: 9,
                      span: {
                        start_line: 3,
                        start_column: 41,
                        end_line: 3,
                        end_column: 58,
                      },
                    },
                  ],
                },
                id: 7,
                span: {
                  start_line: 3,
                  start_column: 16,
                  end_line: 3,
                  end_column: 59,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "ok",
                      },
                      id: 13,
                      span: {
                        start_line: 4,
                        start_column: 4,
                        end_line: 4,
                        end_column: 5,
                      },
                    },
                    {
                      expr: {
                        Atom: "true",
                      },
                      id: 14,
                      span: {
                        start_line: 4,
                        start_column: 7,
                        end_line: 4,
                        end_column: 10,
                      },
                    },
                  ],
                },
                id: 12,
                span: {
                  start_line: 4,
                  start_column: 3,
                  end_line: 4,
                  end_column: 11,
                },
              },
            ],
          },
          id: 5,
          span: {
            start_line: 3,
            start_column: 1,
            end_line: 5,
            end_column: 1,
          },
        },
        {
          expr: {
            List: [
              {
                expr: {
                  Atom: "define-map",
                },
                id: 16,
                span: {
                  start_line: 8,
                  start_column: 2,
                  end_line: 8,
                  end_column: 11,
                },
              },
              {
                expr: {
                  Atom: "context",
                },
                id: 17,
                span: {
                  start_line: 8,
                  start_column: 13,
                  end_line: 8,
                  end_column: 19,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "string-ascii",
                      },
                      id: 19,
                      span: {
                        start_line: 8,
                        start_column: 22,
                        end_line: 8,
                        end_column: 33,
                      },
                    },
                    {
                      expr: {
                        LiteralValue: {
                          Int: "100",
                        },
                      },
                      id: 20,
                      span: {
                        start_line: 8,
                        start_column: 35,
                        end_line: 8,
                        end_column: 37,
                      },
                    },
                  ],
                },
                id: 18,
                span: {
                  start_line: 8,
                  start_column: 21,
                  end_line: 8,
                  end_column: 38,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "tuple",
                      },
                      id: 22,
                      span: {
                        start_line: 0,
                        start_column: 0,
                        end_line: 0,
                        end_column: 0,
                      },
                    },
                    {
                      expr: {
                        List: [
                          {
                            expr: {
                              Atom: "called",
                            },
                            id: 24,
                            span: {
                              start_line: 9,
                              start_column: 5,
                              end_line: 9,
                              end_column: 10,
                            },
                          },
                          {
                            expr: {
                              Atom: "uint",
                            },
                            id: 25,
                            span: {
                              start_line: 9,
                              start_column: 13,
                              end_line: 9,
                              end_column: 16,
                            },
                            post_comments: [
                              [
                                "other data",
                                {
                                  start_line: 10,
                                  start_column: 5,
                                  end_line: 10,
                                  end_column: 17,
                                },
                              ],
                            ],
                          },
                        ],
                      },
                      id: 23,
                      span: {
                        start_line: 9,
                        start_column: 5,
                        end_line: 9,
                        end_column: 16,
                      },
                    },
                  ],
                },
                id: 21,
                span: {
                  start_line: 8,
                  start_column: 40,
                  end_line: 11,
                  end_column: 3,
                },
              },
            ],
          },
          id: 15,
          span: {
            start_line: 8,
            start_column: 1,
            end_line: 11,
            end_column: 4,
          },
        },
        {
          expr: {
            List: [
              {
                expr: {
                  Atom: "define-public",
                },
                id: 27,
                span: {
                  start_line: 13,
                  start_column: 4,
                  end_line: 13,
                  end_column: 16,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "update-context",
                      },
                      id: 29,
                      span: {
                        start_line: 13,
                        start_column: 19,
                        end_line: 13,
                        end_column: 32,
                      },
                    },
                    {
                      expr: {
                        List: [
                          {
                            expr: {
                              Atom: "function-name",
                            },
                            id: 31,
                            span: {
                              start_line: 13,
                              start_column: 35,
                              end_line: 13,
                              end_column: 47,
                            },
                          },
                          {
                            expr: {
                              List: [
                                {
                                  expr: {
                                    Atom: "string-ascii",
                                  },
                                  id: 33,
                                  span: {
                                    start_line: 13,
                                    start_column: 50,
                                    end_line: 13,
                                    end_column: 61,
                                  },
                                },
                                {
                                  expr: {
                                    LiteralValue: {
                                      Int: "100",
                                    },
                                  },
                                  id: 34,
                                  span: {
                                    start_line: 13,
                                    start_column: 63,
                                    end_line: 13,
                                    end_column: 65,
                                  },
                                },
                              ],
                            },
                            id: 32,
                            span: {
                              start_line: 13,
                              start_column: 49,
                              end_line: 13,
                              end_column: 66,
                            },
                          },
                        ],
                      },
                      id: 30,
                      span: {
                        start_line: 13,
                        start_column: 34,
                        end_line: 13,
                        end_column: 67,
                      },
                    },
                    {
                      expr: {
                        List: [
                          {
                            expr: {
                              Atom: "called",
                            },
                            id: 36,
                            span: {
                              start_line: 13,
                              start_column: 70,
                              end_line: 13,
                              end_column: 75,
                            },
                          },
                          {
                            expr: {
                              Atom: "uint",
                            },
                            id: 37,
                            span: {
                              start_line: 13,
                              start_column: 77,
                              end_line: 13,
                              end_column: 80,
                            },
                          },
                        ],
                      },
                      id: 35,
                      span: {
                        start_line: 13,
                        start_column: 69,
                        end_line: 13,
                        end_column: 81,
                      },
                    },
                  ],
                },
                id: 28,
                span: {
                  start_line: 13,
                  start_column: 18,
                  end_line: 13,
                  end_column: 82,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "ok",
                      },
                      id: 39,
                      span: {
                        start_line: 14,
                        start_column: 6,
                        end_line: 14,
                        end_column: 7,
                      },
                    },
                    {
                      expr: {
                        List: [
                          {
                            expr: {
                              Atom: "map-set",
                            },
                            id: 41,
                            span: {
                              start_line: 14,
                              start_column: 10,
                              end_line: 14,
                              end_column: 16,
                            },
                          },
                          {
                            expr: {
                              Atom: "context",
                            },
                            id: 42,
                            span: {
                              start_line: 14,
                              start_column: 18,
                              end_line: 14,
                              end_column: 24,
                            },
                          },
                          {
                            expr: {
                              Atom: "function-name",
                            },
                            id: 43,
                            span: {
                              start_line: 14,
                              start_column: 26,
                              end_line: 14,
                              end_column: 38,
                            },
                          },
                          {
                            expr: {
                              List: [
                                {
                                  expr: {
                                    Atom: "tuple",
                                  },
                                  id: 45,
                                  span: {
                                    start_line: 0,
                                    start_column: 0,
                                    end_line: 0,
                                    end_column: 0,
                                  },
                                },
                                {
                                  expr: {
                                    List: [
                                      {
                                        expr: {
                                          Atom: "called",
                                        },
                                        id: 47,
                                        span: {
                                          start_line: 14,
                                          start_column: 41,
                                          end_line: 14,
                                          end_column: 46,
                                        },
                                      },
                                      {
                                        expr: {
                                          Atom: "called",
                                        },
                                        id: 48,
                                        span: {
                                          start_line: 14,
                                          start_column: 49,
                                          end_line: 14,
                                          end_column: 54,
                                        },
                                      },
                                    ],
                                  },
                                  id: 46,
                                  span: {
                                    start_line: 14,
                                    start_column: 41,
                                    end_line: 14,
                                    end_column: 54,
                                  },
                                },
                              ],
                            },
                            id: 44,
                            span: {
                              start_line: 14,
                              start_column: 40,
                              end_line: 14,
                              end_column: 55,
                            },
                          },
                        ],
                      },
                      id: 40,
                      span: {
                        start_line: 14,
                        start_column: 9,
                        end_line: 14,
                        end_column: 56,
                      },
                    },
                  ],
                },
                id: 38,
                span: {
                  start_line: 14,
                  start_column: 5,
                  end_line: 14,
                  end_column: 57,
                },
              },
            ],
          },
          id: 26,
          span: {
            start_line: 13,
            start_column: 3,
            end_line: 14,
            end_column: 58,
          },
        },
        {
          expr: {
            List: [
              {
                expr: {
                  Atom: "define-public",
                },
                id: 50,
                span: {
                  start_line: 16,
                  start_column: 2,
                  end_line: 16,
                  end_column: 14,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "test-no-trait",
                      },
                      id: 52,
                      span: {
                        start_line: 16,
                        start_column: 17,
                        end_line: 16,
                        end_column: 29,
                      },
                    },
                  ],
                },
                id: 51,
                span: {
                  start_line: 16,
                  start_column: 16,
                  end_line: 16,
                  end_column: 30,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "ok",
                      },
                      id: 54,
                      span: {
                        start_line: 17,
                        start_column: 4,
                        end_line: 17,
                        end_column: 5,
                      },
                    },
                    {
                      expr: {
                        Atom: "true",
                      },
                      id: 55,
                      span: {
                        start_line: 17,
                        start_column: 7,
                        end_line: 17,
                        end_column: 10,
                      },
                    },
                  ],
                },
                id: 53,
                span: {
                  start_line: 17,
                  start_column: 3,
                  end_line: 17,
                  end_column: 11,
                },
              },
            ],
          },
          id: 49,
          span: {
            start_line: 16,
            start_column: 1,
            end_line: 18,
            end_column: 1,
          },
        },
        {
          expr: {
            List: [
              {
                expr: {
                  Atom: "define-public",
                },
                id: 57,
                span: {
                  start_line: 20,
                  start_column: 2,
                  end_line: 20,
                  end_column: 14,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "test-trait",
                      },
                      id: 59,
                      span: {
                        start_line: 20,
                        start_column: 17,
                        end_line: 20,
                        end_column: 26,
                      },
                    },
                    {
                      expr: {
                        List: [
                          {
                            expr: {
                              Atom: "token",
                            },
                            id: 61,
                            span: {
                              start_line: 20,
                              start_column: 29,
                              end_line: 20,
                              end_column: 33,
                            },
                          },
                          {
                            expr: {
                              TraitReference: [
                                "ft-trait",
                                {
                                  Imported: {
                                    name: "sip-010-trait",
                                    contract_identifier: {
                                      issuer: [
                                        22,
                                        [
                                          9, 159, 184, 137, 38, 216, 47, 48,
                                          178, 244, 14, 175, 62, 228, 35, 203,
                                          114, 91, 219, 59,
                                        ],
                                      ],
                                      name: "sip-010-trait-ft-standard",
                                    },
                                  },
                                },
                              ],
                            },
                            id: 62,
                            span: {
                              start_line: 20,
                              start_column: 35,
                              end_line: 20,
                              end_column: 44,
                            },
                          },
                        ],
                      },
                      id: 60,
                      span: {
                        start_line: 20,
                        start_column: 28,
                        end_line: 20,
                        end_column: 45,
                      },
                    },
                  ],
                },
                id: 58,
                span: {
                  start_line: 20,
                  start_column: 16,
                  end_line: 20,
                  end_column: 46,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "ok",
                      },
                      id: 64,
                      span: {
                        start_line: 21,
                        start_column: 4,
                        end_line: 21,
                        end_column: 5,
                      },
                    },
                    {
                      expr: {
                        Atom: "true",
                      },
                      id: 65,
                      span: {
                        start_line: 21,
                        start_column: 7,
                        end_line: 21,
                        end_column: 10,
                      },
                    },
                  ],
                },
                id: 63,
                span: {
                  start_line: 21,
                  start_column: 3,
                  end_line: 21,
                  end_column: 11,
                },
              },
            ],
          },
          id: 56,
          span: {
            start_line: 20,
            start_column: 1,
            end_line: 22,
            end_column: 1,
          },
        },
      ],
      top_level_expression_sorting: [0, 1, 2, 3, 4, 5],
      referenced_traits: {},
      implemented_traits: [],
    },
  },
  directTrait2ndParameter: {
    functionsInterfaces: [
      {
        name: "function",
        access: "public",
        args: [],
        outputs: {
          type: {
            response: {
              ok: "bool",
              error: "none",
            },
          },
        },
      },
      {
        name: "test-no-trait",
        access: "public",
        args: [],
        outputs: {
          type: {
            response: {
              ok: "bool",
              error: "none",
            },
          },
        },
      },
      {
        name: "test-trait",
        access: "public",
        args: [
          {
            name: "a",
            type: "uint128",
          },
          {
            name: "token",
            type: "trait_reference",
          },
        ],
        outputs: {
          type: {
            response: {
              ok: "bool",
              error: "none",
            },
          },
        },
      },
    ],
    ast: {
      contract_identifier: {
        issuer: [
          26,
          [
            109, 120, 222, 123, 6, 37, 223, 191, 193, 108, 58, 138, 87, 53, 246,
            220, 61, 195, 242, 206,
          ],
        ],
        name: "trait",
      },
      pre_expressions: [],
      expressions: [
        {
          expr: {
            List: [
              {
                expr: {
                  Atom: "define-public",
                },
                id: 2,
                span: {
                  start_line: 1,
                  start_column: 2,
                  end_line: 1,
                  end_column: 14,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "function",
                      },
                      id: 4,
                      span: {
                        start_line: 1,
                        start_column: 17,
                        end_line: 1,
                        end_column: 24,
                      },
                    },
                  ],
                },
                id: 3,
                span: {
                  start_line: 1,
                  start_column: 16,
                  end_line: 1,
                  end_column: 25,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "ok",
                      },
                      id: 6,
                      span: {
                        start_line: 2,
                        start_column: 4,
                        end_line: 2,
                        end_column: 5,
                      },
                    },
                    {
                      expr: {
                        Atom: "true",
                      },
                      id: 7,
                      span: {
                        start_line: 2,
                        start_column: 7,
                        end_line: 2,
                        end_column: 10,
                      },
                    },
                  ],
                },
                id: 5,
                span: {
                  start_line: 2,
                  start_column: 3,
                  end_line: 2,
                  end_column: 11,
                },
              },
            ],
          },
          id: 1,
          span: {
            start_line: 1,
            start_column: 1,
            end_line: 3,
            end_column: 1,
          },
        },
        {
          expr: {
            List: [
              {
                expr: {
                  Atom: "define-map",
                },
                id: 9,
                span: {
                  start_line: 6,
                  start_column: 2,
                  end_line: 6,
                  end_column: 11,
                },
              },
              {
                expr: {
                  Atom: "context",
                },
                id: 10,
                span: {
                  start_line: 6,
                  start_column: 13,
                  end_line: 6,
                  end_column: 19,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "string-ascii",
                      },
                      id: 12,
                      span: {
                        start_line: 6,
                        start_column: 22,
                        end_line: 6,
                        end_column: 33,
                      },
                    },
                    {
                      expr: {
                        LiteralValue: {
                          Int: "100",
                        },
                      },
                      id: 13,
                      span: {
                        start_line: 6,
                        start_column: 35,
                        end_line: 6,
                        end_column: 37,
                      },
                    },
                  ],
                },
                id: 11,
                span: {
                  start_line: 6,
                  start_column: 21,
                  end_line: 6,
                  end_column: 38,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "tuple",
                      },
                      id: 15,
                      span: {
                        start_line: 0,
                        start_column: 0,
                        end_line: 0,
                        end_column: 0,
                      },
                    },
                    {
                      expr: {
                        List: [
                          {
                            expr: {
                              Atom: "called",
                            },
                            id: 17,
                            span: {
                              start_line: 7,
                              start_column: 5,
                              end_line: 7,
                              end_column: 10,
                            },
                          },
                          {
                            expr: {
                              Atom: "uint",
                            },
                            id: 18,
                            span: {
                              start_line: 7,
                              start_column: 13,
                              end_line: 7,
                              end_column: 16,
                            },
                            post_comments: [
                              [
                                "other data",
                                {
                                  start_line: 8,
                                  start_column: 5,
                                  end_line: 8,
                                  end_column: 17,
                                },
                              ],
                            ],
                          },
                        ],
                      },
                      id: 16,
                      span: {
                        start_line: 7,
                        start_column: 5,
                        end_line: 7,
                        end_column: 16,
                      },
                    },
                  ],
                },
                id: 14,
                span: {
                  start_line: 6,
                  start_column: 40,
                  end_line: 9,
                  end_column: 3,
                },
              },
            ],
          },
          id: 8,
          span: {
            start_line: 6,
            start_column: 1,
            end_line: 9,
            end_column: 4,
          },
        },
        {
          expr: {
            List: [
              {
                expr: {
                  Atom: "define-public",
                },
                id: 20,
                span: {
                  start_line: 11,
                  start_column: 4,
                  end_line: 11,
                  end_column: 16,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "update-context",
                      },
                      id: 22,
                      span: {
                        start_line: 11,
                        start_column: 19,
                        end_line: 11,
                        end_column: 32,
                      },
                    },
                    {
                      expr: {
                        List: [
                          {
                            expr: {
                              Atom: "function-name",
                            },
                            id: 24,
                            span: {
                              start_line: 11,
                              start_column: 35,
                              end_line: 11,
                              end_column: 47,
                            },
                          },
                          {
                            expr: {
                              List: [
                                {
                                  expr: {
                                    Atom: "string-ascii",
                                  },
                                  id: 26,
                                  span: {
                                    start_line: 11,
                                    start_column: 50,
                                    end_line: 11,
                                    end_column: 61,
                                  },
                                },
                                {
                                  expr: {
                                    LiteralValue: {
                                      Int: "100",
                                    },
                                  },
                                  id: 27,
                                  span: {
                                    start_line: 11,
                                    start_column: 63,
                                    end_line: 11,
                                    end_column: 65,
                                  },
                                },
                              ],
                            },
                            id: 25,
                            span: {
                              start_line: 11,
                              start_column: 49,
                              end_line: 11,
                              end_column: 66,
                            },
                          },
                        ],
                      },
                      id: 23,
                      span: {
                        start_line: 11,
                        start_column: 34,
                        end_line: 11,
                        end_column: 67,
                      },
                    },
                    {
                      expr: {
                        List: [
                          {
                            expr: {
                              Atom: "called",
                            },
                            id: 29,
                            span: {
                              start_line: 11,
                              start_column: 70,
                              end_line: 11,
                              end_column: 75,
                            },
                          },
                          {
                            expr: {
                              Atom: "uint",
                            },
                            id: 30,
                            span: {
                              start_line: 11,
                              start_column: 77,
                              end_line: 11,
                              end_column: 80,
                            },
                          },
                        ],
                      },
                      id: 28,
                      span: {
                        start_line: 11,
                        start_column: 69,
                        end_line: 11,
                        end_column: 81,
                      },
                    },
                  ],
                },
                id: 21,
                span: {
                  start_line: 11,
                  start_column: 18,
                  end_line: 11,
                  end_column: 82,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "ok",
                      },
                      id: 32,
                      span: {
                        start_line: 12,
                        start_column: 6,
                        end_line: 12,
                        end_column: 7,
                      },
                    },
                    {
                      expr: {
                        List: [
                          {
                            expr: {
                              Atom: "map-set",
                            },
                            id: 34,
                            span: {
                              start_line: 12,
                              start_column: 10,
                              end_line: 12,
                              end_column: 16,
                            },
                          },
                          {
                            expr: {
                              Atom: "context",
                            },
                            id: 35,
                            span: {
                              start_line: 12,
                              start_column: 18,
                              end_line: 12,
                              end_column: 24,
                            },
                          },
                          {
                            expr: {
                              Atom: "function-name",
                            },
                            id: 36,
                            span: {
                              start_line: 12,
                              start_column: 26,
                              end_line: 12,
                              end_column: 38,
                            },
                          },
                          {
                            expr: {
                              List: [
                                {
                                  expr: {
                                    Atom: "tuple",
                                  },
                                  id: 38,
                                  span: {
                                    start_line: 0,
                                    start_column: 0,
                                    end_line: 0,
                                    end_column: 0,
                                  },
                                },
                                {
                                  expr: {
                                    List: [
                                      {
                                        expr: {
                                          Atom: "called",
                                        },
                                        id: 40,
                                        span: {
                                          start_line: 12,
                                          start_column: 41,
                                          end_line: 12,
                                          end_column: 46,
                                        },
                                      },
                                      {
                                        expr: {
                                          Atom: "called",
                                        },
                                        id: 41,
                                        span: {
                                          start_line: 12,
                                          start_column: 49,
                                          end_line: 12,
                                          end_column: 54,
                                        },
                                      },
                                    ],
                                  },
                                  id: 39,
                                  span: {
                                    start_line: 12,
                                    start_column: 41,
                                    end_line: 12,
                                    end_column: 54,
                                  },
                                },
                              ],
                            },
                            id: 37,
                            span: {
                              start_line: 12,
                              start_column: 40,
                              end_line: 12,
                              end_column: 55,
                            },
                          },
                        ],
                      },
                      id: 33,
                      span: {
                        start_line: 12,
                        start_column: 9,
                        end_line: 12,
                        end_column: 56,
                      },
                    },
                  ],
                },
                id: 31,
                span: {
                  start_line: 12,
                  start_column: 5,
                  end_line: 12,
                  end_column: 57,
                },
              },
            ],
          },
          id: 19,
          span: {
            start_line: 11,
            start_column: 3,
            end_line: 12,
            end_column: 58,
          },
        },
        {
          expr: {
            List: [
              {
                expr: {
                  Atom: "use-trait",
                },
                id: 43,
                span: {
                  start_line: 14,
                  start_column: 2,
                  end_line: 14,
                  end_column: 10,
                },
              },
              {
                expr: {
                  Atom: "ft-trait",
                },
                id: 44,
                span: {
                  start_line: 14,
                  start_column: 12,
                  end_line: 14,
                  end_column: 19,
                },
              },
              {
                expr: {
                  Field: {
                    name: "sip-010-trait",
                    contract_identifier: {
                      issuer: [
                        22,
                        [
                          9, 159, 184, 137, 38, 216, 47, 48, 178, 244, 14, 175,
                          62, 228, 35, 203, 114, 91, 219, 59,
                        ],
                      ],
                      name: "sip-010-trait-ft-standard",
                    },
                  },
                },
                id: 45,
                span: {
                  start_line: 14,
                  start_column: 21,
                  end_line: 14,
                  end_column: 101,
                },
              },
            ],
          },
          id: 42,
          span: {
            start_line: 14,
            start_column: 1,
            end_line: 14,
            end_column: 102,
          },
        },
        {
          expr: {
            List: [
              {
                expr: {
                  Atom: "define-public",
                },
                id: 47,
                span: {
                  start_line: 16,
                  start_column: 2,
                  end_line: 16,
                  end_column: 14,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "test-no-trait",
                      },
                      id: 49,
                      span: {
                        start_line: 16,
                        start_column: 17,
                        end_line: 16,
                        end_column: 29,
                      },
                    },
                  ],
                },
                id: 48,
                span: {
                  start_line: 16,
                  start_column: 16,
                  end_line: 16,
                  end_column: 30,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "ok",
                      },
                      id: 51,
                      span: {
                        start_line: 17,
                        start_column: 4,
                        end_line: 17,
                        end_column: 5,
                      },
                    },
                    {
                      expr: {
                        Atom: "true",
                      },
                      id: 52,
                      span: {
                        start_line: 17,
                        start_column: 7,
                        end_line: 17,
                        end_column: 10,
                      },
                    },
                  ],
                },
                id: 50,
                span: {
                  start_line: 17,
                  start_column: 3,
                  end_line: 17,
                  end_column: 11,
                },
              },
            ],
          },
          id: 46,
          span: {
            start_line: 16,
            start_column: 1,
            end_line: 18,
            end_column: 1,
          },
        },
        {
          expr: {
            List: [
              {
                expr: {
                  Atom: "define-public",
                },
                id: 54,
                span: {
                  start_line: 20,
                  start_column: 2,
                  end_line: 20,
                  end_column: 14,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "test-trait",
                      },
                      id: 56,
                      span: {
                        start_line: 20,
                        start_column: 17,
                        end_line: 20,
                        end_column: 26,
                      },
                    },
                    {
                      expr: {
                        List: [
                          {
                            expr: {
                              Atom: "a",
                            },
                            id: 58,
                            span: {
                              start_line: 20,
                              start_column: 29,
                              end_line: 20,
                              end_column: 29,
                            },
                          },
                          {
                            expr: {
                              Atom: "uint",
                            },
                            id: 59,
                            span: {
                              start_line: 20,
                              start_column: 31,
                              end_line: 20,
                              end_column: 34,
                            },
                          },
                        ],
                      },
                      id: 57,
                      span: {
                        start_line: 20,
                        start_column: 28,
                        end_line: 20,
                        end_column: 35,
                      },
                    },
                    {
                      expr: {
                        List: [
                          {
                            expr: {
                              Atom: "token",
                            },
                            id: 61,
                            span: {
                              start_line: 20,
                              start_column: 38,
                              end_line: 20,
                              end_column: 42,
                            },
                          },
                          {
                            expr: {
                              TraitReference: [
                                "ft-trait",
                                {
                                  Imported: {
                                    name: "sip-010-trait",
                                    contract_identifier: {
                                      issuer: [
                                        22,
                                        [
                                          9, 159, 184, 137, 38, 216, 47, 48,
                                          178, 244, 14, 175, 62, 228, 35, 203,
                                          114, 91, 219, 59,
                                        ],
                                      ],
                                      name: "sip-010-trait-ft-standard",
                                    },
                                  },
                                },
                              ],
                            },
                            id: 62,
                            span: {
                              start_line: 20,
                              start_column: 44,
                              end_line: 20,
                              end_column: 53,
                            },
                          },
                        ],
                      },
                      id: 60,
                      span: {
                        start_line: 20,
                        start_column: 37,
                        end_line: 20,
                        end_column: 54,
                      },
                    },
                  ],
                },
                id: 55,
                span: {
                  start_line: 20,
                  start_column: 16,
                  end_line: 20,
                  end_column: 55,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "ok",
                      },
                      id: 64,
                      span: {
                        start_line: 21,
                        start_column: 4,
                        end_line: 21,
                        end_column: 5,
                      },
                    },
                    {
                      expr: {
                        Atom: "true",
                      },
                      id: 65,
                      span: {
                        start_line: 21,
                        start_column: 7,
                        end_line: 21,
                        end_column: 10,
                      },
                    },
                  ],
                },
                id: 63,
                span: {
                  start_line: 21,
                  start_column: 3,
                  end_line: 21,
                  end_column: 11,
                },
              },
            ],
          },
          id: 53,
          span: {
            start_line: 20,
            start_column: 1,
            end_line: 22,
            end_column: 1,
          },
        },
      ],
      top_level_expression_sorting: [0, 1, 2, 3, 4, 5],
      referenced_traits: {},
      implemented_traits: [],
    },
  },
  directTrait5thParameter: {
    functionsInterfaces: [
      {
        name: "function",
        access: "public",
        args: [],
        outputs: {
          type: {
            response: {
              ok: "bool",
              error: "none",
            },
          },
        },
      },
      {
        name: "test-no-trait",
        access: "public",
        args: [],
        outputs: {
          type: {
            response: {
              ok: "bool",
              error: "none",
            },
          },
        },
      },
      {
        name: "test-trait",
        access: "public",
        args: [
          {
            name: "a",
            type: "uint128",
          },
          {
            name: "b",
            type: "int128",
          },
          {
            name: "c",
            type: "bool",
          },
          {
            name: "d",
            type: {
              "string-ascii": {
                length: 10,
              },
            },
          },
          {
            name: "e",
            type: "trait_reference",
          },
        ],
        outputs: {
          type: {
            response: {
              ok: "bool",
              error: "none",
            },
          },
        },
      },
      {
        name: "update-context",
        access: "public",
        args: [
          {
            name: "function-name",
            type: {
              "string-ascii": {
                length: 100,
              },
            },
          },
          {
            name: "called",
            type: "uint128",
          },
        ],
        outputs: {
          type: {
            response: {
              ok: "bool",
              error: "none",
            },
          },
        },
      },
    ],
    ast: {
      contract_identifier: {
        issuer: [
          26,
          [
            109, 120, 222, 123, 6, 37, 223, 191, 193, 108, 58, 138, 87, 53, 246,
            220, 61, 195, 242, 206,
          ],
        ],
        name: "trait",
      },
      pre_expressions: [],
      expressions: [
        {
          expr: {
            List: [
              {
                expr: {
                  Atom: "define-public",
                },
                id: 2,
                span: {
                  start_line: 1,
                  start_column: 2,
                  end_line: 1,
                  end_column: 14,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "function",
                      },
                      id: 4,
                      span: {
                        start_line: 1,
                        start_column: 17,
                        end_line: 1,
                        end_column: 24,
                      },
                    },
                  ],
                },
                id: 3,
                span: {
                  start_line: 1,
                  start_column: 16,
                  end_line: 1,
                  end_column: 25,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "ok",
                      },
                      id: 6,
                      span: {
                        start_line: 2,
                        start_column: 4,
                        end_line: 2,
                        end_column: 5,
                      },
                    },
                    {
                      expr: {
                        Atom: "true",
                      },
                      id: 7,
                      span: {
                        start_line: 2,
                        start_column: 7,
                        end_line: 2,
                        end_column: 10,
                      },
                    },
                  ],
                },
                id: 5,
                span: {
                  start_line: 2,
                  start_column: 3,
                  end_line: 2,
                  end_column: 11,
                },
              },
            ],
          },
          id: 1,
          span: {
            start_line: 1,
            start_column: 1,
            end_line: 3,
            end_column: 1,
          },
        },
        {
          expr: {
            List: [
              {
                expr: {
                  Atom: "define-map",
                },
                id: 9,
                span: {
                  start_line: 6,
                  start_column: 2,
                  end_line: 6,
                  end_column: 11,
                },
              },
              {
                expr: {
                  Atom: "context",
                },
                id: 10,
                span: {
                  start_line: 6,
                  start_column: 13,
                  end_line: 6,
                  end_column: 19,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "string-ascii",
                      },
                      id: 12,
                      span: {
                        start_line: 6,
                        start_column: 22,
                        end_line: 6,
                        end_column: 33,
                      },
                    },
                    {
                      expr: {
                        LiteralValue: {
                          Int: "100",
                        },
                      },
                      id: 13,
                      span: {
                        start_line: 6,
                        start_column: 35,
                        end_line: 6,
                        end_column: 37,
                      },
                    },
                  ],
                },
                id: 11,
                span: {
                  start_line: 6,
                  start_column: 21,
                  end_line: 6,
                  end_column: 38,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "tuple",
                      },
                      id: 15,
                      span: {
                        start_line: 0,
                        start_column: 0,
                        end_line: 0,
                        end_column: 0,
                      },
                    },
                    {
                      expr: {
                        List: [
                          {
                            expr: {
                              Atom: "called",
                            },
                            id: 17,
                            span: {
                              start_line: 7,
                              start_column: 5,
                              end_line: 7,
                              end_column: 10,
                            },
                          },
                          {
                            expr: {
                              Atom: "uint",
                            },
                            id: 18,
                            span: {
                              start_line: 7,
                              start_column: 13,
                              end_line: 7,
                              end_column: 16,
                            },
                            post_comments: [
                              [
                                "other data",
                                {
                                  start_line: 8,
                                  start_column: 5,
                                  end_line: 8,
                                  end_column: 17,
                                },
                              ],
                            ],
                          },
                        ],
                      },
                      id: 16,
                      span: {
                        start_line: 7,
                        start_column: 5,
                        end_line: 7,
                        end_column: 16,
                      },
                    },
                  ],
                },
                id: 14,
                span: {
                  start_line: 6,
                  start_column: 40,
                  end_line: 9,
                  end_column: 3,
                },
              },
            ],
          },
          id: 8,
          span: {
            start_line: 6,
            start_column: 1,
            end_line: 9,
            end_column: 4,
          },
        },
        {
          expr: {
            List: [
              {
                expr: {
                  Atom: "define-public",
                },
                id: 20,
                span: {
                  start_line: 11,
                  start_column: 4,
                  end_line: 11,
                  end_column: 16,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "update-context",
                      },
                      id: 22,
                      span: {
                        start_line: 11,
                        start_column: 19,
                        end_line: 11,
                        end_column: 32,
                      },
                    },
                    {
                      expr: {
                        List: [
                          {
                            expr: {
                              Atom: "function-name",
                            },
                            id: 24,
                            span: {
                              start_line: 11,
                              start_column: 35,
                              end_line: 11,
                              end_column: 47,
                            },
                          },
                          {
                            expr: {
                              List: [
                                {
                                  expr: {
                                    Atom: "string-ascii",
                                  },
                                  id: 26,
                                  span: {
                                    start_line: 11,
                                    start_column: 50,
                                    end_line: 11,
                                    end_column: 61,
                                  },
                                },
                                {
                                  expr: {
                                    LiteralValue: {
                                      Int: "100",
                                    },
                                  },
                                  id: 27,
                                  span: {
                                    start_line: 11,
                                    start_column: 63,
                                    end_line: 11,
                                    end_column: 65,
                                  },
                                },
                              ],
                            },
                            id: 25,
                            span: {
                              start_line: 11,
                              start_column: 49,
                              end_line: 11,
                              end_column: 66,
                            },
                          },
                        ],
                      },
                      id: 23,
                      span: {
                        start_line: 11,
                        start_column: 34,
                        end_line: 11,
                        end_column: 67,
                      },
                    },
                    {
                      expr: {
                        List: [
                          {
                            expr: {
                              Atom: "called",
                            },
                            id: 29,
                            span: {
                              start_line: 11,
                              start_column: 70,
                              end_line: 11,
                              end_column: 75,
                            },
                          },
                          {
                            expr: {
                              Atom: "uint",
                            },
                            id: 30,
                            span: {
                              start_line: 11,
                              start_column: 77,
                              end_line: 11,
                              end_column: 80,
                            },
                          },
                        ],
                      },
                      id: 28,
                      span: {
                        start_line: 11,
                        start_column: 69,
                        end_line: 11,
                        end_column: 81,
                      },
                    },
                  ],
                },
                id: 21,
                span: {
                  start_line: 11,
                  start_column: 18,
                  end_line: 11,
                  end_column: 82,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "ok",
                      },
                      id: 32,
                      span: {
                        start_line: 12,
                        start_column: 6,
                        end_line: 12,
                        end_column: 7,
                      },
                    },
                    {
                      expr: {
                        List: [
                          {
                            expr: {
                              Atom: "map-set",
                            },
                            id: 34,
                            span: {
                              start_line: 12,
                              start_column: 10,
                              end_line: 12,
                              end_column: 16,
                            },
                          },
                          {
                            expr: {
                              Atom: "context",
                            },
                            id: 35,
                            span: {
                              start_line: 12,
                              start_column: 18,
                              end_line: 12,
                              end_column: 24,
                            },
                          },
                          {
                            expr: {
                              Atom: "function-name",
                            },
                            id: 36,
                            span: {
                              start_line: 12,
                              start_column: 26,
                              end_line: 12,
                              end_column: 38,
                            },
                          },
                          {
                            expr: {
                              List: [
                                {
                                  expr: {
                                    Atom: "tuple",
                                  },
                                  id: 38,
                                  span: {
                                    start_line: 0,
                                    start_column: 0,
                                    end_line: 0,
                                    end_column: 0,
                                  },
                                },
                                {
                                  expr: {
                                    List: [
                                      {
                                        expr: {
                                          Atom: "called",
                                        },
                                        id: 40,
                                        span: {
                                          start_line: 12,
                                          start_column: 41,
                                          end_line: 12,
                                          end_column: 46,
                                        },
                                      },
                                      {
                                        expr: {
                                          Atom: "called",
                                        },
                                        id: 41,
                                        span: {
                                          start_line: 12,
                                          start_column: 49,
                                          end_line: 12,
                                          end_column: 54,
                                        },
                                      },
                                    ],
                                  },
                                  id: 39,
                                  span: {
                                    start_line: 12,
                                    start_column: 41,
                                    end_line: 12,
                                    end_column: 54,
                                  },
                                },
                              ],
                            },
                            id: 37,
                            span: {
                              start_line: 12,
                              start_column: 40,
                              end_line: 12,
                              end_column: 55,
                            },
                          },
                        ],
                      },
                      id: 33,
                      span: {
                        start_line: 12,
                        start_column: 9,
                        end_line: 12,
                        end_column: 56,
                      },
                    },
                  ],
                },
                id: 31,
                span: {
                  start_line: 12,
                  start_column: 5,
                  end_line: 12,
                  end_column: 57,
                },
              },
            ],
          },
          id: 19,
          span: {
            start_line: 11,
            start_column: 3,
            end_line: 12,
            end_column: 58,
          },
        },
        {
          expr: {
            List: [
              {
                expr: {
                  Atom: "use-trait",
                },
                id: 43,
                span: {
                  start_line: 14,
                  start_column: 2,
                  end_line: 14,
                  end_column: 10,
                },
              },
              {
                expr: {
                  Atom: "ft-trait",
                },
                id: 44,
                span: {
                  start_line: 14,
                  start_column: 12,
                  end_line: 14,
                  end_column: 19,
                },
              },
              {
                expr: {
                  Field: {
                    name: "sip-010-trait",
                    contract_identifier: {
                      issuer: [
                        22,
                        [
                          9, 159, 184, 137, 38, 216, 47, 48, 178, 244, 14, 175,
                          62, 228, 35, 203, 114, 91, 219, 59,
                        ],
                      ],
                      name: "sip-010-trait-ft-standard",
                    },
                  },
                },
                id: 45,
                span: {
                  start_line: 14,
                  start_column: 21,
                  end_line: 14,
                  end_column: 101,
                },
              },
            ],
          },
          id: 42,
          span: {
            start_line: 14,
            start_column: 1,
            end_line: 14,
            end_column: 102,
          },
        },
        {
          expr: {
            List: [
              {
                expr: {
                  Atom: "define-public",
                },
                id: 47,
                span: {
                  start_line: 16,
                  start_column: 2,
                  end_line: 16,
                  end_column: 14,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "test-no-trait",
                      },
                      id: 49,
                      span: {
                        start_line: 16,
                        start_column: 17,
                        end_line: 16,
                        end_column: 29,
                      },
                    },
                  ],
                },
                id: 48,
                span: {
                  start_line: 16,
                  start_column: 16,
                  end_line: 16,
                  end_column: 30,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "ok",
                      },
                      id: 51,
                      span: {
                        start_line: 17,
                        start_column: 4,
                        end_line: 17,
                        end_column: 5,
                      },
                    },
                    {
                      expr: {
                        Atom: "true",
                      },
                      id: 52,
                      span: {
                        start_line: 17,
                        start_column: 7,
                        end_line: 17,
                        end_column: 10,
                      },
                    },
                  ],
                },
                id: 50,
                span: {
                  start_line: 17,
                  start_column: 3,
                  end_line: 17,
                  end_column: 11,
                },
              },
            ],
          },
          id: 46,
          span: {
            start_line: 16,
            start_column: 1,
            end_line: 18,
            end_column: 1,
          },
        },
        {
          expr: {
            List: [
              {
                expr: {
                  Atom: "define-public",
                },
                id: 54,
                span: {
                  start_line: 20,
                  start_column: 2,
                  end_line: 20,
                  end_column: 14,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "test-trait",
                      },
                      id: 56,
                      span: {
                        start_line: 20,
                        start_column: 17,
                        end_line: 20,
                        end_column: 26,
                      },
                    },
                    {
                      expr: {
                        List: [
                          {
                            expr: {
                              Atom: "a",
                            },
                            id: 58,
                            span: {
                              start_line: 20,
                              start_column: 29,
                              end_line: 20,
                              end_column: 29,
                            },
                          },
                          {
                            expr: {
                              Atom: "uint",
                            },
                            id: 59,
                            span: {
                              start_line: 20,
                              start_column: 31,
                              end_line: 20,
                              end_column: 34,
                            },
                          },
                        ],
                      },
                      id: 57,
                      span: {
                        start_line: 20,
                        start_column: 28,
                        end_line: 20,
                        end_column: 35,
                      },
                    },
                    {
                      expr: {
                        List: [
                          {
                            expr: {
                              Atom: "b",
                            },
                            id: 61,
                            span: {
                              start_line: 20,
                              start_column: 38,
                              end_line: 20,
                              end_column: 38,
                            },
                          },
                          {
                            expr: {
                              Atom: "int",
                            },
                            id: 62,
                            span: {
                              start_line: 20,
                              start_column: 40,
                              end_line: 20,
                              end_column: 42,
                            },
                          },
                        ],
                      },
                      id: 60,
                      span: {
                        start_line: 20,
                        start_column: 37,
                        end_line: 20,
                        end_column: 43,
                      },
                    },
                    {
                      expr: {
                        List: [
                          {
                            expr: {
                              Atom: "c",
                            },
                            id: 64,
                            span: {
                              start_line: 20,
                              start_column: 46,
                              end_line: 20,
                              end_column: 46,
                            },
                          },
                          {
                            expr: {
                              Atom: "bool",
                            },
                            id: 65,
                            span: {
                              start_line: 20,
                              start_column: 48,
                              end_line: 20,
                              end_column: 51,
                            },
                          },
                        ],
                      },
                      id: 63,
                      span: {
                        start_line: 20,
                        start_column: 45,
                        end_line: 20,
                        end_column: 52,
                      },
                    },
                    {
                      expr: {
                        List: [
                          {
                            expr: {
                              Atom: "d",
                            },
                            id: 67,
                            span: {
                              start_line: 20,
                              start_column: 55,
                              end_line: 20,
                              end_column: 55,
                            },
                          },
                          {
                            expr: {
                              List: [
                                {
                                  expr: {
                                    Atom: "string-ascii",
                                  },
                                  id: 69,
                                  span: {
                                    start_line: 20,
                                    start_column: 58,
                                    end_line: 20,
                                    end_column: 69,
                                  },
                                },
                                {
                                  expr: {
                                    LiteralValue: {
                                      Int: "10",
                                    },
                                  },
                                  id: 70,
                                  span: {
                                    start_line: 20,
                                    start_column: 71,
                                    end_line: 20,
                                    end_column: 72,
                                  },
                                },
                              ],
                            },
                            id: 68,
                            span: {
                              start_line: 20,
                              start_column: 57,
                              end_line: 20,
                              end_column: 73,
                            },
                          },
                        ],
                      },
                      id: 66,
                      span: {
                        start_line: 20,
                        start_column: 54,
                        end_line: 20,
                        end_column: 74,
                      },
                    },
                    {
                      expr: {
                        List: [
                          {
                            expr: {
                              Atom: "e",
                            },
                            id: 72,
                            span: {
                              start_line: 20,
                              start_column: 77,
                              end_line: 20,
                              end_column: 77,
                            },
                          },
                          {
                            expr: {
                              TraitReference: [
                                "ft-trait",
                                {
                                  Imported: {
                                    name: "sip-010-trait",
                                    contract_identifier: {
                                      issuer: [
                                        22,
                                        [
                                          9, 159, 184, 137, 38, 216, 47, 48,
                                          178, 244, 14, 175, 62, 228, 35, 203,
                                          114, 91, 219, 59,
                                        ],
                                      ],
                                      name: "sip-010-trait-ft-standard",
                                    },
                                  },
                                },
                              ],
                            },
                            id: 73,
                            span: {
                              start_line: 20,
                              start_column: 79,
                              end_line: 20,
                              end_column: 88,
                            },
                          },
                        ],
                      },
                      id: 71,
                      span: {
                        start_line: 20,
                        start_column: 76,
                        end_line: 20,
                        end_column: 89,
                      },
                    },
                  ],
                },
                id: 55,
                span: {
                  start_line: 20,
                  start_column: 16,
                  end_line: 20,
                  end_column: 90,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "ok",
                      },
                      id: 75,
                      span: {
                        start_line: 21,
                        start_column: 4,
                        end_line: 21,
                        end_column: 5,
                      },
                    },
                    {
                      expr: {
                        Atom: "true",
                      },
                      id: 76,
                      span: {
                        start_line: 21,
                        start_column: 7,
                        end_line: 21,
                        end_column: 10,
                      },
                    },
                  ],
                },
                id: 74,
                span: {
                  start_line: 21,
                  start_column: 3,
                  end_line: 21,
                  end_column: 11,
                },
              },
            ],
          },
          id: 53,
          span: {
            start_line: 20,
            start_column: 1,
            end_line: 22,
            end_column: 1,
          },
        },
      ],
      top_level_expression_sorting: [0, 1, 2, 3, 4, 5],
      referenced_traits: {},
      implemented_traits: [],
    },
  },
  directTraitParameterPublicAndReadOnlyFunctions: {
    functionsInterfaces: [
      {
        name: "function",
        access: "public",
        args: [],
        outputs: {
          type: {
            response: {
              ok: "bool",
              error: "none",
            },
          },
        },
      },
      {
        name: "test-no-trait",
        access: "public",
        args: [],
        outputs: {
          type: {
            response: {
              ok: "bool",
              error: "none",
            },
          },
        },
      },
      {
        name: "test-trait",
        access: "public",
        args: [
          {
            name: "token",
            type: "trait_reference",
          },
        ],
        outputs: {
          type: {
            response: {
              ok: "bool",
              error: "none",
            },
          },
        },
      },
      {
        name: "update-context",
        access: "public",
        args: [
          {
            name: "function-name",
            type: {
              "string-ascii": {
                length: 100,
              },
            },
          },
          {
            name: "called",
            type: "uint128",
          },
        ],
        outputs: {
          type: {
            response: {
              ok: "bool",
              error: "none",
            },
          },
        },
      },
      {
        name: "invariant-trait",
        access: "read_only",
        args: [
          {
            name: "token",
            type: "trait_reference",
          },
        ],
        outputs: {
          type: "bool",
        },
      },
    ],
    ast: {
      contract_identifier: {
        issuer: [
          26,
          [
            109, 120, 222, 123, 6, 37, 223, 191, 193, 108, 58, 138, 87, 53, 246,
            220, 61, 195, 242, 206,
          ],
        ],
        name: "trait",
      },
      pre_expressions: [],
      expressions: [
        {
          expr: {
            List: [
              {
                expr: {
                  Atom: "define-public",
                },
                id: 2,
                span: {
                  start_line: 1,
                  start_column: 2,
                  end_line: 1,
                  end_column: 14,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "function",
                      },
                      id: 4,
                      span: {
                        start_line: 1,
                        start_column: 17,
                        end_line: 1,
                        end_column: 24,
                      },
                    },
                  ],
                },
                id: 3,
                span: {
                  start_line: 1,
                  start_column: 16,
                  end_line: 1,
                  end_column: 25,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "ok",
                      },
                      id: 6,
                      span: {
                        start_line: 2,
                        start_column: 4,
                        end_line: 2,
                        end_column: 5,
                      },
                    },
                    {
                      expr: {
                        Atom: "true",
                      },
                      id: 7,
                      span: {
                        start_line: 2,
                        start_column: 7,
                        end_line: 2,
                        end_column: 10,
                      },
                    },
                  ],
                },
                id: 5,
                span: {
                  start_line: 2,
                  start_column: 3,
                  end_line: 2,
                  end_column: 11,
                },
              },
            ],
          },
          id: 1,
          span: {
            start_line: 1,
            start_column: 1,
            end_line: 3,
            end_column: 1,
          },
        },
        {
          expr: {
            List: [
              {
                expr: {
                  Atom: "define-map",
                },
                id: 9,
                span: {
                  start_line: 6,
                  start_column: 2,
                  end_line: 6,
                  end_column: 11,
                },
              },
              {
                expr: {
                  Atom: "context",
                },
                id: 10,
                span: {
                  start_line: 6,
                  start_column: 13,
                  end_line: 6,
                  end_column: 19,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "string-ascii",
                      },
                      id: 12,
                      span: {
                        start_line: 6,
                        start_column: 22,
                        end_line: 6,
                        end_column: 33,
                      },
                    },
                    {
                      expr: {
                        LiteralValue: {
                          Int: "100",
                        },
                      },
                      id: 13,
                      span: {
                        start_line: 6,
                        start_column: 35,
                        end_line: 6,
                        end_column: 37,
                      },
                    },
                  ],
                },
                id: 11,
                span: {
                  start_line: 6,
                  start_column: 21,
                  end_line: 6,
                  end_column: 38,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "tuple",
                      },
                      id: 15,
                      span: {
                        start_line: 0,
                        start_column: 0,
                        end_line: 0,
                        end_column: 0,
                      },
                    },
                    {
                      expr: {
                        List: [
                          {
                            expr: {
                              Atom: "called",
                            },
                            id: 17,
                            span: {
                              start_line: 7,
                              start_column: 5,
                              end_line: 7,
                              end_column: 10,
                            },
                          },
                          {
                            expr: {
                              Atom: "uint",
                            },
                            id: 18,
                            span: {
                              start_line: 7,
                              start_column: 13,
                              end_line: 7,
                              end_column: 16,
                            },
                            post_comments: [
                              [
                                "other data",
                                {
                                  start_line: 8,
                                  start_column: 5,
                                  end_line: 8,
                                  end_column: 17,
                                },
                              ],
                            ],
                          },
                        ],
                      },
                      id: 16,
                      span: {
                        start_line: 7,
                        start_column: 5,
                        end_line: 7,
                        end_column: 16,
                      },
                    },
                  ],
                },
                id: 14,
                span: {
                  start_line: 6,
                  start_column: 40,
                  end_line: 9,
                  end_column: 3,
                },
              },
            ],
          },
          id: 8,
          span: {
            start_line: 6,
            start_column: 1,
            end_line: 9,
            end_column: 4,
          },
        },
        {
          expr: {
            List: [
              {
                expr: {
                  Atom: "define-public",
                },
                id: 20,
                span: {
                  start_line: 11,
                  start_column: 4,
                  end_line: 11,
                  end_column: 16,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "update-context",
                      },
                      id: 22,
                      span: {
                        start_line: 11,
                        start_column: 19,
                        end_line: 11,
                        end_column: 32,
                      },
                    },
                    {
                      expr: {
                        List: [
                          {
                            expr: {
                              Atom: "function-name",
                            },
                            id: 24,
                            span: {
                              start_line: 11,
                              start_column: 35,
                              end_line: 11,
                              end_column: 47,
                            },
                          },
                          {
                            expr: {
                              List: [
                                {
                                  expr: {
                                    Atom: "string-ascii",
                                  },
                                  id: 26,
                                  span: {
                                    start_line: 11,
                                    start_column: 50,
                                    end_line: 11,
                                    end_column: 61,
                                  },
                                },
                                {
                                  expr: {
                                    LiteralValue: {
                                      Int: "100",
                                    },
                                  },
                                  id: 27,
                                  span: {
                                    start_line: 11,
                                    start_column: 63,
                                    end_line: 11,
                                    end_column: 65,
                                  },
                                },
                              ],
                            },
                            id: 25,
                            span: {
                              start_line: 11,
                              start_column: 49,
                              end_line: 11,
                              end_column: 66,
                            },
                          },
                        ],
                      },
                      id: 23,
                      span: {
                        start_line: 11,
                        start_column: 34,
                        end_line: 11,
                        end_column: 67,
                      },
                    },
                    {
                      expr: {
                        List: [
                          {
                            expr: {
                              Atom: "called",
                            },
                            id: 29,
                            span: {
                              start_line: 11,
                              start_column: 70,
                              end_line: 11,
                              end_column: 75,
                            },
                          },
                          {
                            expr: {
                              Atom: "uint",
                            },
                            id: 30,
                            span: {
                              start_line: 11,
                              start_column: 77,
                              end_line: 11,
                              end_column: 80,
                            },
                          },
                        ],
                      },
                      id: 28,
                      span: {
                        start_line: 11,
                        start_column: 69,
                        end_line: 11,
                        end_column: 81,
                      },
                    },
                  ],
                },
                id: 21,
                span: {
                  start_line: 11,
                  start_column: 18,
                  end_line: 11,
                  end_column: 82,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "ok",
                      },
                      id: 32,
                      span: {
                        start_line: 12,
                        start_column: 6,
                        end_line: 12,
                        end_column: 7,
                      },
                    },
                    {
                      expr: {
                        List: [
                          {
                            expr: {
                              Atom: "map-set",
                            },
                            id: 34,
                            span: {
                              start_line: 12,
                              start_column: 10,
                              end_line: 12,
                              end_column: 16,
                            },
                          },
                          {
                            expr: {
                              Atom: "context",
                            },
                            id: 35,
                            span: {
                              start_line: 12,
                              start_column: 18,
                              end_line: 12,
                              end_column: 24,
                            },
                          },
                          {
                            expr: {
                              Atom: "function-name",
                            },
                            id: 36,
                            span: {
                              start_line: 12,
                              start_column: 26,
                              end_line: 12,
                              end_column: 38,
                            },
                          },
                          {
                            expr: {
                              List: [
                                {
                                  expr: {
                                    Atom: "tuple",
                                  },
                                  id: 38,
                                  span: {
                                    start_line: 0,
                                    start_column: 0,
                                    end_line: 0,
                                    end_column: 0,
                                  },
                                },
                                {
                                  expr: {
                                    List: [
                                      {
                                        expr: {
                                          Atom: "called",
                                        },
                                        id: 40,
                                        span: {
                                          start_line: 12,
                                          start_column: 41,
                                          end_line: 12,
                                          end_column: 46,
                                        },
                                      },
                                      {
                                        expr: {
                                          Atom: "called",
                                        },
                                        id: 41,
                                        span: {
                                          start_line: 12,
                                          start_column: 49,
                                          end_line: 12,
                                          end_column: 54,
                                        },
                                      },
                                    ],
                                  },
                                  id: 39,
                                  span: {
                                    start_line: 12,
                                    start_column: 41,
                                    end_line: 12,
                                    end_column: 54,
                                  },
                                },
                              ],
                            },
                            id: 37,
                            span: {
                              start_line: 12,
                              start_column: 40,
                              end_line: 12,
                              end_column: 55,
                            },
                          },
                        ],
                      },
                      id: 33,
                      span: {
                        start_line: 12,
                        start_column: 9,
                        end_line: 12,
                        end_column: 56,
                      },
                    },
                  ],
                },
                id: 31,
                span: {
                  start_line: 12,
                  start_column: 5,
                  end_line: 12,
                  end_column: 57,
                },
              },
            ],
          },
          id: 19,
          span: {
            start_line: 11,
            start_column: 3,
            end_line: 12,
            end_column: 58,
          },
        },
        {
          expr: {
            List: [
              {
                expr: {
                  Atom: "use-trait",
                },
                id: 43,
                span: {
                  start_line: 14,
                  start_column: 2,
                  end_line: 14,
                  end_column: 10,
                },
              },
              {
                expr: {
                  Atom: "ft-trait",
                },
                id: 44,
                span: {
                  start_line: 14,
                  start_column: 12,
                  end_line: 14,
                  end_column: 19,
                },
              },
              {
                expr: {
                  Field: {
                    name: "sip-010-trait",
                    contract_identifier: {
                      issuer: [
                        22,
                        [
                          9, 159, 184, 137, 38, 216, 47, 48, 178, 244, 14, 175,
                          62, 228, 35, 203, 114, 91, 219, 59,
                        ],
                      ],
                      name: "sip-010-trait-ft-standard",
                    },
                  },
                },
                id: 45,
                span: {
                  start_line: 14,
                  start_column: 21,
                  end_line: 14,
                  end_column: 101,
                },
              },
            ],
          },
          id: 42,
          span: {
            start_line: 14,
            start_column: 1,
            end_line: 14,
            end_column: 102,
          },
        },
        {
          expr: {
            List: [
              {
                expr: {
                  Atom: "define-public",
                },
                id: 47,
                span: {
                  start_line: 16,
                  start_column: 2,
                  end_line: 16,
                  end_column: 14,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "test-no-trait",
                      },
                      id: 49,
                      span: {
                        start_line: 16,
                        start_column: 17,
                        end_line: 16,
                        end_column: 29,
                      },
                    },
                  ],
                },
                id: 48,
                span: {
                  start_line: 16,
                  start_column: 16,
                  end_line: 16,
                  end_column: 30,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "ok",
                      },
                      id: 51,
                      span: {
                        start_line: 17,
                        start_column: 4,
                        end_line: 17,
                        end_column: 5,
                      },
                    },
                    {
                      expr: {
                        Atom: "true",
                      },
                      id: 52,
                      span: {
                        start_line: 17,
                        start_column: 7,
                        end_line: 17,
                        end_column: 10,
                      },
                    },
                  ],
                },
                id: 50,
                span: {
                  start_line: 17,
                  start_column: 3,
                  end_line: 17,
                  end_column: 11,
                },
              },
            ],
          },
          id: 46,
          span: {
            start_line: 16,
            start_column: 1,
            end_line: 18,
            end_column: 1,
          },
        },
        {
          expr: {
            List: [
              {
                expr: {
                  Atom: "define-public",
                },
                id: 54,
                span: {
                  start_line: 20,
                  start_column: 2,
                  end_line: 20,
                  end_column: 14,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "test-trait",
                      },
                      id: 56,
                      span: {
                        start_line: 20,
                        start_column: 17,
                        end_line: 20,
                        end_column: 26,
                      },
                    },
                    {
                      expr: {
                        List: [
                          {
                            expr: {
                              Atom: "token",
                            },
                            id: 58,
                            span: {
                              start_line: 20,
                              start_column: 29,
                              end_line: 20,
                              end_column: 33,
                            },
                          },
                          {
                            expr: {
                              TraitReference: [
                                "ft-trait",
                                {
                                  Imported: {
                                    name: "sip-010-trait",
                                    contract_identifier: {
                                      issuer: [
                                        22,
                                        [
                                          9, 159, 184, 137, 38, 216, 47, 48,
                                          178, 244, 14, 175, 62, 228, 35, 203,
                                          114, 91, 219, 59,
                                        ],
                                      ],
                                      name: "sip-010-trait-ft-standard",
                                    },
                                  },
                                },
                              ],
                            },
                            id: 59,
                            span: {
                              start_line: 20,
                              start_column: 35,
                              end_line: 20,
                              end_column: 44,
                            },
                          },
                        ],
                      },
                      id: 57,
                      span: {
                        start_line: 20,
                        start_column: 28,
                        end_line: 20,
                        end_column: 45,
                      },
                    },
                  ],
                },
                id: 55,
                span: {
                  start_line: 20,
                  start_column: 16,
                  end_line: 20,
                  end_column: 46,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "ok",
                      },
                      id: 61,
                      span: {
                        start_line: 21,
                        start_column: 4,
                        end_line: 21,
                        end_column: 5,
                      },
                    },
                    {
                      expr: {
                        Atom: "true",
                      },
                      id: 62,
                      span: {
                        start_line: 21,
                        start_column: 7,
                        end_line: 21,
                        end_column: 10,
                      },
                    },
                  ],
                },
                id: 60,
                span: {
                  start_line: 21,
                  start_column: 3,
                  end_line: 21,
                  end_column: 11,
                },
              },
            ],
          },
          id: 53,
          span: {
            start_line: 20,
            start_column: 1,
            end_line: 22,
            end_column: 1,
          },
        },
        {
          expr: {
            List: [
              {
                expr: {
                  Atom: "define-read-only",
                },
                id: 64,
                span: {
                  start_line: 24,
                  start_column: 2,
                  end_line: 24,
                  end_column: 17,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "invariant-trait",
                      },
                      id: 66,
                      span: {
                        start_line: 24,
                        start_column: 20,
                        end_line: 24,
                        end_column: 34,
                      },
                    },
                    {
                      expr: {
                        List: [
                          {
                            expr: {
                              Atom: "token",
                            },
                            id: 68,
                            span: {
                              start_line: 24,
                              start_column: 37,
                              end_line: 24,
                              end_column: 41,
                            },
                          },
                          {
                            expr: {
                              TraitReference: [
                                "ft-trait",
                                {
                                  Imported: {
                                    name: "sip-010-trait",
                                    contract_identifier: {
                                      issuer: [
                                        22,
                                        [
                                          9, 159, 184, 137, 38, 216, 47, 48,
                                          178, 244, 14, 175, 62, 228, 35, 203,
                                          114, 91, 219, 59,
                                        ],
                                      ],
                                      name: "sip-010-trait-ft-standard",
                                    },
                                  },
                                },
                              ],
                            },
                            id: 69,
                            span: {
                              start_line: 24,
                              start_column: 43,
                              end_line: 24,
                              end_column: 52,
                            },
                          },
                        ],
                      },
                      id: 67,
                      span: {
                        start_line: 24,
                        start_column: 36,
                        end_line: 24,
                        end_column: 53,
                      },
                    },
                  ],
                },
                id: 65,
                span: {
                  start_line: 24,
                  start_column: 19,
                  end_line: 24,
                  end_column: 54,
                },
              },
              {
                expr: {
                  Atom: "true",
                },
                id: 70,
                span: {
                  start_line: 25,
                  start_column: 3,
                  end_line: 25,
                  end_column: 6,
                },
              },
            ],
          },
          id: 63,
          span: {
            start_line: 24,
            start_column: 1,
            end_line: 26,
            end_column: 1,
          },
        },
      ],
      top_level_expression_sorting: [0, 1, 2, 3, 4, 5, 6],
      referenced_traits: {},
      implemented_traits: [],
    },
  },
  listTraitParameter: {
    functionsInterfaces: [
      {
        name: "function",
        access: "public",
        args: [],
        outputs: {
          type: {
            response: {
              ok: "bool",
              error: "none",
            },
          },
        },
      },
      {
        name: "test-no-trait",
        access: "public",
        args: [],
        outputs: {
          type: {
            response: {
              ok: "bool",
              error: "none",
            },
          },
        },
      },
      {
        name: "test-trait",
        access: "public",
        args: [
          {
            name: "token-list",
            type: {
              list: {
                type: "trait_reference",
                length: 5,
              },
            },
          },
        ],
        outputs: {
          type: {
            response: {
              ok: "bool",
              error: "none",
            },
          },
        },
      },
      {
        name: "update-context",
        access: "public",
        args: [
          {
            name: "function-name",
            type: {
              "string-ascii": {
                length: 100,
              },
            },
          },
          {
            name: "called",
            type: "uint128",
          },
        ],
        outputs: {
          type: {
            response: {
              ok: "bool",
              error: "none",
            },
          },
        },
      },
    ],
    ast: {
      contract_identifier: {
        issuer: [
          26,
          [
            109, 120, 222, 123, 6, 37, 223, 191, 193, 108, 58, 138, 87, 53, 246,
            220, 61, 195, 242, 206,
          ],
        ],
        name: "trait",
      },
      pre_expressions: [],
      expressions: [
        {
          expr: {
            List: [
              {
                expr: {
                  Atom: "define-public",
                },
                id: 2,
                span: {
                  start_line: 1,
                  start_column: 2,
                  end_line: 1,
                  end_column: 14,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "function",
                      },
                      id: 4,
                      span: {
                        start_line: 1,
                        start_column: 17,
                        end_line: 1,
                        end_column: 24,
                      },
                    },
                  ],
                },
                id: 3,
                span: {
                  start_line: 1,
                  start_column: 16,
                  end_line: 1,
                  end_column: 25,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "ok",
                      },
                      id: 6,
                      span: {
                        start_line: 2,
                        start_column: 4,
                        end_line: 2,
                        end_column: 5,
                      },
                    },
                    {
                      expr: {
                        Atom: "true",
                      },
                      id: 7,
                      span: {
                        start_line: 2,
                        start_column: 7,
                        end_line: 2,
                        end_column: 10,
                      },
                    },
                  ],
                },
                id: 5,
                span: {
                  start_line: 2,
                  start_column: 3,
                  end_line: 2,
                  end_column: 11,
                },
              },
            ],
          },
          id: 1,
          span: {
            start_line: 1,
            start_column: 1,
            end_line: 3,
            end_column: 1,
          },
        },
        {
          expr: {
            List: [
              {
                expr: {
                  Atom: "define-map",
                },
                id: 9,
                span: {
                  start_line: 6,
                  start_column: 2,
                  end_line: 6,
                  end_column: 11,
                },
              },
              {
                expr: {
                  Atom: "context",
                },
                id: 10,
                span: {
                  start_line: 6,
                  start_column: 13,
                  end_line: 6,
                  end_column: 19,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "string-ascii",
                      },
                      id: 12,
                      span: {
                        start_line: 6,
                        start_column: 22,
                        end_line: 6,
                        end_column: 33,
                      },
                    },
                    {
                      expr: {
                        LiteralValue: {
                          Int: "100",
                        },
                      },
                      id: 13,
                      span: {
                        start_line: 6,
                        start_column: 35,
                        end_line: 6,
                        end_column: 37,
                      },
                    },
                  ],
                },
                id: 11,
                span: {
                  start_line: 6,
                  start_column: 21,
                  end_line: 6,
                  end_column: 38,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "tuple",
                      },
                      id: 15,
                      span: {
                        start_line: 0,
                        start_column: 0,
                        end_line: 0,
                        end_column: 0,
                      },
                    },
                    {
                      expr: {
                        List: [
                          {
                            expr: {
                              Atom: "called",
                            },
                            id: 17,
                            span: {
                              start_line: 7,
                              start_column: 5,
                              end_line: 7,
                              end_column: 10,
                            },
                          },
                          {
                            expr: {
                              Atom: "uint",
                            },
                            id: 18,
                            span: {
                              start_line: 7,
                              start_column: 13,
                              end_line: 7,
                              end_column: 16,
                            },
                            post_comments: [
                              [
                                "other data",
                                {
                                  start_line: 8,
                                  start_column: 5,
                                  end_line: 8,
                                  end_column: 17,
                                },
                              ],
                            ],
                          },
                        ],
                      },
                      id: 16,
                      span: {
                        start_line: 7,
                        start_column: 5,
                        end_line: 7,
                        end_column: 16,
                      },
                    },
                  ],
                },
                id: 14,
                span: {
                  start_line: 6,
                  start_column: 40,
                  end_line: 9,
                  end_column: 3,
                },
              },
            ],
          },
          id: 8,
          span: {
            start_line: 6,
            start_column: 1,
            end_line: 9,
            end_column: 4,
          },
        },
        {
          expr: {
            List: [
              {
                expr: {
                  Atom: "define-public",
                },
                id: 20,
                span: {
                  start_line: 11,
                  start_column: 4,
                  end_line: 11,
                  end_column: 16,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "update-context",
                      },
                      id: 22,
                      span: {
                        start_line: 11,
                        start_column: 19,
                        end_line: 11,
                        end_column: 32,
                      },
                    },
                    {
                      expr: {
                        List: [
                          {
                            expr: {
                              Atom: "function-name",
                            },
                            id: 24,
                            span: {
                              start_line: 11,
                              start_column: 35,
                              end_line: 11,
                              end_column: 47,
                            },
                          },
                          {
                            expr: {
                              List: [
                                {
                                  expr: {
                                    Atom: "string-ascii",
                                  },
                                  id: 26,
                                  span: {
                                    start_line: 11,
                                    start_column: 50,
                                    end_line: 11,
                                    end_column: 61,
                                  },
                                },
                                {
                                  expr: {
                                    LiteralValue: {
                                      Int: "100",
                                    },
                                  },
                                  id: 27,
                                  span: {
                                    start_line: 11,
                                    start_column: 63,
                                    end_line: 11,
                                    end_column: 65,
                                  },
                                },
                              ],
                            },
                            id: 25,
                            span: {
                              start_line: 11,
                              start_column: 49,
                              end_line: 11,
                              end_column: 66,
                            },
                          },
                        ],
                      },
                      id: 23,
                      span: {
                        start_line: 11,
                        start_column: 34,
                        end_line: 11,
                        end_column: 67,
                      },
                    },
                    {
                      expr: {
                        List: [
                          {
                            expr: {
                              Atom: "called",
                            },
                            id: 29,
                            span: {
                              start_line: 11,
                              start_column: 70,
                              end_line: 11,
                              end_column: 75,
                            },
                          },
                          {
                            expr: {
                              Atom: "uint",
                            },
                            id: 30,
                            span: {
                              start_line: 11,
                              start_column: 77,
                              end_line: 11,
                              end_column: 80,
                            },
                          },
                        ],
                      },
                      id: 28,
                      span: {
                        start_line: 11,
                        start_column: 69,
                        end_line: 11,
                        end_column: 81,
                      },
                    },
                  ],
                },
                id: 21,
                span: {
                  start_line: 11,
                  start_column: 18,
                  end_line: 11,
                  end_column: 82,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "ok",
                      },
                      id: 32,
                      span: {
                        start_line: 12,
                        start_column: 6,
                        end_line: 12,
                        end_column: 7,
                      },
                    },
                    {
                      expr: {
                        List: [
                          {
                            expr: {
                              Atom: "map-set",
                            },
                            id: 34,
                            span: {
                              start_line: 12,
                              start_column: 10,
                              end_line: 12,
                              end_column: 16,
                            },
                          },
                          {
                            expr: {
                              Atom: "context",
                            },
                            id: 35,
                            span: {
                              start_line: 12,
                              start_column: 18,
                              end_line: 12,
                              end_column: 24,
                            },
                          },
                          {
                            expr: {
                              Atom: "function-name",
                            },
                            id: 36,
                            span: {
                              start_line: 12,
                              start_column: 26,
                              end_line: 12,
                              end_column: 38,
                            },
                          },
                          {
                            expr: {
                              List: [
                                {
                                  expr: {
                                    Atom: "tuple",
                                  },
                                  id: 38,
                                  span: {
                                    start_line: 0,
                                    start_column: 0,
                                    end_line: 0,
                                    end_column: 0,
                                  },
                                },
                                {
                                  expr: {
                                    List: [
                                      {
                                        expr: {
                                          Atom: "called",
                                        },
                                        id: 40,
                                        span: {
                                          start_line: 12,
                                          start_column: 41,
                                          end_line: 12,
                                          end_column: 46,
                                        },
                                      },
                                      {
                                        expr: {
                                          Atom: "called",
                                        },
                                        id: 41,
                                        span: {
                                          start_line: 12,
                                          start_column: 49,
                                          end_line: 12,
                                          end_column: 54,
                                        },
                                      },
                                    ],
                                  },
                                  id: 39,
                                  span: {
                                    start_line: 12,
                                    start_column: 41,
                                    end_line: 12,
                                    end_column: 54,
                                  },
                                },
                              ],
                            },
                            id: 37,
                            span: {
                              start_line: 12,
                              start_column: 40,
                              end_line: 12,
                              end_column: 55,
                            },
                          },
                        ],
                      },
                      id: 33,
                      span: {
                        start_line: 12,
                        start_column: 9,
                        end_line: 12,
                        end_column: 56,
                      },
                    },
                  ],
                },
                id: 31,
                span: {
                  start_line: 12,
                  start_column: 5,
                  end_line: 12,
                  end_column: 57,
                },
              },
            ],
          },
          id: 19,
          span: {
            start_line: 11,
            start_column: 3,
            end_line: 12,
            end_column: 58,
          },
        },
        {
          expr: {
            List: [
              {
                expr: {
                  Atom: "use-trait",
                },
                id: 43,
                span: {
                  start_line: 14,
                  start_column: 2,
                  end_line: 14,
                  end_column: 10,
                },
              },
              {
                expr: {
                  Atom: "ft-trait",
                },
                id: 44,
                span: {
                  start_line: 14,
                  start_column: 12,
                  end_line: 14,
                  end_column: 19,
                },
              },
              {
                expr: {
                  Field: {
                    name: "sip-010-trait",
                    contract_identifier: {
                      issuer: [
                        22,
                        [
                          9, 159, 184, 137, 38, 216, 47, 48, 178, 244, 14, 175,
                          62, 228, 35, 203, 114, 91, 219, 59,
                        ],
                      ],
                      name: "sip-010-trait-ft-standard",
                    },
                  },
                },
                id: 45,
                span: {
                  start_line: 14,
                  start_column: 21,
                  end_line: 14,
                  end_column: 101,
                },
              },
            ],
          },
          id: 42,
          span: {
            start_line: 14,
            start_column: 1,
            end_line: 14,
            end_column: 102,
          },
        },
        {
          expr: {
            List: [
              {
                expr: {
                  Atom: "define-public",
                },
                id: 47,
                span: {
                  start_line: 16,
                  start_column: 2,
                  end_line: 16,
                  end_column: 14,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "test-no-trait",
                      },
                      id: 49,
                      span: {
                        start_line: 16,
                        start_column: 17,
                        end_line: 16,
                        end_column: 29,
                      },
                    },
                  ],
                },
                id: 48,
                span: {
                  start_line: 16,
                  start_column: 16,
                  end_line: 16,
                  end_column: 30,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "ok",
                      },
                      id: 51,
                      span: {
                        start_line: 17,
                        start_column: 4,
                        end_line: 17,
                        end_column: 5,
                      },
                    },
                    {
                      expr: {
                        Atom: "true",
                      },
                      id: 52,
                      span: {
                        start_line: 17,
                        start_column: 7,
                        end_line: 17,
                        end_column: 10,
                      },
                    },
                  ],
                },
                id: 50,
                span: {
                  start_line: 17,
                  start_column: 3,
                  end_line: 17,
                  end_column: 11,
                },
              },
            ],
          },
          id: 46,
          span: {
            start_line: 16,
            start_column: 1,
            end_line: 18,
            end_column: 1,
          },
        },
        {
          expr: {
            List: [
              {
                expr: {
                  Atom: "define-public",
                },
                id: 54,
                span: {
                  start_line: 20,
                  start_column: 2,
                  end_line: 20,
                  end_column: 14,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "test-trait",
                      },
                      id: 56,
                      span: {
                        start_line: 20,
                        start_column: 17,
                        end_line: 20,
                        end_column: 26,
                      },
                    },
                    {
                      expr: {
                        List: [
                          {
                            expr: {
                              Atom: "token-list",
                            },
                            id: 58,
                            span: {
                              start_line: 20,
                              start_column: 29,
                              end_line: 20,
                              end_column: 38,
                            },
                          },
                          {
                            expr: {
                              List: [
                                {
                                  expr: {
                                    Atom: "list",
                                  },
                                  id: 60,
                                  span: {
                                    start_line: 20,
                                    start_column: 41,
                                    end_line: 20,
                                    end_column: 44,
                                  },
                                },
                                {
                                  expr: {
                                    LiteralValue: {
                                      Int: "5",
                                    },
                                  },
                                  id: 61,
                                  span: {
                                    start_line: 20,
                                    start_column: 46,
                                    end_line: 20,
                                    end_column: 46,
                                  },
                                },
                                {
                                  expr: {
                                    TraitReference: [
                                      "ft-trait",
                                      {
                                        Imported: {
                                          name: "sip-010-trait",
                                          contract_identifier: {
                                            issuer: [
                                              22,
                                              [
                                                9, 159, 184, 137, 38, 216, 47,
                                                48, 178, 244, 14, 175, 62, 228,
                                                35, 203, 114, 91, 219, 59,
                                              ],
                                            ],
                                            name: "sip-010-trait-ft-standard",
                                          },
                                        },
                                      },
                                    ],
                                  },
                                  id: 62,
                                  span: {
                                    start_line: 20,
                                    start_column: 48,
                                    end_line: 20,
                                    end_column: 57,
                                  },
                                },
                              ],
                            },
                            id: 59,
                            span: {
                              start_line: 20,
                              start_column: 40,
                              end_line: 20,
                              end_column: 58,
                            },
                          },
                        ],
                      },
                      id: 57,
                      span: {
                        start_line: 20,
                        start_column: 28,
                        end_line: 20,
                        end_column: 59,
                      },
                    },
                  ],
                },
                id: 55,
                span: {
                  start_line: 20,
                  start_column: 16,
                  end_line: 20,
                  end_column: 60,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "ok",
                      },
                      id: 64,
                      span: {
                        start_line: 21,
                        start_column: 4,
                        end_line: 21,
                        end_column: 5,
                      },
                    },
                    {
                      expr: {
                        Atom: "true",
                      },
                      id: 65,
                      span: {
                        start_line: 21,
                        start_column: 7,
                        end_line: 21,
                        end_column: 10,
                      },
                    },
                  ],
                },
                id: 63,
                span: {
                  start_line: 21,
                  start_column: 3,
                  end_line: 21,
                  end_column: 11,
                },
              },
            ],
          },
          id: 53,
          span: {
            start_line: 20,
            start_column: 1,
            end_line: 22,
            end_column: 1,
          },
        },
      ],
      top_level_expression_sorting: [0, 1, 2, 3, 4, 5],
      referenced_traits: {},
      implemented_traits: [],
    },
  },
  tupleTraitParameter: {
    functionsInterfaces: [
      {
        name: "function",
        access: "public",
        args: [],
        outputs: {
          type: {
            response: {
              ok: "bool",
              error: "none",
            },
          },
        },
      },
      {
        name: "test-no-trait",
        access: "public",
        args: [],
        outputs: {
          type: {
            response: {
              ok: "bool",
              error: "none",
            },
          },
        },
      },
      {
        name: "test-trait",
        access: "public",
        args: [
          {
            name: "tuple-param",
            type: {
              tuple: [
                {
                  name: "token",
                  type: "trait_reference",
                },
              ],
            },
          },
        ],
        outputs: {
          type: {
            response: {
              ok: "bool",
              error: "none",
            },
          },
        },
      },
      {
        name: "update-context",
        access: "public",
        args: [
          {
            name: "function-name",
            type: {
              "string-ascii": {
                length: 100,
              },
            },
          },
          {
            name: "called",
            type: "uint128",
          },
        ],
        outputs: {
          type: {
            response: {
              ok: "bool",
              error: "none",
            },
          },
        },
      },
    ],
    ast: {
      contract_identifier: {
        issuer: [
          26,
          [
            109, 120, 222, 123, 6, 37, 223, 191, 193, 108, 58, 138, 87, 53, 246,
            220, 61, 195, 242, 206,
          ],
        ],
        name: "trait",
      },
      pre_expressions: [],
      expressions: [
        {
          expr: {
            List: [
              {
                expr: {
                  Atom: "define-public",
                },
                id: 2,
                span: {
                  start_line: 1,
                  start_column: 2,
                  end_line: 1,
                  end_column: 14,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "function",
                      },
                      id: 4,
                      span: {
                        start_line: 1,
                        start_column: 17,
                        end_line: 1,
                        end_column: 24,
                      },
                    },
                  ],
                },
                id: 3,
                span: {
                  start_line: 1,
                  start_column: 16,
                  end_line: 1,
                  end_column: 25,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "ok",
                      },
                      id: 6,
                      span: {
                        start_line: 2,
                        start_column: 4,
                        end_line: 2,
                        end_column: 5,
                      },
                    },
                    {
                      expr: {
                        Atom: "true",
                      },
                      id: 7,
                      span: {
                        start_line: 2,
                        start_column: 7,
                        end_line: 2,
                        end_column: 10,
                      },
                    },
                  ],
                },
                id: 5,
                span: {
                  start_line: 2,
                  start_column: 3,
                  end_line: 2,
                  end_column: 11,
                },
              },
            ],
          },
          id: 1,
          span: {
            start_line: 1,
            start_column: 1,
            end_line: 3,
            end_column: 1,
          },
        },
        {
          expr: {
            List: [
              {
                expr: {
                  Atom: "define-map",
                },
                id: 9,
                span: {
                  start_line: 6,
                  start_column: 2,
                  end_line: 6,
                  end_column: 11,
                },
              },
              {
                expr: {
                  Atom: "context",
                },
                id: 10,
                span: {
                  start_line: 6,
                  start_column: 13,
                  end_line: 6,
                  end_column: 19,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "string-ascii",
                      },
                      id: 12,
                      span: {
                        start_line: 6,
                        start_column: 22,
                        end_line: 6,
                        end_column: 33,
                      },
                    },
                    {
                      expr: {
                        LiteralValue: {
                          Int: "100",
                        },
                      },
                      id: 13,
                      span: {
                        start_line: 6,
                        start_column: 35,
                        end_line: 6,
                        end_column: 37,
                      },
                    },
                  ],
                },
                id: 11,
                span: {
                  start_line: 6,
                  start_column: 21,
                  end_line: 6,
                  end_column: 38,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "tuple",
                      },
                      id: 15,
                      span: {
                        start_line: 0,
                        start_column: 0,
                        end_line: 0,
                        end_column: 0,
                      },
                    },
                    {
                      expr: {
                        List: [
                          {
                            expr: {
                              Atom: "called",
                            },
                            id: 17,
                            span: {
                              start_line: 7,
                              start_column: 5,
                              end_line: 7,
                              end_column: 10,
                            },
                          },
                          {
                            expr: {
                              Atom: "uint",
                            },
                            id: 18,
                            span: {
                              start_line: 7,
                              start_column: 13,
                              end_line: 7,
                              end_column: 16,
                            },
                            post_comments: [
                              [
                                "other data",
                                {
                                  start_line: 8,
                                  start_column: 5,
                                  end_line: 8,
                                  end_column: 17,
                                },
                              ],
                            ],
                          },
                        ],
                      },
                      id: 16,
                      span: {
                        start_line: 7,
                        start_column: 5,
                        end_line: 7,
                        end_column: 16,
                      },
                    },
                  ],
                },
                id: 14,
                span: {
                  start_line: 6,
                  start_column: 40,
                  end_line: 9,
                  end_column: 3,
                },
              },
            ],
          },
          id: 8,
          span: {
            start_line: 6,
            start_column: 1,
            end_line: 9,
            end_column: 4,
          },
        },
        {
          expr: {
            List: [
              {
                expr: {
                  Atom: "define-public",
                },
                id: 20,
                span: {
                  start_line: 11,
                  start_column: 4,
                  end_line: 11,
                  end_column: 16,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "update-context",
                      },
                      id: 22,
                      span: {
                        start_line: 11,
                        start_column: 19,
                        end_line: 11,
                        end_column: 32,
                      },
                    },
                    {
                      expr: {
                        List: [
                          {
                            expr: {
                              Atom: "function-name",
                            },
                            id: 24,
                            span: {
                              start_line: 11,
                              start_column: 35,
                              end_line: 11,
                              end_column: 47,
                            },
                          },
                          {
                            expr: {
                              List: [
                                {
                                  expr: {
                                    Atom: "string-ascii",
                                  },
                                  id: 26,
                                  span: {
                                    start_line: 11,
                                    start_column: 50,
                                    end_line: 11,
                                    end_column: 61,
                                  },
                                },
                                {
                                  expr: {
                                    LiteralValue: {
                                      Int: "100",
                                    },
                                  },
                                  id: 27,
                                  span: {
                                    start_line: 11,
                                    start_column: 63,
                                    end_line: 11,
                                    end_column: 65,
                                  },
                                },
                              ],
                            },
                            id: 25,
                            span: {
                              start_line: 11,
                              start_column: 49,
                              end_line: 11,
                              end_column: 66,
                            },
                          },
                        ],
                      },
                      id: 23,
                      span: {
                        start_line: 11,
                        start_column: 34,
                        end_line: 11,
                        end_column: 67,
                      },
                    },
                    {
                      expr: {
                        List: [
                          {
                            expr: {
                              Atom: "called",
                            },
                            id: 29,
                            span: {
                              start_line: 11,
                              start_column: 70,
                              end_line: 11,
                              end_column: 75,
                            },
                          },
                          {
                            expr: {
                              Atom: "uint",
                            },
                            id: 30,
                            span: {
                              start_line: 11,
                              start_column: 77,
                              end_line: 11,
                              end_column: 80,
                            },
                          },
                        ],
                      },
                      id: 28,
                      span: {
                        start_line: 11,
                        start_column: 69,
                        end_line: 11,
                        end_column: 81,
                      },
                    },
                  ],
                },
                id: 21,
                span: {
                  start_line: 11,
                  start_column: 18,
                  end_line: 11,
                  end_column: 82,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "ok",
                      },
                      id: 32,
                      span: {
                        start_line: 12,
                        start_column: 6,
                        end_line: 12,
                        end_column: 7,
                      },
                    },
                    {
                      expr: {
                        List: [
                          {
                            expr: {
                              Atom: "map-set",
                            },
                            id: 34,
                            span: {
                              start_line: 12,
                              start_column: 10,
                              end_line: 12,
                              end_column: 16,
                            },
                          },
                          {
                            expr: {
                              Atom: "context",
                            },
                            id: 35,
                            span: {
                              start_line: 12,
                              start_column: 18,
                              end_line: 12,
                              end_column: 24,
                            },
                          },
                          {
                            expr: {
                              Atom: "function-name",
                            },
                            id: 36,
                            span: {
                              start_line: 12,
                              start_column: 26,
                              end_line: 12,
                              end_column: 38,
                            },
                          },
                          {
                            expr: {
                              List: [
                                {
                                  expr: {
                                    Atom: "tuple",
                                  },
                                  id: 38,
                                  span: {
                                    start_line: 0,
                                    start_column: 0,
                                    end_line: 0,
                                    end_column: 0,
                                  },
                                },
                                {
                                  expr: {
                                    List: [
                                      {
                                        expr: {
                                          Atom: "called",
                                        },
                                        id: 40,
                                        span: {
                                          start_line: 12,
                                          start_column: 41,
                                          end_line: 12,
                                          end_column: 46,
                                        },
                                      },
                                      {
                                        expr: {
                                          Atom: "called",
                                        },
                                        id: 41,
                                        span: {
                                          start_line: 12,
                                          start_column: 49,
                                          end_line: 12,
                                          end_column: 54,
                                        },
                                      },
                                    ],
                                  },
                                  id: 39,
                                  span: {
                                    start_line: 12,
                                    start_column: 41,
                                    end_line: 12,
                                    end_column: 54,
                                  },
                                },
                              ],
                            },
                            id: 37,
                            span: {
                              start_line: 12,
                              start_column: 40,
                              end_line: 12,
                              end_column: 55,
                            },
                          },
                        ],
                      },
                      id: 33,
                      span: {
                        start_line: 12,
                        start_column: 9,
                        end_line: 12,
                        end_column: 56,
                      },
                    },
                  ],
                },
                id: 31,
                span: {
                  start_line: 12,
                  start_column: 5,
                  end_line: 12,
                  end_column: 57,
                },
              },
            ],
          },
          id: 19,
          span: {
            start_line: 11,
            start_column: 3,
            end_line: 12,
            end_column: 58,
          },
        },
        {
          expr: {
            List: [
              {
                expr: {
                  Atom: "use-trait",
                },
                id: 43,
                span: {
                  start_line: 14,
                  start_column: 2,
                  end_line: 14,
                  end_column: 10,
                },
              },
              {
                expr: {
                  Atom: "ft-trait",
                },
                id: 44,
                span: {
                  start_line: 14,
                  start_column: 12,
                  end_line: 14,
                  end_column: 19,
                },
              },
              {
                expr: {
                  Field: {
                    name: "sip-010-trait",
                    contract_identifier: {
                      issuer: [
                        22,
                        [
                          9, 159, 184, 137, 38, 216, 47, 48, 178, 244, 14, 175,
                          62, 228, 35, 203, 114, 91, 219, 59,
                        ],
                      ],
                      name: "sip-010-trait-ft-standard",
                    },
                  },
                },
                id: 45,
                span: {
                  start_line: 14,
                  start_column: 21,
                  end_line: 14,
                  end_column: 101,
                },
              },
            ],
          },
          id: 42,
          span: {
            start_line: 14,
            start_column: 1,
            end_line: 14,
            end_column: 102,
          },
        },
        {
          expr: {
            List: [
              {
                expr: {
                  Atom: "define-public",
                },
                id: 47,
                span: {
                  start_line: 16,
                  start_column: 2,
                  end_line: 16,
                  end_column: 14,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "test-no-trait",
                      },
                      id: 49,
                      span: {
                        start_line: 16,
                        start_column: 17,
                        end_line: 16,
                        end_column: 29,
                      },
                    },
                  ],
                },
                id: 48,
                span: {
                  start_line: 16,
                  start_column: 16,
                  end_line: 16,
                  end_column: 30,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "ok",
                      },
                      id: 51,
                      span: {
                        start_line: 17,
                        start_column: 4,
                        end_line: 17,
                        end_column: 5,
                      },
                    },
                    {
                      expr: {
                        Atom: "true",
                      },
                      id: 52,
                      span: {
                        start_line: 17,
                        start_column: 7,
                        end_line: 17,
                        end_column: 10,
                      },
                    },
                  ],
                },
                id: 50,
                span: {
                  start_line: 17,
                  start_column: 3,
                  end_line: 17,
                  end_column: 11,
                },
              },
            ],
          },
          id: 46,
          span: {
            start_line: 16,
            start_column: 1,
            end_line: 18,
            end_column: 1,
          },
        },
        {
          expr: {
            List: [
              {
                expr: {
                  Atom: "define-public",
                },
                id: 54,
                span: {
                  start_line: 20,
                  start_column: 2,
                  end_line: 20,
                  end_column: 14,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "test-trait",
                      },
                      id: 56,
                      span: {
                        start_line: 20,
                        start_column: 17,
                        end_line: 20,
                        end_column: 26,
                      },
                    },
                    {
                      expr: {
                        List: [
                          {
                            expr: {
                              Atom: "tuple-param",
                            },
                            id: 58,
                            span: {
                              start_line: 20,
                              start_column: 29,
                              end_line: 20,
                              end_column: 39,
                            },
                          },
                          {
                            expr: {
                              List: [
                                {
                                  expr: {
                                    Atom: "tuple",
                                  },
                                  id: 60,
                                  span: {
                                    start_line: 0,
                                    start_column: 0,
                                    end_line: 0,
                                    end_column: 0,
                                  },
                                },
                                {
                                  expr: {
                                    List: [
                                      {
                                        expr: {
                                          Atom: "token",
                                        },
                                        id: 62,
                                        span: {
                                          start_line: 20,
                                          start_column: 42,
                                          end_line: 20,
                                          end_column: 46,
                                        },
                                      },
                                      {
                                        expr: {
                                          TraitReference: [
                                            "ft-trait",
                                            {
                                              Imported: {
                                                name: "sip-010-trait",
                                                contract_identifier: {
                                                  issuer: [
                                                    22,
                                                    [
                                                      9, 159, 184, 137, 38, 216,
                                                      47, 48, 178, 244, 14, 175,
                                                      62, 228, 35, 203, 114, 91,
                                                      219, 59,
                                                    ],
                                                  ],
                                                  name: "sip-010-trait-ft-standard",
                                                },
                                              },
                                            },
                                          ],
                                        },
                                        id: 63,
                                        span: {
                                          start_line: 20,
                                          start_column: 49,
                                          end_line: 20,
                                          end_column: 58,
                                        },
                                      },
                                    ],
                                  },
                                  id: 61,
                                  span: {
                                    start_line: 20,
                                    start_column: 42,
                                    end_line: 20,
                                    end_column: 58,
                                  },
                                },
                              ],
                            },
                            id: 59,
                            span: {
                              start_line: 20,
                              start_column: 41,
                              end_line: 20,
                              end_column: 59,
                            },
                          },
                        ],
                      },
                      id: 57,
                      span: {
                        start_line: 20,
                        start_column: 28,
                        end_line: 20,
                        end_column: 60,
                      },
                    },
                  ],
                },
                id: 55,
                span: {
                  start_line: 20,
                  start_column: 16,
                  end_line: 20,
                  end_column: 61,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "ok",
                      },
                      id: 65,
                      span: {
                        start_line: 21,
                        start_column: 4,
                        end_line: 21,
                        end_column: 5,
                      },
                    },
                    {
                      expr: {
                        Atom: "true",
                      },
                      id: 66,
                      span: {
                        start_line: 21,
                        start_column: 7,
                        end_line: 21,
                        end_column: 10,
                      },
                    },
                  ],
                },
                id: 64,
                span: {
                  start_line: 21,
                  start_column: 3,
                  end_line: 21,
                  end_column: 11,
                },
              },
            ],
          },
          id: 53,
          span: {
            start_line: 20,
            start_column: 1,
            end_line: 22,
            end_column: 1,
          },
        },
      ],
      top_level_expression_sorting: [0, 1, 2, 3, 4, 5],
      referenced_traits: {},
      implemented_traits: [],
    },
  },
  responseOkTraitParameter: {
    functionsInterfaces: [
      {
        name: "function",
        access: "public",
        args: [],
        outputs: {
          type: {
            response: {
              ok: "bool",
              error: "none",
            },
          },
        },
      },
      {
        name: "test-no-trait",
        access: "public",
        args: [],
        outputs: {
          type: {
            response: {
              ok: "bool",
              error: "none",
            },
          },
        },
      },
      {
        name: "test-trait",
        access: "public",
        args: [
          {
            name: "resp-trait-param",
            type: {
              response: {
                ok: "trait_reference",
                error: "uint128",
              },
            },
          },
        ],
        outputs: {
          type: {
            response: {
              ok: "bool",
              error: "none",
            },
          },
        },
      },
      {
        name: "update-context",
        access: "public",
        args: [
          {
            name: "function-name",
            type: {
              "string-ascii": {
                length: 100,
              },
            },
          },
          {
            name: "called",
            type: "uint128",
          },
        ],
        outputs: {
          type: {
            response: {
              ok: "bool",
              error: "none",
            },
          },
        },
      },
    ],
    ast: {
      contract_identifier: {
        issuer: [
          26,
          [
            109, 120, 222, 123, 6, 37, 223, 191, 193, 108, 58, 138, 87, 53, 246,
            220, 61, 195, 242, 206,
          ],
        ],
        name: "trait",
      },
      pre_expressions: [],
      expressions: [
        {
          expr: {
            List: [
              {
                expr: {
                  Atom: "define-public",
                },
                id: 2,
                span: {
                  start_line: 1,
                  start_column: 2,
                  end_line: 1,
                  end_column: 14,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "function",
                      },
                      id: 4,
                      span: {
                        start_line: 1,
                        start_column: 17,
                        end_line: 1,
                        end_column: 24,
                      },
                    },
                  ],
                },
                id: 3,
                span: {
                  start_line: 1,
                  start_column: 16,
                  end_line: 1,
                  end_column: 25,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "ok",
                      },
                      id: 6,
                      span: {
                        start_line: 2,
                        start_column: 4,
                        end_line: 2,
                        end_column: 5,
                      },
                    },
                    {
                      expr: {
                        Atom: "true",
                      },
                      id: 7,
                      span: {
                        start_line: 2,
                        start_column: 7,
                        end_line: 2,
                        end_column: 10,
                      },
                    },
                  ],
                },
                id: 5,
                span: {
                  start_line: 2,
                  start_column: 3,
                  end_line: 2,
                  end_column: 11,
                },
              },
            ],
          },
          id: 1,
          span: {
            start_line: 1,
            start_column: 1,
            end_line: 3,
            end_column: 1,
          },
        },
        {
          expr: {
            List: [
              {
                expr: {
                  Atom: "define-map",
                },
                id: 9,
                span: {
                  start_line: 6,
                  start_column: 2,
                  end_line: 6,
                  end_column: 11,
                },
              },
              {
                expr: {
                  Atom: "context",
                },
                id: 10,
                span: {
                  start_line: 6,
                  start_column: 13,
                  end_line: 6,
                  end_column: 19,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "string-ascii",
                      },
                      id: 12,
                      span: {
                        start_line: 6,
                        start_column: 22,
                        end_line: 6,
                        end_column: 33,
                      },
                    },
                    {
                      expr: {
                        LiteralValue: {
                          Int: "100",
                        },
                      },
                      id: 13,
                      span: {
                        start_line: 6,
                        start_column: 35,
                        end_line: 6,
                        end_column: 37,
                      },
                    },
                  ],
                },
                id: 11,
                span: {
                  start_line: 6,
                  start_column: 21,
                  end_line: 6,
                  end_column: 38,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "tuple",
                      },
                      id: 15,
                      span: {
                        start_line: 0,
                        start_column: 0,
                        end_line: 0,
                        end_column: 0,
                      },
                    },
                    {
                      expr: {
                        List: [
                          {
                            expr: {
                              Atom: "called",
                            },
                            id: 17,
                            span: {
                              start_line: 7,
                              start_column: 5,
                              end_line: 7,
                              end_column: 10,
                            },
                          },
                          {
                            expr: {
                              Atom: "uint",
                            },
                            id: 18,
                            span: {
                              start_line: 7,
                              start_column: 13,
                              end_line: 7,
                              end_column: 16,
                            },
                            post_comments: [
                              [
                                "other data",
                                {
                                  start_line: 8,
                                  start_column: 5,
                                  end_line: 8,
                                  end_column: 17,
                                },
                              ],
                            ],
                          },
                        ],
                      },
                      id: 16,
                      span: {
                        start_line: 7,
                        start_column: 5,
                        end_line: 7,
                        end_column: 16,
                      },
                    },
                  ],
                },
                id: 14,
                span: {
                  start_line: 6,
                  start_column: 40,
                  end_line: 9,
                  end_column: 3,
                },
              },
            ],
          },
          id: 8,
          span: {
            start_line: 6,
            start_column: 1,
            end_line: 9,
            end_column: 4,
          },
        },
        {
          expr: {
            List: [
              {
                expr: {
                  Atom: "define-public",
                },
                id: 20,
                span: {
                  start_line: 11,
                  start_column: 4,
                  end_line: 11,
                  end_column: 16,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "update-context",
                      },
                      id: 22,
                      span: {
                        start_line: 11,
                        start_column: 19,
                        end_line: 11,
                        end_column: 32,
                      },
                    },
                    {
                      expr: {
                        List: [
                          {
                            expr: {
                              Atom: "function-name",
                            },
                            id: 24,
                            span: {
                              start_line: 11,
                              start_column: 35,
                              end_line: 11,
                              end_column: 47,
                            },
                          },
                          {
                            expr: {
                              List: [
                                {
                                  expr: {
                                    Atom: "string-ascii",
                                  },
                                  id: 26,
                                  span: {
                                    start_line: 11,
                                    start_column: 50,
                                    end_line: 11,
                                    end_column: 61,
                                  },
                                },
                                {
                                  expr: {
                                    LiteralValue: {
                                      Int: "100",
                                    },
                                  },
                                  id: 27,
                                  span: {
                                    start_line: 11,
                                    start_column: 63,
                                    end_line: 11,
                                    end_column: 65,
                                  },
                                },
                              ],
                            },
                            id: 25,
                            span: {
                              start_line: 11,
                              start_column: 49,
                              end_line: 11,
                              end_column: 66,
                            },
                          },
                        ],
                      },
                      id: 23,
                      span: {
                        start_line: 11,
                        start_column: 34,
                        end_line: 11,
                        end_column: 67,
                      },
                    },
                    {
                      expr: {
                        List: [
                          {
                            expr: {
                              Atom: "called",
                            },
                            id: 29,
                            span: {
                              start_line: 11,
                              start_column: 70,
                              end_line: 11,
                              end_column: 75,
                            },
                          },
                          {
                            expr: {
                              Atom: "uint",
                            },
                            id: 30,
                            span: {
                              start_line: 11,
                              start_column: 77,
                              end_line: 11,
                              end_column: 80,
                            },
                          },
                        ],
                      },
                      id: 28,
                      span: {
                        start_line: 11,
                        start_column: 69,
                        end_line: 11,
                        end_column: 81,
                      },
                    },
                  ],
                },
                id: 21,
                span: {
                  start_line: 11,
                  start_column: 18,
                  end_line: 11,
                  end_column: 82,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "ok",
                      },
                      id: 32,
                      span: {
                        start_line: 12,
                        start_column: 6,
                        end_line: 12,
                        end_column: 7,
                      },
                    },
                    {
                      expr: {
                        List: [
                          {
                            expr: {
                              Atom: "map-set",
                            },
                            id: 34,
                            span: {
                              start_line: 12,
                              start_column: 10,
                              end_line: 12,
                              end_column: 16,
                            },
                          },
                          {
                            expr: {
                              Atom: "context",
                            },
                            id: 35,
                            span: {
                              start_line: 12,
                              start_column: 18,
                              end_line: 12,
                              end_column: 24,
                            },
                          },
                          {
                            expr: {
                              Atom: "function-name",
                            },
                            id: 36,
                            span: {
                              start_line: 12,
                              start_column: 26,
                              end_line: 12,
                              end_column: 38,
                            },
                          },
                          {
                            expr: {
                              List: [
                                {
                                  expr: {
                                    Atom: "tuple",
                                  },
                                  id: 38,
                                  span: {
                                    start_line: 0,
                                    start_column: 0,
                                    end_line: 0,
                                    end_column: 0,
                                  },
                                },
                                {
                                  expr: {
                                    List: [
                                      {
                                        expr: {
                                          Atom: "called",
                                        },
                                        id: 40,
                                        span: {
                                          start_line: 12,
                                          start_column: 41,
                                          end_line: 12,
                                          end_column: 46,
                                        },
                                      },
                                      {
                                        expr: {
                                          Atom: "called",
                                        },
                                        id: 41,
                                        span: {
                                          start_line: 12,
                                          start_column: 49,
                                          end_line: 12,
                                          end_column: 54,
                                        },
                                      },
                                    ],
                                  },
                                  id: 39,
                                  span: {
                                    start_line: 12,
                                    start_column: 41,
                                    end_line: 12,
                                    end_column: 54,
                                  },
                                },
                              ],
                            },
                            id: 37,
                            span: {
                              start_line: 12,
                              start_column: 40,
                              end_line: 12,
                              end_column: 55,
                            },
                          },
                        ],
                      },
                      id: 33,
                      span: {
                        start_line: 12,
                        start_column: 9,
                        end_line: 12,
                        end_column: 56,
                      },
                    },
                  ],
                },
                id: 31,
                span: {
                  start_line: 12,
                  start_column: 5,
                  end_line: 12,
                  end_column: 57,
                },
              },
            ],
          },
          id: 19,
          span: {
            start_line: 11,
            start_column: 3,
            end_line: 12,
            end_column: 58,
          },
        },
        {
          expr: {
            List: [
              {
                expr: {
                  Atom: "use-trait",
                },
                id: 43,
                span: {
                  start_line: 14,
                  start_column: 2,
                  end_line: 14,
                  end_column: 10,
                },
              },
              {
                expr: {
                  Atom: "ft-trait",
                },
                id: 44,
                span: {
                  start_line: 14,
                  start_column: 12,
                  end_line: 14,
                  end_column: 19,
                },
              },
              {
                expr: {
                  Field: {
                    name: "sip-010-trait",
                    contract_identifier: {
                      issuer: [
                        22,
                        [
                          9, 159, 184, 137, 38, 216, 47, 48, 178, 244, 14, 175,
                          62, 228, 35, 203, 114, 91, 219, 59,
                        ],
                      ],
                      name: "sip-010-trait-ft-standard",
                    },
                  },
                },
                id: 45,
                span: {
                  start_line: 14,
                  start_column: 21,
                  end_line: 14,
                  end_column: 101,
                },
              },
            ],
          },
          id: 42,
          span: {
            start_line: 14,
            start_column: 1,
            end_line: 14,
            end_column: 102,
          },
        },
        {
          expr: {
            List: [
              {
                expr: {
                  Atom: "define-public",
                },
                id: 47,
                span: {
                  start_line: 16,
                  start_column: 2,
                  end_line: 16,
                  end_column: 14,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "test-no-trait",
                      },
                      id: 49,
                      span: {
                        start_line: 16,
                        start_column: 17,
                        end_line: 16,
                        end_column: 29,
                      },
                    },
                  ],
                },
                id: 48,
                span: {
                  start_line: 16,
                  start_column: 16,
                  end_line: 16,
                  end_column: 30,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "ok",
                      },
                      id: 51,
                      span: {
                        start_line: 17,
                        start_column: 4,
                        end_line: 17,
                        end_column: 5,
                      },
                    },
                    {
                      expr: {
                        Atom: "true",
                      },
                      id: 52,
                      span: {
                        start_line: 17,
                        start_column: 7,
                        end_line: 17,
                        end_column: 10,
                      },
                    },
                  ],
                },
                id: 50,
                span: {
                  start_line: 17,
                  start_column: 3,
                  end_line: 17,
                  end_column: 11,
                },
              },
            ],
          },
          id: 46,
          span: {
            start_line: 16,
            start_column: 1,
            end_line: 18,
            end_column: 1,
          },
        },
        {
          expr: {
            List: [
              {
                expr: {
                  Atom: "define-public",
                },
                id: 54,
                span: {
                  start_line: 20,
                  start_column: 2,
                  end_line: 20,
                  end_column: 14,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "test-trait",
                      },
                      id: 56,
                      span: {
                        start_line: 20,
                        start_column: 17,
                        end_line: 20,
                        end_column: 26,
                      },
                    },
                    {
                      expr: {
                        List: [
                          {
                            expr: {
                              Atom: "resp-trait-param",
                            },
                            id: 58,
                            span: {
                              start_line: 20,
                              start_column: 29,
                              end_line: 20,
                              end_column: 44,
                            },
                          },
                          {
                            expr: {
                              List: [
                                {
                                  expr: {
                                    Atom: "response",
                                  },
                                  id: 60,
                                  span: {
                                    start_line: 20,
                                    start_column: 47,
                                    end_line: 20,
                                    end_column: 54,
                                  },
                                },
                                {
                                  expr: {
                                    TraitReference: [
                                      "ft-trait",
                                      {
                                        Imported: {
                                          name: "sip-010-trait",
                                          contract_identifier: {
                                            issuer: [
                                              22,
                                              [
                                                9, 159, 184, 137, 38, 216, 47,
                                                48, 178, 244, 14, 175, 62, 228,
                                                35, 203, 114, 91, 219, 59,
                                              ],
                                            ],
                                            name: "sip-010-trait-ft-standard",
                                          },
                                        },
                                      },
                                    ],
                                  },
                                  id: 61,
                                  span: {
                                    start_line: 20,
                                    start_column: 56,
                                    end_line: 20,
                                    end_column: 65,
                                  },
                                },
                                {
                                  expr: {
                                    Atom: "uint",
                                  },
                                  id: 62,
                                  span: {
                                    start_line: 20,
                                    start_column: 67,
                                    end_line: 20,
                                    end_column: 70,
                                  },
                                },
                              ],
                            },
                            id: 59,
                            span: {
                              start_line: 20,
                              start_column: 46,
                              end_line: 20,
                              end_column: 71,
                            },
                          },
                        ],
                      },
                      id: 57,
                      span: {
                        start_line: 20,
                        start_column: 28,
                        end_line: 20,
                        end_column: 72,
                      },
                    },
                  ],
                },
                id: 55,
                span: {
                  start_line: 20,
                  start_column: 16,
                  end_line: 20,
                  end_column: 73,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "ok",
                      },
                      id: 64,
                      span: {
                        start_line: 21,
                        start_column: 4,
                        end_line: 21,
                        end_column: 5,
                      },
                    },
                    {
                      expr: {
                        Atom: "true",
                      },
                      id: 65,
                      span: {
                        start_line: 21,
                        start_column: 7,
                        end_line: 21,
                        end_column: 10,
                      },
                    },
                  ],
                },
                id: 63,
                span: {
                  start_line: 21,
                  start_column: 3,
                  end_line: 21,
                  end_column: 11,
                },
              },
            ],
          },
          id: 53,
          span: {
            start_line: 20,
            start_column: 1,
            end_line: 22,
            end_column: 1,
          },
        },
      ],
      top_level_expression_sorting: [0, 1, 2, 3, 4, 5],
      referenced_traits: {},
      implemented_traits: [],
    },
  },
  responseErrTraitParameter: {
    functionsInterfaces: [
      {
        name: "function",
        access: "public",
        args: [],
        outputs: {
          type: {
            response: {
              ok: "bool",
              error: "none",
            },
          },
        },
      },
      {
        name: "test-no-trait",
        access: "public",
        args: [],
        outputs: {
          type: {
            response: {
              ok: "bool",
              error: "none",
            },
          },
        },
      },
      {
        name: "test-trait",
        access: "public",
        args: [
          {
            name: "resp-trait-param",
            type: {
              response: {
                ok: "uint128",
                error: "trait_reference",
              },
            },
          },
        ],
        outputs: {
          type: {
            response: {
              ok: "bool",
              error: "none",
            },
          },
        },
      },
      {
        name: "update-context",
        access: "public",
        args: [
          {
            name: "function-name",
            type: {
              "string-ascii": {
                length: 100,
              },
            },
          },
          {
            name: "called",
            type: "uint128",
          },
        ],
        outputs: {
          type: {
            response: {
              ok: "bool",
              error: "none",
            },
          },
        },
      },
    ],
    ast: {
      contract_identifier: {
        issuer: [
          26,
          [
            109, 120, 222, 123, 6, 37, 223, 191, 193, 108, 58, 138, 87, 53, 246,
            220, 61, 195, 242, 206,
          ],
        ],
        name: "trait",
      },
      pre_expressions: [],
      expressions: [
        {
          expr: {
            List: [
              {
                expr: {
                  Atom: "define-public",
                },
                id: 2,
                span: {
                  start_line: 1,
                  start_column: 2,
                  end_line: 1,
                  end_column: 14,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "function",
                      },
                      id: 4,
                      span: {
                        start_line: 1,
                        start_column: 17,
                        end_line: 1,
                        end_column: 24,
                      },
                    },
                  ],
                },
                id: 3,
                span: {
                  start_line: 1,
                  start_column: 16,
                  end_line: 1,
                  end_column: 25,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "ok",
                      },
                      id: 6,
                      span: {
                        start_line: 2,
                        start_column: 4,
                        end_line: 2,
                        end_column: 5,
                      },
                    },
                    {
                      expr: {
                        Atom: "true",
                      },
                      id: 7,
                      span: {
                        start_line: 2,
                        start_column: 7,
                        end_line: 2,
                        end_column: 10,
                      },
                    },
                  ],
                },
                id: 5,
                span: {
                  start_line: 2,
                  start_column: 3,
                  end_line: 2,
                  end_column: 11,
                },
              },
            ],
          },
          id: 1,
          span: {
            start_line: 1,
            start_column: 1,
            end_line: 3,
            end_column: 1,
          },
        },
        {
          expr: {
            List: [
              {
                expr: {
                  Atom: "define-map",
                },
                id: 9,
                span: {
                  start_line: 6,
                  start_column: 2,
                  end_line: 6,
                  end_column: 11,
                },
              },
              {
                expr: {
                  Atom: "context",
                },
                id: 10,
                span: {
                  start_line: 6,
                  start_column: 13,
                  end_line: 6,
                  end_column: 19,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "string-ascii",
                      },
                      id: 12,
                      span: {
                        start_line: 6,
                        start_column: 22,
                        end_line: 6,
                        end_column: 33,
                      },
                    },
                    {
                      expr: {
                        LiteralValue: {
                          Int: "100",
                        },
                      },
                      id: 13,
                      span: {
                        start_line: 6,
                        start_column: 35,
                        end_line: 6,
                        end_column: 37,
                      },
                    },
                  ],
                },
                id: 11,
                span: {
                  start_line: 6,
                  start_column: 21,
                  end_line: 6,
                  end_column: 38,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "tuple",
                      },
                      id: 15,
                      span: {
                        start_line: 0,
                        start_column: 0,
                        end_line: 0,
                        end_column: 0,
                      },
                    },
                    {
                      expr: {
                        List: [
                          {
                            expr: {
                              Atom: "called",
                            },
                            id: 17,
                            span: {
                              start_line: 7,
                              start_column: 5,
                              end_line: 7,
                              end_column: 10,
                            },
                          },
                          {
                            expr: {
                              Atom: "uint",
                            },
                            id: 18,
                            span: {
                              start_line: 7,
                              start_column: 13,
                              end_line: 7,
                              end_column: 16,
                            },
                            post_comments: [
                              [
                                "other data",
                                {
                                  start_line: 8,
                                  start_column: 5,
                                  end_line: 8,
                                  end_column: 17,
                                },
                              ],
                            ],
                          },
                        ],
                      },
                      id: 16,
                      span: {
                        start_line: 7,
                        start_column: 5,
                        end_line: 7,
                        end_column: 16,
                      },
                    },
                  ],
                },
                id: 14,
                span: {
                  start_line: 6,
                  start_column: 40,
                  end_line: 9,
                  end_column: 3,
                },
              },
            ],
          },
          id: 8,
          span: {
            start_line: 6,
            start_column: 1,
            end_line: 9,
            end_column: 4,
          },
        },
        {
          expr: {
            List: [
              {
                expr: {
                  Atom: "define-public",
                },
                id: 20,
                span: {
                  start_line: 11,
                  start_column: 4,
                  end_line: 11,
                  end_column: 16,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "update-context",
                      },
                      id: 22,
                      span: {
                        start_line: 11,
                        start_column: 19,
                        end_line: 11,
                        end_column: 32,
                      },
                    },
                    {
                      expr: {
                        List: [
                          {
                            expr: {
                              Atom: "function-name",
                            },
                            id: 24,
                            span: {
                              start_line: 11,
                              start_column: 35,
                              end_line: 11,
                              end_column: 47,
                            },
                          },
                          {
                            expr: {
                              List: [
                                {
                                  expr: {
                                    Atom: "string-ascii",
                                  },
                                  id: 26,
                                  span: {
                                    start_line: 11,
                                    start_column: 50,
                                    end_line: 11,
                                    end_column: 61,
                                  },
                                },
                                {
                                  expr: {
                                    LiteralValue: {
                                      Int: "100",
                                    },
                                  },
                                  id: 27,
                                  span: {
                                    start_line: 11,
                                    start_column: 63,
                                    end_line: 11,
                                    end_column: 65,
                                  },
                                },
                              ],
                            },
                            id: 25,
                            span: {
                              start_line: 11,
                              start_column: 49,
                              end_line: 11,
                              end_column: 66,
                            },
                          },
                        ],
                      },
                      id: 23,
                      span: {
                        start_line: 11,
                        start_column: 34,
                        end_line: 11,
                        end_column: 67,
                      },
                    },
                    {
                      expr: {
                        List: [
                          {
                            expr: {
                              Atom: "called",
                            },
                            id: 29,
                            span: {
                              start_line: 11,
                              start_column: 70,
                              end_line: 11,
                              end_column: 75,
                            },
                          },
                          {
                            expr: {
                              Atom: "uint",
                            },
                            id: 30,
                            span: {
                              start_line: 11,
                              start_column: 77,
                              end_line: 11,
                              end_column: 80,
                            },
                          },
                        ],
                      },
                      id: 28,
                      span: {
                        start_line: 11,
                        start_column: 69,
                        end_line: 11,
                        end_column: 81,
                      },
                    },
                  ],
                },
                id: 21,
                span: {
                  start_line: 11,
                  start_column: 18,
                  end_line: 11,
                  end_column: 82,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "ok",
                      },
                      id: 32,
                      span: {
                        start_line: 12,
                        start_column: 6,
                        end_line: 12,
                        end_column: 7,
                      },
                    },
                    {
                      expr: {
                        List: [
                          {
                            expr: {
                              Atom: "map-set",
                            },
                            id: 34,
                            span: {
                              start_line: 12,
                              start_column: 10,
                              end_line: 12,
                              end_column: 16,
                            },
                          },
                          {
                            expr: {
                              Atom: "context",
                            },
                            id: 35,
                            span: {
                              start_line: 12,
                              start_column: 18,
                              end_line: 12,
                              end_column: 24,
                            },
                          },
                          {
                            expr: {
                              Atom: "function-name",
                            },
                            id: 36,
                            span: {
                              start_line: 12,
                              start_column: 26,
                              end_line: 12,
                              end_column: 38,
                            },
                          },
                          {
                            expr: {
                              List: [
                                {
                                  expr: {
                                    Atom: "tuple",
                                  },
                                  id: 38,
                                  span: {
                                    start_line: 0,
                                    start_column: 0,
                                    end_line: 0,
                                    end_column: 0,
                                  },
                                },
                                {
                                  expr: {
                                    List: [
                                      {
                                        expr: {
                                          Atom: "called",
                                        },
                                        id: 40,
                                        span: {
                                          start_line: 12,
                                          start_column: 41,
                                          end_line: 12,
                                          end_column: 46,
                                        },
                                      },
                                      {
                                        expr: {
                                          Atom: "called",
                                        },
                                        id: 41,
                                        span: {
                                          start_line: 12,
                                          start_column: 49,
                                          end_line: 12,
                                          end_column: 54,
                                        },
                                      },
                                    ],
                                  },
                                  id: 39,
                                  span: {
                                    start_line: 12,
                                    start_column: 41,
                                    end_line: 12,
                                    end_column: 54,
                                  },
                                },
                              ],
                            },
                            id: 37,
                            span: {
                              start_line: 12,
                              start_column: 40,
                              end_line: 12,
                              end_column: 55,
                            },
                          },
                        ],
                      },
                      id: 33,
                      span: {
                        start_line: 12,
                        start_column: 9,
                        end_line: 12,
                        end_column: 56,
                      },
                    },
                  ],
                },
                id: 31,
                span: {
                  start_line: 12,
                  start_column: 5,
                  end_line: 12,
                  end_column: 57,
                },
              },
            ],
          },
          id: 19,
          span: {
            start_line: 11,
            start_column: 3,
            end_line: 12,
            end_column: 58,
          },
        },
        {
          expr: {
            List: [
              {
                expr: {
                  Atom: "use-trait",
                },
                id: 43,
                span: {
                  start_line: 14,
                  start_column: 2,
                  end_line: 14,
                  end_column: 10,
                },
              },
              {
                expr: {
                  Atom: "ft-trait",
                },
                id: 44,
                span: {
                  start_line: 14,
                  start_column: 12,
                  end_line: 14,
                  end_column: 19,
                },
              },
              {
                expr: {
                  Field: {
                    name: "sip-010-trait",
                    contract_identifier: {
                      issuer: [
                        22,
                        [
                          9, 159, 184, 137, 38, 216, 47, 48, 178, 244, 14, 175,
                          62, 228, 35, 203, 114, 91, 219, 59,
                        ],
                      ],
                      name: "sip-010-trait-ft-standard",
                    },
                  },
                },
                id: 45,
                span: {
                  start_line: 14,
                  start_column: 21,
                  end_line: 14,
                  end_column: 101,
                },
              },
            ],
          },
          id: 42,
          span: {
            start_line: 14,
            start_column: 1,
            end_line: 14,
            end_column: 102,
          },
        },
        {
          expr: {
            List: [
              {
                expr: {
                  Atom: "define-public",
                },
                id: 47,
                span: {
                  start_line: 16,
                  start_column: 2,
                  end_line: 16,
                  end_column: 14,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "test-no-trait",
                      },
                      id: 49,
                      span: {
                        start_line: 16,
                        start_column: 17,
                        end_line: 16,
                        end_column: 29,
                      },
                    },
                  ],
                },
                id: 48,
                span: {
                  start_line: 16,
                  start_column: 16,
                  end_line: 16,
                  end_column: 30,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "ok",
                      },
                      id: 51,
                      span: {
                        start_line: 17,
                        start_column: 4,
                        end_line: 17,
                        end_column: 5,
                      },
                    },
                    {
                      expr: {
                        Atom: "true",
                      },
                      id: 52,
                      span: {
                        start_line: 17,
                        start_column: 7,
                        end_line: 17,
                        end_column: 10,
                      },
                    },
                  ],
                },
                id: 50,
                span: {
                  start_line: 17,
                  start_column: 3,
                  end_line: 17,
                  end_column: 11,
                },
              },
            ],
          },
          id: 46,
          span: {
            start_line: 16,
            start_column: 1,
            end_line: 18,
            end_column: 1,
          },
        },
        {
          expr: {
            List: [
              {
                expr: {
                  Atom: "define-public",
                },
                id: 54,
                span: {
                  start_line: 20,
                  start_column: 2,
                  end_line: 20,
                  end_column: 14,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "test-trait",
                      },
                      id: 56,
                      span: {
                        start_line: 20,
                        start_column: 17,
                        end_line: 20,
                        end_column: 26,
                      },
                    },
                    {
                      expr: {
                        List: [
                          {
                            expr: {
                              Atom: "resp-trait-param",
                            },
                            id: 58,
                            span: {
                              start_line: 20,
                              start_column: 29,
                              end_line: 20,
                              end_column: 44,
                            },
                          },
                          {
                            expr: {
                              List: [
                                {
                                  expr: {
                                    Atom: "response",
                                  },
                                  id: 60,
                                  span: {
                                    start_line: 20,
                                    start_column: 47,
                                    end_line: 20,
                                    end_column: 54,
                                  },
                                },
                                {
                                  expr: {
                                    Atom: "uint",
                                  },
                                  id: 61,
                                  span: {
                                    start_line: 20,
                                    start_column: 56,
                                    end_line: 20,
                                    end_column: 59,
                                  },
                                },
                                {
                                  expr: {
                                    TraitReference: [
                                      "ft-trait",
                                      {
                                        Imported: {
                                          name: "sip-010-trait",
                                          contract_identifier: {
                                            issuer: [
                                              22,
                                              [
                                                9, 159, 184, 137, 38, 216, 47,
                                                48, 178, 244, 14, 175, 62, 228,
                                                35, 203, 114, 91, 219, 59,
                                              ],
                                            ],
                                            name: "sip-010-trait-ft-standard",
                                          },
                                        },
                                      },
                                    ],
                                  },
                                  id: 62,
                                  span: {
                                    start_line: 20,
                                    start_column: 61,
                                    end_line: 20,
                                    end_column: 70,
                                  },
                                },
                              ],
                            },
                            id: 59,
                            span: {
                              start_line: 20,
                              start_column: 46,
                              end_line: 20,
                              end_column: 71,
                            },
                          },
                        ],
                      },
                      id: 57,
                      span: {
                        start_line: 20,
                        start_column: 28,
                        end_line: 20,
                        end_column: 72,
                      },
                    },
                  ],
                },
                id: 55,
                span: {
                  start_line: 20,
                  start_column: 16,
                  end_line: 20,
                  end_column: 73,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "ok",
                      },
                      id: 64,
                      span: {
                        start_line: 21,
                        start_column: 4,
                        end_line: 21,
                        end_column: 5,
                      },
                    },
                    {
                      expr: {
                        Atom: "true",
                      },
                      id: 65,
                      span: {
                        start_line: 21,
                        start_column: 7,
                        end_line: 21,
                        end_column: 10,
                      },
                    },
                  ],
                },
                id: 63,
                span: {
                  start_line: 21,
                  start_column: 3,
                  end_line: 21,
                  end_column: 11,
                },
              },
            ],
          },
          id: 53,
          span: {
            start_line: 20,
            start_column: 1,
            end_line: 22,
            end_column: 1,
          },
        },
      ],
      top_level_expression_sorting: [0, 1, 2, 3, 4, 5],
      referenced_traits: {},
      implemented_traits: [],
    },
  },
  responseBothTraitParameter: {
    functionsInterfaces: [
      {
        name: "function",
        access: "public",
        args: [],
        outputs: {
          type: {
            response: {
              ok: "bool",
              error: "none",
            },
          },
        },
      },
      {
        name: "test-no-trait",
        access: "public",
        args: [],
        outputs: {
          type: {
            response: {
              ok: "bool",
              error: "none",
            },
          },
        },
      },
      {
        name: "test-trait",
        access: "public",
        args: [
          {
            name: "resp-trait-param",
            type: {
              response: {
                ok: "trait_reference",
                error: "trait_reference",
              },
            },
          },
        ],
        outputs: {
          type: {
            response: {
              ok: "bool",
              error: "none",
            },
          },
        },
      },
      {
        name: "update-context",
        access: "public",
        args: [
          {
            name: "function-name",
            type: {
              "string-ascii": {
                length: 100,
              },
            },
          },
          {
            name: "called",
            type: "uint128",
          },
        ],
        outputs: {
          type: {
            response: {
              ok: "bool",
              error: "none",
            },
          },
        },
      },
    ],
    ast: {
      contract_identifier: {
        issuer: [
          26,
          [
            109, 120, 222, 123, 6, 37, 223, 191, 193, 108, 58, 138, 87, 53, 246,
            220, 61, 195, 242, 206,
          ],
        ],
        name: "trait",
      },
      pre_expressions: [],
      expressions: [
        {
          expr: {
            List: [
              {
                expr: {
                  Atom: "define-public",
                },
                id: 2,
                span: {
                  start_line: 1,
                  start_column: 2,
                  end_line: 1,
                  end_column: 14,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "function",
                      },
                      id: 4,
                      span: {
                        start_line: 1,
                        start_column: 17,
                        end_line: 1,
                        end_column: 24,
                      },
                    },
                  ],
                },
                id: 3,
                span: {
                  start_line: 1,
                  start_column: 16,
                  end_line: 1,
                  end_column: 25,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "ok",
                      },
                      id: 6,
                      span: {
                        start_line: 2,
                        start_column: 4,
                        end_line: 2,
                        end_column: 5,
                      },
                    },
                    {
                      expr: {
                        Atom: "true",
                      },
                      id: 7,
                      span: {
                        start_line: 2,
                        start_column: 7,
                        end_line: 2,
                        end_column: 10,
                      },
                    },
                  ],
                },
                id: 5,
                span: {
                  start_line: 2,
                  start_column: 3,
                  end_line: 2,
                  end_column: 11,
                },
              },
            ],
          },
          id: 1,
          span: {
            start_line: 1,
            start_column: 1,
            end_line: 3,
            end_column: 1,
          },
        },
        {
          expr: {
            List: [
              {
                expr: {
                  Atom: "define-map",
                },
                id: 9,
                span: {
                  start_line: 6,
                  start_column: 2,
                  end_line: 6,
                  end_column: 11,
                },
              },
              {
                expr: {
                  Atom: "context",
                },
                id: 10,
                span: {
                  start_line: 6,
                  start_column: 13,
                  end_line: 6,
                  end_column: 19,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "string-ascii",
                      },
                      id: 12,
                      span: {
                        start_line: 6,
                        start_column: 22,
                        end_line: 6,
                        end_column: 33,
                      },
                    },
                    {
                      expr: {
                        LiteralValue: {
                          Int: "100",
                        },
                      },
                      id: 13,
                      span: {
                        start_line: 6,
                        start_column: 35,
                        end_line: 6,
                        end_column: 37,
                      },
                    },
                  ],
                },
                id: 11,
                span: {
                  start_line: 6,
                  start_column: 21,
                  end_line: 6,
                  end_column: 38,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "tuple",
                      },
                      id: 15,
                      span: {
                        start_line: 0,
                        start_column: 0,
                        end_line: 0,
                        end_column: 0,
                      },
                    },
                    {
                      expr: {
                        List: [
                          {
                            expr: {
                              Atom: "called",
                            },
                            id: 17,
                            span: {
                              start_line: 7,
                              start_column: 5,
                              end_line: 7,
                              end_column: 10,
                            },
                          },
                          {
                            expr: {
                              Atom: "uint",
                            },
                            id: 18,
                            span: {
                              start_line: 7,
                              start_column: 13,
                              end_line: 7,
                              end_column: 16,
                            },
                            post_comments: [
                              [
                                "other data",
                                {
                                  start_line: 8,
                                  start_column: 5,
                                  end_line: 8,
                                  end_column: 17,
                                },
                              ],
                            ],
                          },
                        ],
                      },
                      id: 16,
                      span: {
                        start_line: 7,
                        start_column: 5,
                        end_line: 7,
                        end_column: 16,
                      },
                    },
                  ],
                },
                id: 14,
                span: {
                  start_line: 6,
                  start_column: 40,
                  end_line: 9,
                  end_column: 3,
                },
              },
            ],
          },
          id: 8,
          span: {
            start_line: 6,
            start_column: 1,
            end_line: 9,
            end_column: 4,
          },
        },
        {
          expr: {
            List: [
              {
                expr: {
                  Atom: "define-public",
                },
                id: 20,
                span: {
                  start_line: 11,
                  start_column: 4,
                  end_line: 11,
                  end_column: 16,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "update-context",
                      },
                      id: 22,
                      span: {
                        start_line: 11,
                        start_column: 19,
                        end_line: 11,
                        end_column: 32,
                      },
                    },
                    {
                      expr: {
                        List: [
                          {
                            expr: {
                              Atom: "function-name",
                            },
                            id: 24,
                            span: {
                              start_line: 11,
                              start_column: 35,
                              end_line: 11,
                              end_column: 47,
                            },
                          },
                          {
                            expr: {
                              List: [
                                {
                                  expr: {
                                    Atom: "string-ascii",
                                  },
                                  id: 26,
                                  span: {
                                    start_line: 11,
                                    start_column: 50,
                                    end_line: 11,
                                    end_column: 61,
                                  },
                                },
                                {
                                  expr: {
                                    LiteralValue: {
                                      Int: "100",
                                    },
                                  },
                                  id: 27,
                                  span: {
                                    start_line: 11,
                                    start_column: 63,
                                    end_line: 11,
                                    end_column: 65,
                                  },
                                },
                              ],
                            },
                            id: 25,
                            span: {
                              start_line: 11,
                              start_column: 49,
                              end_line: 11,
                              end_column: 66,
                            },
                          },
                        ],
                      },
                      id: 23,
                      span: {
                        start_line: 11,
                        start_column: 34,
                        end_line: 11,
                        end_column: 67,
                      },
                    },
                    {
                      expr: {
                        List: [
                          {
                            expr: {
                              Atom: "called",
                            },
                            id: 29,
                            span: {
                              start_line: 11,
                              start_column: 70,
                              end_line: 11,
                              end_column: 75,
                            },
                          },
                          {
                            expr: {
                              Atom: "uint",
                            },
                            id: 30,
                            span: {
                              start_line: 11,
                              start_column: 77,
                              end_line: 11,
                              end_column: 80,
                            },
                          },
                        ],
                      },
                      id: 28,
                      span: {
                        start_line: 11,
                        start_column: 69,
                        end_line: 11,
                        end_column: 81,
                      },
                    },
                  ],
                },
                id: 21,
                span: {
                  start_line: 11,
                  start_column: 18,
                  end_line: 11,
                  end_column: 82,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "ok",
                      },
                      id: 32,
                      span: {
                        start_line: 12,
                        start_column: 6,
                        end_line: 12,
                        end_column: 7,
                      },
                    },
                    {
                      expr: {
                        List: [
                          {
                            expr: {
                              Atom: "map-set",
                            },
                            id: 34,
                            span: {
                              start_line: 12,
                              start_column: 10,
                              end_line: 12,
                              end_column: 16,
                            },
                          },
                          {
                            expr: {
                              Atom: "context",
                            },
                            id: 35,
                            span: {
                              start_line: 12,
                              start_column: 18,
                              end_line: 12,
                              end_column: 24,
                            },
                          },
                          {
                            expr: {
                              Atom: "function-name",
                            },
                            id: 36,
                            span: {
                              start_line: 12,
                              start_column: 26,
                              end_line: 12,
                              end_column: 38,
                            },
                          },
                          {
                            expr: {
                              List: [
                                {
                                  expr: {
                                    Atom: "tuple",
                                  },
                                  id: 38,
                                  span: {
                                    start_line: 0,
                                    start_column: 0,
                                    end_line: 0,
                                    end_column: 0,
                                  },
                                },
                                {
                                  expr: {
                                    List: [
                                      {
                                        expr: {
                                          Atom: "called",
                                        },
                                        id: 40,
                                        span: {
                                          start_line: 12,
                                          start_column: 41,
                                          end_line: 12,
                                          end_column: 46,
                                        },
                                      },
                                      {
                                        expr: {
                                          Atom: "called",
                                        },
                                        id: 41,
                                        span: {
                                          start_line: 12,
                                          start_column: 49,
                                          end_line: 12,
                                          end_column: 54,
                                        },
                                      },
                                    ],
                                  },
                                  id: 39,
                                  span: {
                                    start_line: 12,
                                    start_column: 41,
                                    end_line: 12,
                                    end_column: 54,
                                  },
                                },
                              ],
                            },
                            id: 37,
                            span: {
                              start_line: 12,
                              start_column: 40,
                              end_line: 12,
                              end_column: 55,
                            },
                          },
                        ],
                      },
                      id: 33,
                      span: {
                        start_line: 12,
                        start_column: 9,
                        end_line: 12,
                        end_column: 56,
                      },
                    },
                  ],
                },
                id: 31,
                span: {
                  start_line: 12,
                  start_column: 5,
                  end_line: 12,
                  end_column: 57,
                },
              },
            ],
          },
          id: 19,
          span: {
            start_line: 11,
            start_column: 3,
            end_line: 12,
            end_column: 58,
          },
        },
        {
          expr: {
            List: [
              {
                expr: {
                  Atom: "use-trait",
                },
                id: 43,
                span: {
                  start_line: 14,
                  start_column: 2,
                  end_line: 14,
                  end_column: 10,
                },
              },
              {
                expr: {
                  Atom: "ft-trait",
                },
                id: 44,
                span: {
                  start_line: 14,
                  start_column: 12,
                  end_line: 14,
                  end_column: 19,
                },
              },
              {
                expr: {
                  Field: {
                    name: "sip-010-trait",
                    contract_identifier: {
                      issuer: [
                        22,
                        [
                          9, 159, 184, 137, 38, 216, 47, 48, 178, 244, 14, 175,
                          62, 228, 35, 203, 114, 91, 219, 59,
                        ],
                      ],
                      name: "sip-010-trait-ft-standard",
                    },
                  },
                },
                id: 45,
                span: {
                  start_line: 14,
                  start_column: 21,
                  end_line: 14,
                  end_column: 101,
                },
              },
            ],
          },
          id: 42,
          span: {
            start_line: 14,
            start_column: 1,
            end_line: 14,
            end_column: 102,
          },
        },
        {
          expr: {
            List: [
              {
                expr: {
                  Atom: "define-public",
                },
                id: 47,
                span: {
                  start_line: 16,
                  start_column: 2,
                  end_line: 16,
                  end_column: 14,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "test-no-trait",
                      },
                      id: 49,
                      span: {
                        start_line: 16,
                        start_column: 17,
                        end_line: 16,
                        end_column: 29,
                      },
                    },
                  ],
                },
                id: 48,
                span: {
                  start_line: 16,
                  start_column: 16,
                  end_line: 16,
                  end_column: 30,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "ok",
                      },
                      id: 51,
                      span: {
                        start_line: 17,
                        start_column: 4,
                        end_line: 17,
                        end_column: 5,
                      },
                    },
                    {
                      expr: {
                        Atom: "true",
                      },
                      id: 52,
                      span: {
                        start_line: 17,
                        start_column: 7,
                        end_line: 17,
                        end_column: 10,
                      },
                    },
                  ],
                },
                id: 50,
                span: {
                  start_line: 17,
                  start_column: 3,
                  end_line: 17,
                  end_column: 11,
                },
              },
            ],
          },
          id: 46,
          span: {
            start_line: 16,
            start_column: 1,
            end_line: 18,
            end_column: 1,
          },
        },
        {
          expr: {
            List: [
              {
                expr: {
                  Atom: "define-public",
                },
                id: 54,
                span: {
                  start_line: 20,
                  start_column: 2,
                  end_line: 20,
                  end_column: 14,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "test-trait",
                      },
                      id: 56,
                      span: {
                        start_line: 20,
                        start_column: 17,
                        end_line: 20,
                        end_column: 26,
                      },
                    },
                    {
                      expr: {
                        List: [
                          {
                            expr: {
                              Atom: "resp-trait-param",
                            },
                            id: 58,
                            span: {
                              start_line: 20,
                              start_column: 29,
                              end_line: 20,
                              end_column: 44,
                            },
                          },
                          {
                            expr: {
                              List: [
                                {
                                  expr: {
                                    Atom: "response",
                                  },
                                  id: 60,
                                  span: {
                                    start_line: 20,
                                    start_column: 47,
                                    end_line: 20,
                                    end_column: 54,
                                  },
                                },
                                {
                                  expr: {
                                    TraitReference: [
                                      "ft-trait",
                                      {
                                        Imported: {
                                          name: "sip-010-trait",
                                          contract_identifier: {
                                            issuer: [
                                              22,
                                              [
                                                9, 159, 184, 137, 38, 216, 47,
                                                48, 178, 244, 14, 175, 62, 228,
                                                35, 203, 114, 91, 219, 59,
                                              ],
                                            ],
                                            name: "sip-010-trait-ft-standard",
                                          },
                                        },
                                      },
                                    ],
                                  },
                                  id: 61,
                                  span: {
                                    start_line: 20,
                                    start_column: 56,
                                    end_line: 20,
                                    end_column: 65,
                                  },
                                },
                                {
                                  expr: {
                                    TraitReference: [
                                      "ft-trait",
                                      {
                                        Imported: {
                                          name: "sip-010-trait",
                                          contract_identifier: {
                                            issuer: [
                                              22,
                                              [
                                                9, 159, 184, 137, 38, 216, 47,
                                                48, 178, 244, 14, 175, 62, 228,
                                                35, 203, 114, 91, 219, 59,
                                              ],
                                            ],
                                            name: "sip-010-trait-ft-standard",
                                          },
                                        },
                                      },
                                    ],
                                  },
                                  id: 62,
                                  span: {
                                    start_line: 20,
                                    start_column: 67,
                                    end_line: 20,
                                    end_column: 76,
                                  },
                                },
                              ],
                            },
                            id: 59,
                            span: {
                              start_line: 20,
                              start_column: 46,
                              end_line: 20,
                              end_column: 77,
                            },
                          },
                        ],
                      },
                      id: 57,
                      span: {
                        start_line: 20,
                        start_column: 28,
                        end_line: 20,
                        end_column: 78,
                      },
                    },
                  ],
                },
                id: 55,
                span: {
                  start_line: 20,
                  start_column: 16,
                  end_line: 20,
                  end_column: 79,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "ok",
                      },
                      id: 64,
                      span: {
                        start_line: 21,
                        start_column: 4,
                        end_line: 21,
                        end_column: 5,
                      },
                    },
                    {
                      expr: {
                        Atom: "true",
                      },
                      id: 65,
                      span: {
                        start_line: 21,
                        start_column: 7,
                        end_line: 21,
                        end_column: 10,
                      },
                    },
                  ],
                },
                id: 63,
                span: {
                  start_line: 21,
                  start_column: 3,
                  end_line: 21,
                  end_column: 11,
                },
              },
            ],
          },
          id: 53,
          span: {
            start_line: 20,
            start_column: 1,
            end_line: 22,
            end_column: 1,
          },
        },
      ],
      top_level_expression_sorting: [0, 1, 2, 3, 4, 5],
      referenced_traits: {},
      implemented_traits: [],
    },
  },
  optionalTraitParameter: {
    functionsInterfaces: [
      {
        name: "function",
        access: "public",
        args: [],
        outputs: {
          type: {
            response: {
              ok: "bool",
              error: "none",
            },
          },
        },
      },
      {
        name: "test-no-trait",
        access: "public",
        args: [],
        outputs: {
          type: {
            response: {
              ok: "bool",
              error: "none",
            },
          },
        },
      },
      {
        name: "test-trait",
        access: "public",
        args: [
          {
            name: "opt-trait",
            type: {
              optional: "trait_reference",
            },
          },
        ],
        outputs: {
          type: {
            response: {
              ok: "bool",
              error: "none",
            },
          },
        },
      },
      {
        name: "update-context",
        access: "public",
        args: [
          {
            name: "function-name",
            type: {
              "string-ascii": {
                length: 100,
              },
            },
          },
          {
            name: "called",
            type: "uint128",
          },
        ],
        outputs: {
          type: {
            response: {
              ok: "bool",
              error: "none",
            },
          },
        },
      },
    ],
    ast: {
      contract_identifier: {
        issuer: [
          26,
          [
            109, 120, 222, 123, 6, 37, 223, 191, 193, 108, 58, 138, 87, 53, 246,
            220, 61, 195, 242, 206,
          ],
        ],
        name: "trait",
      },
      pre_expressions: [],
      expressions: [
        {
          expr: {
            List: [
              {
                expr: {
                  Atom: "define-public",
                },
                id: 2,
                span: {
                  start_line: 1,
                  start_column: 2,
                  end_line: 1,
                  end_column: 14,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "function",
                      },
                      id: 4,
                      span: {
                        start_line: 1,
                        start_column: 17,
                        end_line: 1,
                        end_column: 24,
                      },
                    },
                  ],
                },
                id: 3,
                span: {
                  start_line: 1,
                  start_column: 16,
                  end_line: 1,
                  end_column: 25,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "ok",
                      },
                      id: 6,
                      span: {
                        start_line: 2,
                        start_column: 4,
                        end_line: 2,
                        end_column: 5,
                      },
                    },
                    {
                      expr: {
                        Atom: "true",
                      },
                      id: 7,
                      span: {
                        start_line: 2,
                        start_column: 7,
                        end_line: 2,
                        end_column: 10,
                      },
                    },
                  ],
                },
                id: 5,
                span: {
                  start_line: 2,
                  start_column: 3,
                  end_line: 2,
                  end_column: 11,
                },
              },
            ],
          },
          id: 1,
          span: {
            start_line: 1,
            start_column: 1,
            end_line: 3,
            end_column: 1,
          },
        },
        {
          expr: {
            List: [
              {
                expr: {
                  Atom: "define-map",
                },
                id: 9,
                span: {
                  start_line: 6,
                  start_column: 2,
                  end_line: 6,
                  end_column: 11,
                },
              },
              {
                expr: {
                  Atom: "context",
                },
                id: 10,
                span: {
                  start_line: 6,
                  start_column: 13,
                  end_line: 6,
                  end_column: 19,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "string-ascii",
                      },
                      id: 12,
                      span: {
                        start_line: 6,
                        start_column: 22,
                        end_line: 6,
                        end_column: 33,
                      },
                    },
                    {
                      expr: {
                        LiteralValue: {
                          Int: "100",
                        },
                      },
                      id: 13,
                      span: {
                        start_line: 6,
                        start_column: 35,
                        end_line: 6,
                        end_column: 37,
                      },
                    },
                  ],
                },
                id: 11,
                span: {
                  start_line: 6,
                  start_column: 21,
                  end_line: 6,
                  end_column: 38,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "tuple",
                      },
                      id: 15,
                      span: {
                        start_line: 0,
                        start_column: 0,
                        end_line: 0,
                        end_column: 0,
                      },
                    },
                    {
                      expr: {
                        List: [
                          {
                            expr: {
                              Atom: "called",
                            },
                            id: 17,
                            span: {
                              start_line: 7,
                              start_column: 5,
                              end_line: 7,
                              end_column: 10,
                            },
                          },
                          {
                            expr: {
                              Atom: "uint",
                            },
                            id: 18,
                            span: {
                              start_line: 7,
                              start_column: 13,
                              end_line: 7,
                              end_column: 16,
                            },
                            post_comments: [
                              [
                                "other data",
                                {
                                  start_line: 8,
                                  start_column: 5,
                                  end_line: 8,
                                  end_column: 17,
                                },
                              ],
                            ],
                          },
                        ],
                      },
                      id: 16,
                      span: {
                        start_line: 7,
                        start_column: 5,
                        end_line: 7,
                        end_column: 16,
                      },
                    },
                  ],
                },
                id: 14,
                span: {
                  start_line: 6,
                  start_column: 40,
                  end_line: 9,
                  end_column: 3,
                },
              },
            ],
          },
          id: 8,
          span: {
            start_line: 6,
            start_column: 1,
            end_line: 9,
            end_column: 4,
          },
        },
        {
          expr: {
            List: [
              {
                expr: {
                  Atom: "define-public",
                },
                id: 20,
                span: {
                  start_line: 11,
                  start_column: 4,
                  end_line: 11,
                  end_column: 16,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "update-context",
                      },
                      id: 22,
                      span: {
                        start_line: 11,
                        start_column: 19,
                        end_line: 11,
                        end_column: 32,
                      },
                    },
                    {
                      expr: {
                        List: [
                          {
                            expr: {
                              Atom: "function-name",
                            },
                            id: 24,
                            span: {
                              start_line: 11,
                              start_column: 35,
                              end_line: 11,
                              end_column: 47,
                            },
                          },
                          {
                            expr: {
                              List: [
                                {
                                  expr: {
                                    Atom: "string-ascii",
                                  },
                                  id: 26,
                                  span: {
                                    start_line: 11,
                                    start_column: 50,
                                    end_line: 11,
                                    end_column: 61,
                                  },
                                },
                                {
                                  expr: {
                                    LiteralValue: {
                                      Int: "100",
                                    },
                                  },
                                  id: 27,
                                  span: {
                                    start_line: 11,
                                    start_column: 63,
                                    end_line: 11,
                                    end_column: 65,
                                  },
                                },
                              ],
                            },
                            id: 25,
                            span: {
                              start_line: 11,
                              start_column: 49,
                              end_line: 11,
                              end_column: 66,
                            },
                          },
                        ],
                      },
                      id: 23,
                      span: {
                        start_line: 11,
                        start_column: 34,
                        end_line: 11,
                        end_column: 67,
                      },
                    },
                    {
                      expr: {
                        List: [
                          {
                            expr: {
                              Atom: "called",
                            },
                            id: 29,
                            span: {
                              start_line: 11,
                              start_column: 70,
                              end_line: 11,
                              end_column: 75,
                            },
                          },
                          {
                            expr: {
                              Atom: "uint",
                            },
                            id: 30,
                            span: {
                              start_line: 11,
                              start_column: 77,
                              end_line: 11,
                              end_column: 80,
                            },
                          },
                        ],
                      },
                      id: 28,
                      span: {
                        start_line: 11,
                        start_column: 69,
                        end_line: 11,
                        end_column: 81,
                      },
                    },
                  ],
                },
                id: 21,
                span: {
                  start_line: 11,
                  start_column: 18,
                  end_line: 11,
                  end_column: 82,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "ok",
                      },
                      id: 32,
                      span: {
                        start_line: 12,
                        start_column: 6,
                        end_line: 12,
                        end_column: 7,
                      },
                    },
                    {
                      expr: {
                        List: [
                          {
                            expr: {
                              Atom: "map-set",
                            },
                            id: 34,
                            span: {
                              start_line: 12,
                              start_column: 10,
                              end_line: 12,
                              end_column: 16,
                            },
                          },
                          {
                            expr: {
                              Atom: "context",
                            },
                            id: 35,
                            span: {
                              start_line: 12,
                              start_column: 18,
                              end_line: 12,
                              end_column: 24,
                            },
                          },
                          {
                            expr: {
                              Atom: "function-name",
                            },
                            id: 36,
                            span: {
                              start_line: 12,
                              start_column: 26,
                              end_line: 12,
                              end_column: 38,
                            },
                          },
                          {
                            expr: {
                              List: [
                                {
                                  expr: {
                                    Atom: "tuple",
                                  },
                                  id: 38,
                                  span: {
                                    start_line: 0,
                                    start_column: 0,
                                    end_line: 0,
                                    end_column: 0,
                                  },
                                },
                                {
                                  expr: {
                                    List: [
                                      {
                                        expr: {
                                          Atom: "called",
                                        },
                                        id: 40,
                                        span: {
                                          start_line: 12,
                                          start_column: 41,
                                          end_line: 12,
                                          end_column: 46,
                                        },
                                      },
                                      {
                                        expr: {
                                          Atom: "called",
                                        },
                                        id: 41,
                                        span: {
                                          start_line: 12,
                                          start_column: 49,
                                          end_line: 12,
                                          end_column: 54,
                                        },
                                      },
                                    ],
                                  },
                                  id: 39,
                                  span: {
                                    start_line: 12,
                                    start_column: 41,
                                    end_line: 12,
                                    end_column: 54,
                                  },
                                },
                              ],
                            },
                            id: 37,
                            span: {
                              start_line: 12,
                              start_column: 40,
                              end_line: 12,
                              end_column: 55,
                            },
                          },
                        ],
                      },
                      id: 33,
                      span: {
                        start_line: 12,
                        start_column: 9,
                        end_line: 12,
                        end_column: 56,
                      },
                    },
                  ],
                },
                id: 31,
                span: {
                  start_line: 12,
                  start_column: 5,
                  end_line: 12,
                  end_column: 57,
                },
              },
            ],
          },
          id: 19,
          span: {
            start_line: 11,
            start_column: 3,
            end_line: 12,
            end_column: 58,
          },
        },
        {
          expr: {
            List: [
              {
                expr: {
                  Atom: "use-trait",
                },
                id: 43,
                span: {
                  start_line: 14,
                  start_column: 2,
                  end_line: 14,
                  end_column: 10,
                },
              },
              {
                expr: {
                  Atom: "ft-trait",
                },
                id: 44,
                span: {
                  start_line: 14,
                  start_column: 12,
                  end_line: 14,
                  end_column: 19,
                },
              },
              {
                expr: {
                  Field: {
                    name: "sip-010-trait",
                    contract_identifier: {
                      issuer: [
                        22,
                        [
                          9, 159, 184, 137, 38, 216, 47, 48, 178, 244, 14, 175,
                          62, 228, 35, 203, 114, 91, 219, 59,
                        ],
                      ],
                      name: "sip-010-trait-ft-standard",
                    },
                  },
                },
                id: 45,
                span: {
                  start_line: 14,
                  start_column: 21,
                  end_line: 14,
                  end_column: 101,
                },
              },
            ],
          },
          id: 42,
          span: {
            start_line: 14,
            start_column: 1,
            end_line: 14,
            end_column: 102,
          },
        },
        {
          expr: {
            List: [
              {
                expr: {
                  Atom: "define-public",
                },
                id: 47,
                span: {
                  start_line: 16,
                  start_column: 2,
                  end_line: 16,
                  end_column: 14,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "test-no-trait",
                      },
                      id: 49,
                      span: {
                        start_line: 16,
                        start_column: 17,
                        end_line: 16,
                        end_column: 29,
                      },
                    },
                  ],
                },
                id: 48,
                span: {
                  start_line: 16,
                  start_column: 16,
                  end_line: 16,
                  end_column: 30,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "ok",
                      },
                      id: 51,
                      span: {
                        start_line: 17,
                        start_column: 4,
                        end_line: 17,
                        end_column: 5,
                      },
                    },
                    {
                      expr: {
                        Atom: "true",
                      },
                      id: 52,
                      span: {
                        start_line: 17,
                        start_column: 7,
                        end_line: 17,
                        end_column: 10,
                      },
                    },
                  ],
                },
                id: 50,
                span: {
                  start_line: 17,
                  start_column: 3,
                  end_line: 17,
                  end_column: 11,
                },
              },
            ],
          },
          id: 46,
          span: {
            start_line: 16,
            start_column: 1,
            end_line: 18,
            end_column: 1,
          },
        },
        {
          expr: {
            List: [
              {
                expr: {
                  Atom: "define-public",
                },
                id: 54,
                span: {
                  start_line: 20,
                  start_column: 2,
                  end_line: 20,
                  end_column: 14,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "test-trait",
                      },
                      id: 56,
                      span: {
                        start_line: 20,
                        start_column: 17,
                        end_line: 20,
                        end_column: 26,
                      },
                    },
                    {
                      expr: {
                        List: [
                          {
                            expr: {
                              Atom: "opt-trait",
                            },
                            id: 58,
                            span: {
                              start_line: 20,
                              start_column: 29,
                              end_line: 20,
                              end_column: 37,
                            },
                          },
                          {
                            expr: {
                              List: [
                                {
                                  expr: {
                                    Atom: "optional",
                                  },
                                  id: 60,
                                  span: {
                                    start_line: 20,
                                    start_column: 40,
                                    end_line: 20,
                                    end_column: 47,
                                  },
                                },
                                {
                                  expr: {
                                    TraitReference: [
                                      "ft-trait",
                                      {
                                        Imported: {
                                          name: "sip-010-trait",
                                          contract_identifier: {
                                            issuer: [
                                              22,
                                              [
                                                9, 159, 184, 137, 38, 216, 47,
                                                48, 178, 244, 14, 175, 62, 228,
                                                35, 203, 114, 91, 219, 59,
                                              ],
                                            ],
                                            name: "sip-010-trait-ft-standard",
                                          },
                                        },
                                      },
                                    ],
                                  },
                                  id: 61,
                                  span: {
                                    start_line: 20,
                                    start_column: 49,
                                    end_line: 20,
                                    end_column: 58,
                                  },
                                },
                              ],
                            },
                            id: 59,
                            span: {
                              start_line: 20,
                              start_column: 39,
                              end_line: 20,
                              end_column: 59,
                            },
                          },
                        ],
                      },
                      id: 57,
                      span: {
                        start_line: 20,
                        start_column: 28,
                        end_line: 20,
                        end_column: 60,
                      },
                    },
                  ],
                },
                id: 55,
                span: {
                  start_line: 20,
                  start_column: 16,
                  end_line: 20,
                  end_column: 61,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "ok",
                      },
                      id: 63,
                      span: {
                        start_line: 21,
                        start_column: 4,
                        end_line: 21,
                        end_column: 5,
                      },
                    },
                    {
                      expr: {
                        Atom: "true",
                      },
                      id: 64,
                      span: {
                        start_line: 21,
                        start_column: 7,
                        end_line: 21,
                        end_column: 10,
                      },
                    },
                  ],
                },
                id: 62,
                span: {
                  start_line: 21,
                  start_column: 3,
                  end_line: 21,
                  end_column: 11,
                },
              },
            ],
          },
          id: 53,
          span: {
            start_line: 20,
            start_column: 1,
            end_line: 22,
            end_column: 1,
          },
        },
      ],
      top_level_expression_sorting: [0, 1, 2, 3, 4, 5],
      referenced_traits: {},
      implemented_traits: [],
    },
  },
  mixedDirectAndNestedTraits: {
    functionsInterfaces: [
      {
        name: "function",
        access: "public",
        args: [],
        outputs: {
          type: {
            response: {
              ok: "bool",
              error: "none",
            },
          },
        },
      },
      {
        name: "test-mixed-traits",
        access: "public",
        args: [
          {
            name: "direct",
            type: "trait_reference",
          },
          {
            name: "list-1",
            type: {
              list: {
                type: "trait_reference",
                length: 4,
              },
            },
          },
          {
            name: "mad",
            type: {
              tuple: [
                {
                  name: "list-mad",
                  type: {
                    list: {
                      type: {
                        tuple: [
                          {
                            name: "mad-inner",
                            type: "trait_reference",
                          },
                        ],
                      },
                      length: 7,
                    },
                  },
                },
              ],
            },
          },
        ],
        outputs: {
          type: {
            response: {
              ok: "bool",
              error: "none",
            },
          },
        },
      },
      {
        name: "update-context",
        access: "public",
        args: [
          {
            name: "function-name",
            type: {
              "string-ascii": {
                length: 100,
              },
            },
          },
          {
            name: "called",
            type: "uint128",
          },
        ],
        outputs: {
          type: {
            response: {
              ok: "bool",
              error: "none",
            },
          },
        },
      },
    ],
    ast: {
      contract_identifier: {
        issuer: [
          26,
          [
            109, 120, 222, 123, 6, 37, 223, 191, 193, 108, 58, 138, 87, 53, 246,
            220, 61, 195, 242, 206,
          ],
        ],
        name: "trait",
      },
      pre_expressions: [],
      expressions: [
        {
          expr: {
            List: [
              {
                expr: {
                  Atom: "use-trait",
                },
                id: 2,
                span: {
                  start_line: 1,
                  start_column: 2,
                  end_line: 1,
                  end_column: 10,
                },
              },
              {
                expr: {
                  Atom: "ft-trait",
                },
                id: 3,
                span: {
                  start_line: 1,
                  start_column: 12,
                  end_line: 1,
                  end_column: 19,
                },
              },
              {
                expr: {
                  Field: {
                    name: "sip-010-trait",
                    contract_identifier: {
                      issuer: [
                        22,
                        [
                          9, 159, 184, 137, 38, 216, 47, 48, 178, 244, 14, 175,
                          62, 228, 35, 203, 114, 91, 219, 59,
                        ],
                      ],
                      name: "sip-010-trait-ft-standard",
                    },
                  },
                },
                id: 4,
                span: {
                  start_line: 1,
                  start_column: 21,
                  end_line: 1,
                  end_column: 101,
                },
              },
            ],
          },
          id: 1,
          span: {
            start_line: 1,
            start_column: 1,
            end_line: 1,
            end_column: 102,
          },
        },
        {
          expr: {
            List: [
              {
                expr: {
                  Atom: "define-public",
                },
                id: 6,
                span: {
                  start_line: 3,
                  start_column: 2,
                  end_line: 3,
                  end_column: 14,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "function",
                      },
                      id: 8,
                      span: {
                        start_line: 3,
                        start_column: 17,
                        end_line: 3,
                        end_column: 24,
                      },
                    },
                  ],
                },
                id: 7,
                span: {
                  start_line: 3,
                  start_column: 16,
                  end_line: 3,
                  end_column: 25,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "ok",
                      },
                      id: 10,
                      span: {
                        start_line: 4,
                        start_column: 4,
                        end_line: 4,
                        end_column: 5,
                      },
                    },
                    {
                      expr: {
                        Atom: "true",
                      },
                      id: 11,
                      span: {
                        start_line: 4,
                        start_column: 7,
                        end_line: 4,
                        end_column: 10,
                      },
                    },
                  ],
                },
                id: 9,
                span: {
                  start_line: 4,
                  start_column: 3,
                  end_line: 4,
                  end_column: 11,
                },
              },
            ],
          },
          id: 5,
          span: {
            start_line: 3,
            start_column: 1,
            end_line: 5,
            end_column: 1,
          },
        },
        {
          expr: {
            List: [
              {
                expr: {
                  Atom: "define-map",
                },
                id: 13,
                span: {
                  start_line: 8,
                  start_column: 2,
                  end_line: 8,
                  end_column: 11,
                },
              },
              {
                expr: {
                  Atom: "context",
                },
                id: 14,
                span: {
                  start_line: 8,
                  start_column: 13,
                  end_line: 8,
                  end_column: 19,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "string-ascii",
                      },
                      id: 16,
                      span: {
                        start_line: 8,
                        start_column: 22,
                        end_line: 8,
                        end_column: 33,
                      },
                    },
                    {
                      expr: {
                        LiteralValue: {
                          Int: "100",
                        },
                      },
                      id: 17,
                      span: {
                        start_line: 8,
                        start_column: 35,
                        end_line: 8,
                        end_column: 37,
                      },
                    },
                  ],
                },
                id: 15,
                span: {
                  start_line: 8,
                  start_column: 21,
                  end_line: 8,
                  end_column: 38,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "tuple",
                      },
                      id: 19,
                      span: {
                        start_line: 0,
                        start_column: 0,
                        end_line: 0,
                        end_column: 0,
                      },
                    },
                    {
                      expr: {
                        List: [
                          {
                            expr: {
                              Atom: "called",
                            },
                            id: 21,
                            span: {
                              start_line: 9,
                              start_column: 5,
                              end_line: 9,
                              end_column: 10,
                            },
                          },
                          {
                            expr: {
                              Atom: "uint",
                            },
                            id: 22,
                            span: {
                              start_line: 9,
                              start_column: 13,
                              end_line: 9,
                              end_column: 16,
                            },
                            post_comments: [
                              [
                                "other data",
                                {
                                  start_line: 10,
                                  start_column: 5,
                                  end_line: 10,
                                  end_column: 17,
                                },
                              ],
                            ],
                          },
                        ],
                      },
                      id: 20,
                      span: {
                        start_line: 9,
                        start_column: 5,
                        end_line: 9,
                        end_column: 16,
                      },
                    },
                  ],
                },
                id: 18,
                span: {
                  start_line: 8,
                  start_column: 40,
                  end_line: 11,
                  end_column: 3,
                },
              },
            ],
          },
          id: 12,
          span: {
            start_line: 8,
            start_column: 1,
            end_line: 11,
            end_column: 4,
          },
        },
        {
          expr: {
            List: [
              {
                expr: {
                  Atom: "define-public",
                },
                id: 24,
                span: {
                  start_line: 13,
                  start_column: 4,
                  end_line: 13,
                  end_column: 16,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "update-context",
                      },
                      id: 26,
                      span: {
                        start_line: 13,
                        start_column: 19,
                        end_line: 13,
                        end_column: 32,
                      },
                    },
                    {
                      expr: {
                        List: [
                          {
                            expr: {
                              Atom: "function-name",
                            },
                            id: 28,
                            span: {
                              start_line: 13,
                              start_column: 35,
                              end_line: 13,
                              end_column: 47,
                            },
                          },
                          {
                            expr: {
                              List: [
                                {
                                  expr: {
                                    Atom: "string-ascii",
                                  },
                                  id: 30,
                                  span: {
                                    start_line: 13,
                                    start_column: 50,
                                    end_line: 13,
                                    end_column: 61,
                                  },
                                },
                                {
                                  expr: {
                                    LiteralValue: {
                                      Int: "100",
                                    },
                                  },
                                  id: 31,
                                  span: {
                                    start_line: 13,
                                    start_column: 63,
                                    end_line: 13,
                                    end_column: 65,
                                  },
                                },
                              ],
                            },
                            id: 29,
                            span: {
                              start_line: 13,
                              start_column: 49,
                              end_line: 13,
                              end_column: 66,
                            },
                          },
                        ],
                      },
                      id: 27,
                      span: {
                        start_line: 13,
                        start_column: 34,
                        end_line: 13,
                        end_column: 67,
                      },
                    },
                    {
                      expr: {
                        List: [
                          {
                            expr: {
                              Atom: "called",
                            },
                            id: 33,
                            span: {
                              start_line: 13,
                              start_column: 70,
                              end_line: 13,
                              end_column: 75,
                            },
                          },
                          {
                            expr: {
                              Atom: "uint",
                            },
                            id: 34,
                            span: {
                              start_line: 13,
                              start_column: 77,
                              end_line: 13,
                              end_column: 80,
                            },
                          },
                        ],
                      },
                      id: 32,
                      span: {
                        start_line: 13,
                        start_column: 69,
                        end_line: 13,
                        end_column: 81,
                      },
                    },
                  ],
                },
                id: 25,
                span: {
                  start_line: 13,
                  start_column: 18,
                  end_line: 13,
                  end_column: 82,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "ok",
                      },
                      id: 36,
                      span: {
                        start_line: 14,
                        start_column: 6,
                        end_line: 14,
                        end_column: 7,
                      },
                    },
                    {
                      expr: {
                        List: [
                          {
                            expr: {
                              Atom: "map-set",
                            },
                            id: 38,
                            span: {
                              start_line: 14,
                              start_column: 10,
                              end_line: 14,
                              end_column: 16,
                            },
                          },
                          {
                            expr: {
                              Atom: "context",
                            },
                            id: 39,
                            span: {
                              start_line: 14,
                              start_column: 18,
                              end_line: 14,
                              end_column: 24,
                            },
                          },
                          {
                            expr: {
                              Atom: "function-name",
                            },
                            id: 40,
                            span: {
                              start_line: 14,
                              start_column: 26,
                              end_line: 14,
                              end_column: 38,
                            },
                          },
                          {
                            expr: {
                              List: [
                                {
                                  expr: {
                                    Atom: "tuple",
                                  },
                                  id: 42,
                                  span: {
                                    start_line: 0,
                                    start_column: 0,
                                    end_line: 0,
                                    end_column: 0,
                                  },
                                },
                                {
                                  expr: {
                                    List: [
                                      {
                                        expr: {
                                          Atom: "called",
                                        },
                                        id: 44,
                                        span: {
                                          start_line: 14,
                                          start_column: 41,
                                          end_line: 14,
                                          end_column: 46,
                                        },
                                      },
                                      {
                                        expr: {
                                          Atom: "called",
                                        },
                                        id: 45,
                                        span: {
                                          start_line: 14,
                                          start_column: 49,
                                          end_line: 14,
                                          end_column: 54,
                                        },
                                      },
                                    ],
                                  },
                                  id: 43,
                                  span: {
                                    start_line: 14,
                                    start_column: 41,
                                    end_line: 14,
                                    end_column: 54,
                                  },
                                },
                              ],
                            },
                            id: 41,
                            span: {
                              start_line: 14,
                              start_column: 40,
                              end_line: 14,
                              end_column: 55,
                            },
                          },
                        ],
                      },
                      id: 37,
                      span: {
                        start_line: 14,
                        start_column: 9,
                        end_line: 14,
                        end_column: 56,
                      },
                    },
                  ],
                },
                id: 35,
                span: {
                  start_line: 14,
                  start_column: 5,
                  end_line: 14,
                  end_column: 57,
                },
              },
            ],
          },
          id: 23,
          span: {
            start_line: 13,
            start_column: 3,
            end_line: 14,
            end_column: 58,
          },
        },
        {
          expr: {
            List: [
              {
                expr: {
                  Atom: "define-public",
                },
                id: 47,
                span: {
                  start_line: 16,
                  start_column: 2,
                  end_line: 16,
                  end_column: 14,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "test-mixed-traits",
                      },
                      id: 49,
                      span: {
                        start_line: 16,
                        start_column: 17,
                        end_line: 16,
                        end_column: 33,
                      },
                    },
                    {
                      expr: {
                        List: [
                          {
                            expr: {
                              Atom: "direct",
                            },
                            id: 51,
                            span: {
                              start_line: 17,
                              start_column: 6,
                              end_line: 17,
                              end_column: 11,
                            },
                          },
                          {
                            expr: {
                              TraitReference: [
                                "ft-trait",
                                {
                                  Imported: {
                                    name: "sip-010-trait",
                                    contract_identifier: {
                                      issuer: [
                                        22,
                                        [
                                          9, 159, 184, 137, 38, 216, 47, 48,
                                          178, 244, 14, 175, 62, 228, 35, 203,
                                          114, 91, 219, 59,
                                        ],
                                      ],
                                      name: "sip-010-trait-ft-standard",
                                    },
                                  },
                                },
                              ],
                            },
                            id: 52,
                            span: {
                              start_line: 17,
                              start_column: 13,
                              end_line: 17,
                              end_column: 22,
                            },
                          },
                        ],
                      },
                      id: 50,
                      span: {
                        start_line: 17,
                        start_column: 5,
                        end_line: 17,
                        end_column: 23,
                      },
                    },
                    {
                      expr: {
                        List: [
                          {
                            expr: {
                              Atom: "list-1",
                            },
                            id: 54,
                            span: {
                              start_line: 18,
                              start_column: 6,
                              end_line: 18,
                              end_column: 11,
                            },
                          },
                          {
                            expr: {
                              List: [
                                {
                                  expr: {
                                    Atom: "list",
                                  },
                                  id: 56,
                                  span: {
                                    start_line: 18,
                                    start_column: 14,
                                    end_line: 18,
                                    end_column: 17,
                                  },
                                },
                                {
                                  expr: {
                                    LiteralValue: {
                                      Int: "4",
                                    },
                                  },
                                  id: 57,
                                  span: {
                                    start_line: 18,
                                    start_column: 19,
                                    end_line: 18,
                                    end_column: 19,
                                  },
                                },
                                {
                                  expr: {
                                    TraitReference: [
                                      "ft-trait",
                                      {
                                        Imported: {
                                          name: "sip-010-trait",
                                          contract_identifier: {
                                            issuer: [
                                              22,
                                              [
                                                9, 159, 184, 137, 38, 216, 47,
                                                48, 178, 244, 14, 175, 62, 228,
                                                35, 203, 114, 91, 219, 59,
                                              ],
                                            ],
                                            name: "sip-010-trait-ft-standard",
                                          },
                                        },
                                      },
                                    ],
                                  },
                                  id: 58,
                                  span: {
                                    start_line: 18,
                                    start_column: 21,
                                    end_line: 18,
                                    end_column: 30,
                                  },
                                },
                              ],
                            },
                            id: 55,
                            span: {
                              start_line: 18,
                              start_column: 13,
                              end_line: 18,
                              end_column: 31,
                            },
                          },
                        ],
                      },
                      id: 53,
                      span: {
                        start_line: 18,
                        start_column: 5,
                        end_line: 18,
                        end_column: 32,
                      },
                    },
                    {
                      expr: {
                        List: [
                          {
                            expr: {
                              Atom: "mad",
                            },
                            id: 60,
                            span: {
                              start_line: 19,
                              start_column: 6,
                              end_line: 19,
                              end_column: 8,
                            },
                          },
                          {
                            expr: {
                              List: [
                                {
                                  expr: {
                                    Atom: "tuple",
                                  },
                                  id: 62,
                                  span: {
                                    start_line: 0,
                                    start_column: 0,
                                    end_line: 0,
                                    end_column: 0,
                                  },
                                },
                                {
                                  expr: {
                                    List: [
                                      {
                                        expr: {
                                          Atom: "list-mad",
                                        },
                                        id: 64,
                                        span: {
                                          start_line: 21,
                                          start_column: 9,
                                          end_line: 21,
                                          end_column: 16,
                                        },
                                      },
                                      {
                                        expr: {
                                          List: [
                                            {
                                              expr: {
                                                Atom: "list",
                                              },
                                              id: 66,
                                              span: {
                                                start_line: 21,
                                                start_column: 20,
                                                end_line: 21,
                                                end_column: 23,
                                              },
                                            },
                                            {
                                              expr: {
                                                LiteralValue: {
                                                  Int: "7",
                                                },
                                              },
                                              id: 67,
                                              span: {
                                                start_line: 21,
                                                start_column: 25,
                                                end_line: 21,
                                                end_column: 25,
                                              },
                                            },
                                            {
                                              expr: {
                                                List: [
                                                  {
                                                    expr: {
                                                      Atom: "tuple",
                                                    },
                                                    id: 69,
                                                    span: {
                                                      start_line: 0,
                                                      start_column: 0,
                                                      end_line: 0,
                                                      end_column: 0,
                                                    },
                                                  },
                                                  {
                                                    expr: {
                                                      List: [
                                                        {
                                                          expr: {
                                                            Atom: "mad-inner",
                                                          },
                                                          id: 71,
                                                          span: {
                                                            start_line: 21,
                                                            start_column: 29,
                                                            end_line: 21,
                                                            end_column: 37,
                                                          },
                                                        },
                                                        {
                                                          expr: {
                                                            TraitReference: [
                                                              "ft-trait",
                                                              {
                                                                Imported: {
                                                                  name: "sip-010-trait",
                                                                  contract_identifier:
                                                                    {
                                                                      issuer: [
                                                                        22,
                                                                        [
                                                                          9,
                                                                          159,
                                                                          184,
                                                                          137,
                                                                          38,
                                                                          216,
                                                                          47,
                                                                          48,
                                                                          178,
                                                                          244,
                                                                          14,
                                                                          175,
                                                                          62,
                                                                          228,
                                                                          35,
                                                                          203,
                                                                          114,
                                                                          91,
                                                                          219,
                                                                          59,
                                                                        ],
                                                                      ],
                                                                      name: "sip-010-trait-ft-standard",
                                                                    },
                                                                },
                                                              },
                                                            ],
                                                          },
                                                          id: 72,
                                                          span: {
                                                            start_line: 21,
                                                            start_column: 40,
                                                            end_line: 21,
                                                            end_column: 49,
                                                          },
                                                        },
                                                      ],
                                                    },
                                                    id: 70,
                                                    span: {
                                                      start_line: 21,
                                                      start_column: 29,
                                                      end_line: 21,
                                                      end_column: 49,
                                                    },
                                                  },
                                                ],
                                              },
                                              id: 68,
                                              span: {
                                                start_line: 21,
                                                start_column: 27,
                                                end_line: 21,
                                                end_column: 51,
                                              },
                                            },
                                          ],
                                        },
                                        id: 65,
                                        span: {
                                          start_line: 21,
                                          start_column: 19,
                                          end_line: 21,
                                          end_column: 52,
                                        },
                                      },
                                    ],
                                  },
                                  id: 63,
                                  span: {
                                    start_line: 21,
                                    start_column: 9,
                                    end_line: 21,
                                    end_column: 52,
                                  },
                                },
                              ],
                            },
                            id: 61,
                            span: {
                              start_line: 20,
                              start_column: 7,
                              end_line: 22,
                              end_column: 7,
                            },
                          },
                        ],
                      },
                      id: 59,
                      span: {
                        start_line: 19,
                        start_column: 5,
                        end_line: 23,
                        end_column: 5,
                      },
                    },
                  ],
                },
                id: 48,
                span: {
                  start_line: 16,
                  start_column: 16,
                  end_line: 24,
                  end_column: 3,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "ok",
                      },
                      id: 74,
                      span: {
                        start_line: 25,
                        start_column: 4,
                        end_line: 25,
                        end_column: 5,
                      },
                    },
                    {
                      expr: {
                        Atom: "true",
                      },
                      id: 75,
                      span: {
                        start_line: 25,
                        start_column: 7,
                        end_line: 25,
                        end_column: 10,
                      },
                    },
                  ],
                },
                id: 73,
                span: {
                  start_line: 25,
                  start_column: 3,
                  end_line: 25,
                  end_column: 11,
                },
              },
            ],
          },
          id: 46,
          span: {
            start_line: 16,
            start_column: 1,
            end_line: 26,
            end_column: 1,
          },
        },
      ],
      top_level_expression_sorting: [0, 1, 2, 3, 4],
      referenced_traits: {},
      implemented_traits: [],
    },
  },
  listTupleNestedTrait: {
    functionsInterfaces: [
      {
        name: "function",
        access: "public",
        args: [],
        outputs: {
          type: {
            response: {
              ok: "bool",
              error: "none",
            },
          },
        },
      },
      {
        name: "test-mixed-traits",
        access: "public",
        args: [
          {
            name: "list-tuple-trait",
            type: {
              list: {
                type: {
                  tuple: [
                    {
                      name: "mad-inner",
                      type: "trait_reference",
                    },
                  ],
                },
                length: 4,
              },
            },
          },
        ],
        outputs: {
          type: {
            response: {
              ok: "bool",
              error: "none",
            },
          },
        },
      },
      {
        name: "update-context",
        access: "public",
        args: [
          {
            name: "function-name",
            type: {
              "string-ascii": {
                length: 100,
              },
            },
          },
          {
            name: "called",
            type: "uint128",
          },
        ],
        outputs: {
          type: {
            response: {
              ok: "bool",
              error: "none",
            },
          },
        },
      },
    ],
    ast: {
      contract_identifier: {
        issuer: [
          26,
          [
            109, 120, 222, 123, 6, 37, 223, 191, 193, 108, 58, 138, 87, 53, 246,
            220, 61, 195, 242, 206,
          ],
        ],
        name: "trait",
      },
      pre_expressions: [],
      expressions: [
        {
          expr: {
            List: [
              {
                expr: {
                  Atom: "use-trait",
                },
                id: 2,
                span: {
                  start_line: 1,
                  start_column: 2,
                  end_line: 1,
                  end_column: 10,
                },
              },
              {
                expr: {
                  Atom: "ft-trait",
                },
                id: 3,
                span: {
                  start_line: 1,
                  start_column: 12,
                  end_line: 1,
                  end_column: 19,
                },
              },
              {
                expr: {
                  Field: {
                    name: "sip-010-trait",
                    contract_identifier: {
                      issuer: [
                        22,
                        [
                          9, 159, 184, 137, 38, 216, 47, 48, 178, 244, 14, 175,
                          62, 228, 35, 203, 114, 91, 219, 59,
                        ],
                      ],
                      name: "sip-010-trait-ft-standard",
                    },
                  },
                },
                id: 4,
                span: {
                  start_line: 1,
                  start_column: 21,
                  end_line: 1,
                  end_column: 101,
                },
              },
            ],
          },
          id: 1,
          span: {
            start_line: 1,
            start_column: 1,
            end_line: 1,
            end_column: 102,
          },
        },
        {
          expr: {
            List: [
              {
                expr: {
                  Atom: "define-public",
                },
                id: 6,
                span: {
                  start_line: 3,
                  start_column: 2,
                  end_line: 3,
                  end_column: 14,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "function",
                      },
                      id: 8,
                      span: {
                        start_line: 3,
                        start_column: 17,
                        end_line: 3,
                        end_column: 24,
                      },
                    },
                  ],
                },
                id: 7,
                span: {
                  start_line: 3,
                  start_column: 16,
                  end_line: 3,
                  end_column: 25,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "ok",
                      },
                      id: 10,
                      span: {
                        start_line: 4,
                        start_column: 4,
                        end_line: 4,
                        end_column: 5,
                      },
                    },
                    {
                      expr: {
                        Atom: "true",
                      },
                      id: 11,
                      span: {
                        start_line: 4,
                        start_column: 7,
                        end_line: 4,
                        end_column: 10,
                      },
                    },
                  ],
                },
                id: 9,
                span: {
                  start_line: 4,
                  start_column: 3,
                  end_line: 4,
                  end_column: 11,
                },
              },
            ],
          },
          id: 5,
          span: {
            start_line: 3,
            start_column: 1,
            end_line: 5,
            end_column: 1,
          },
        },
        {
          expr: {
            List: [
              {
                expr: {
                  Atom: "define-map",
                },
                id: 13,
                span: {
                  start_line: 8,
                  start_column: 2,
                  end_line: 8,
                  end_column: 11,
                },
              },
              {
                expr: {
                  Atom: "context",
                },
                id: 14,
                span: {
                  start_line: 8,
                  start_column: 13,
                  end_line: 8,
                  end_column: 19,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "string-ascii",
                      },
                      id: 16,
                      span: {
                        start_line: 8,
                        start_column: 22,
                        end_line: 8,
                        end_column: 33,
                      },
                    },
                    {
                      expr: {
                        LiteralValue: {
                          Int: "100",
                        },
                      },
                      id: 17,
                      span: {
                        start_line: 8,
                        start_column: 35,
                        end_line: 8,
                        end_column: 37,
                      },
                    },
                  ],
                },
                id: 15,
                span: {
                  start_line: 8,
                  start_column: 21,
                  end_line: 8,
                  end_column: 38,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "tuple",
                      },
                      id: 19,
                      span: {
                        start_line: 0,
                        start_column: 0,
                        end_line: 0,
                        end_column: 0,
                      },
                    },
                    {
                      expr: {
                        List: [
                          {
                            expr: {
                              Atom: "called",
                            },
                            id: 21,
                            span: {
                              start_line: 9,
                              start_column: 5,
                              end_line: 9,
                              end_column: 10,
                            },
                          },
                          {
                            expr: {
                              Atom: "uint",
                            },
                            id: 22,
                            span: {
                              start_line: 9,
                              start_column: 13,
                              end_line: 9,
                              end_column: 16,
                            },
                            post_comments: [
                              [
                                "other data",
                                {
                                  start_line: 10,
                                  start_column: 5,
                                  end_line: 10,
                                  end_column: 17,
                                },
                              ],
                            ],
                          },
                        ],
                      },
                      id: 20,
                      span: {
                        start_line: 9,
                        start_column: 5,
                        end_line: 9,
                        end_column: 16,
                      },
                    },
                  ],
                },
                id: 18,
                span: {
                  start_line: 8,
                  start_column: 40,
                  end_line: 11,
                  end_column: 3,
                },
              },
            ],
          },
          id: 12,
          span: {
            start_line: 8,
            start_column: 1,
            end_line: 11,
            end_column: 4,
          },
        },
        {
          expr: {
            List: [
              {
                expr: {
                  Atom: "define-public",
                },
                id: 24,
                span: {
                  start_line: 13,
                  start_column: 4,
                  end_line: 13,
                  end_column: 16,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "update-context",
                      },
                      id: 26,
                      span: {
                        start_line: 13,
                        start_column: 19,
                        end_line: 13,
                        end_column: 32,
                      },
                    },
                    {
                      expr: {
                        List: [
                          {
                            expr: {
                              Atom: "function-name",
                            },
                            id: 28,
                            span: {
                              start_line: 13,
                              start_column: 35,
                              end_line: 13,
                              end_column: 47,
                            },
                          },
                          {
                            expr: {
                              List: [
                                {
                                  expr: {
                                    Atom: "string-ascii",
                                  },
                                  id: 30,
                                  span: {
                                    start_line: 13,
                                    start_column: 50,
                                    end_line: 13,
                                    end_column: 61,
                                  },
                                },
                                {
                                  expr: {
                                    LiteralValue: {
                                      Int: "100",
                                    },
                                  },
                                  id: 31,
                                  span: {
                                    start_line: 13,
                                    start_column: 63,
                                    end_line: 13,
                                    end_column: 65,
                                  },
                                },
                              ],
                            },
                            id: 29,
                            span: {
                              start_line: 13,
                              start_column: 49,
                              end_line: 13,
                              end_column: 66,
                            },
                          },
                        ],
                      },
                      id: 27,
                      span: {
                        start_line: 13,
                        start_column: 34,
                        end_line: 13,
                        end_column: 67,
                      },
                    },
                    {
                      expr: {
                        List: [
                          {
                            expr: {
                              Atom: "called",
                            },
                            id: 33,
                            span: {
                              start_line: 13,
                              start_column: 70,
                              end_line: 13,
                              end_column: 75,
                            },
                          },
                          {
                            expr: {
                              Atom: "uint",
                            },
                            id: 34,
                            span: {
                              start_line: 13,
                              start_column: 77,
                              end_line: 13,
                              end_column: 80,
                            },
                          },
                        ],
                      },
                      id: 32,
                      span: {
                        start_line: 13,
                        start_column: 69,
                        end_line: 13,
                        end_column: 81,
                      },
                    },
                  ],
                },
                id: 25,
                span: {
                  start_line: 13,
                  start_column: 18,
                  end_line: 13,
                  end_column: 82,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "ok",
                      },
                      id: 36,
                      span: {
                        start_line: 14,
                        start_column: 6,
                        end_line: 14,
                        end_column: 7,
                      },
                    },
                    {
                      expr: {
                        List: [
                          {
                            expr: {
                              Atom: "map-set",
                            },
                            id: 38,
                            span: {
                              start_line: 14,
                              start_column: 10,
                              end_line: 14,
                              end_column: 16,
                            },
                          },
                          {
                            expr: {
                              Atom: "context",
                            },
                            id: 39,
                            span: {
                              start_line: 14,
                              start_column: 18,
                              end_line: 14,
                              end_column: 24,
                            },
                          },
                          {
                            expr: {
                              Atom: "function-name",
                            },
                            id: 40,
                            span: {
                              start_line: 14,
                              start_column: 26,
                              end_line: 14,
                              end_column: 38,
                            },
                          },
                          {
                            expr: {
                              List: [
                                {
                                  expr: {
                                    Atom: "tuple",
                                  },
                                  id: 42,
                                  span: {
                                    start_line: 0,
                                    start_column: 0,
                                    end_line: 0,
                                    end_column: 0,
                                  },
                                },
                                {
                                  expr: {
                                    List: [
                                      {
                                        expr: {
                                          Atom: "called",
                                        },
                                        id: 44,
                                        span: {
                                          start_line: 14,
                                          start_column: 41,
                                          end_line: 14,
                                          end_column: 46,
                                        },
                                      },
                                      {
                                        expr: {
                                          Atom: "called",
                                        },
                                        id: 45,
                                        span: {
                                          start_line: 14,
                                          start_column: 49,
                                          end_line: 14,
                                          end_column: 54,
                                        },
                                      },
                                    ],
                                  },
                                  id: 43,
                                  span: {
                                    start_line: 14,
                                    start_column: 41,
                                    end_line: 14,
                                    end_column: 54,
                                  },
                                },
                              ],
                            },
                            id: 41,
                            span: {
                              start_line: 14,
                              start_column: 40,
                              end_line: 14,
                              end_column: 55,
                            },
                          },
                        ],
                      },
                      id: 37,
                      span: {
                        start_line: 14,
                        start_column: 9,
                        end_line: 14,
                        end_column: 56,
                      },
                    },
                  ],
                },
                id: 35,
                span: {
                  start_line: 14,
                  start_column: 5,
                  end_line: 14,
                  end_column: 57,
                },
              },
            ],
          },
          id: 23,
          span: {
            start_line: 13,
            start_column: 3,
            end_line: 14,
            end_column: 58,
          },
        },
        {
          expr: {
            List: [
              {
                expr: {
                  Atom: "define-public",
                },
                id: 47,
                span: {
                  start_line: 16,
                  start_column: 2,
                  end_line: 16,
                  end_column: 14,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "test-mixed-traits",
                      },
                      id: 49,
                      span: {
                        start_line: 16,
                        start_column: 17,
                        end_line: 16,
                        end_column: 33,
                      },
                    },
                    {
                      expr: {
                        List: [
                          {
                            expr: {
                              Atom: "list-tuple-trait",
                            },
                            id: 51,
                            span: {
                              start_line: 17,
                              start_column: 6,
                              end_line: 17,
                              end_column: 21,
                            },
                          },
                          {
                            expr: {
                              List: [
                                {
                                  expr: {
                                    Atom: "list",
                                  },
                                  id: 53,
                                  span: {
                                    start_line: 17,
                                    start_column: 24,
                                    end_line: 17,
                                    end_column: 27,
                                  },
                                },
                                {
                                  expr: {
                                    LiteralValue: {
                                      Int: "4",
                                    },
                                  },
                                  id: 54,
                                  span: {
                                    start_line: 17,
                                    start_column: 29,
                                    end_line: 17,
                                    end_column: 29,
                                  },
                                },
                                {
                                  expr: {
                                    List: [
                                      {
                                        expr: {
                                          Atom: "tuple",
                                        },
                                        id: 56,
                                        span: {
                                          start_line: 0,
                                          start_column: 0,
                                          end_line: 0,
                                          end_column: 0,
                                        },
                                      },
                                      {
                                        expr: {
                                          List: [
                                            {
                                              expr: {
                                                Atom: "mad-inner",
                                              },
                                              id: 58,
                                              span: {
                                                start_line: 17,
                                                start_column: 33,
                                                end_line: 17,
                                                end_column: 41,
                                              },
                                            },
                                            {
                                              expr: {
                                                TraitReference: [
                                                  "ft-trait",
                                                  {
                                                    Imported: {
                                                      name: "sip-010-trait",
                                                      contract_identifier: {
                                                        issuer: [
                                                          22,
                                                          [
                                                            9, 159, 184, 137,
                                                            38, 216, 47, 48,
                                                            178, 244, 14, 175,
                                                            62, 228, 35, 203,
                                                            114, 91, 219, 59,
                                                          ],
                                                        ],
                                                        name: "sip-010-trait-ft-standard",
                                                      },
                                                    },
                                                  },
                                                ],
                                              },
                                              id: 59,
                                              span: {
                                                start_line: 17,
                                                start_column: 44,
                                                end_line: 17,
                                                end_column: 53,
                                              },
                                            },
                                          ],
                                        },
                                        id: 57,
                                        span: {
                                          start_line: 17,
                                          start_column: 33,
                                          end_line: 17,
                                          end_column: 53,
                                        },
                                      },
                                    ],
                                  },
                                  id: 55,
                                  span: {
                                    start_line: 17,
                                    start_column: 31,
                                    end_line: 17,
                                    end_column: 55,
                                  },
                                },
                              ],
                            },
                            id: 52,
                            span: {
                              start_line: 17,
                              start_column: 23,
                              end_line: 17,
                              end_column: 56,
                            },
                          },
                        ],
                      },
                      id: 50,
                      span: {
                        start_line: 17,
                        start_column: 5,
                        end_line: 17,
                        end_column: 57,
                      },
                    },
                  ],
                },
                id: 48,
                span: {
                  start_line: 16,
                  start_column: 16,
                  end_line: 18,
                  end_column: 3,
                },
              },
              {
                expr: {
                  List: [
                    {
                      expr: {
                        Atom: "ok",
                      },
                      id: 61,
                      span: {
                        start_line: 19,
                        start_column: 4,
                        end_line: 19,
                        end_column: 5,
                      },
                    },
                    {
                      expr: {
                        Atom: "true",
                      },
                      id: 62,
                      span: {
                        start_line: 19,
                        start_column: 7,
                        end_line: 19,
                        end_column: 10,
                      },
                    },
                  ],
                },
                id: 60,
                span: {
                  start_line: 19,
                  start_column: 3,
                  end_line: 19,
                  end_column: 11,
                },
              },
            ],
          },
          id: 46,
          span: {
            start_line: 16,
            start_column: 1,
            end_line: 20,
            end_column: 1,
          },
        },
      ],
      top_level_expression_sorting: [0, 1, 2, 3, 4],
      referenced_traits: {},
      implemented_traits: [],
    },
  },
};
