import { ContractInterfaceFunction } from "@hirosystems/clarinet-sdk-wasm";
import { initSimnet } from "@hirosystems/clarinet-sdk";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  buildTraitReferenceMap,
  enrichInterfaceWithTraitData,
  getContractIdsImplementingTrait,
  isTraitReferenceFunction,
} from "./traits";

describe("Trait reference processing", () => {
  it("correctly builds the trait reference map for a direct trait that is the first parameter", () => {
    // Arrange
    const allFunctionsInterfaces = JSON.parse(
      readFileSync("./fixtures/direct-trait-functions-interfaces.json", "utf-8")
    );

    const expectedTraitReferenceMap = new Map(
      Object.entries({
        "test-trait": { token: "trait_reference" },
      })
    );

    // Act
    const traitReferenceMap = buildTraitReferenceMap(allFunctionsInterfaces);

    // Assert
    expect(traitReferenceMap).toEqual(expectedTraitReferenceMap);
  });

  it("correctly builds the trait reference map for a direct trait that is the second parameter", () => {
    // Arrange
    const allFunctionsInterfaces = JSON.parse(
      readFileSync(
        "./fixtures/direct-trait-2nd-parameter-functions-interfaces.json",
        "utf-8"
      )
    );

    const expectedTraitReferenceMap = new Map(
      Object.entries({
        "test-trait": { token: "trait_reference" },
      })
    );

    // Act
    const traitReferenceMap = buildTraitReferenceMap(allFunctionsInterfaces);

    // Assert
    expect(traitReferenceMap).toEqual(expectedTraitReferenceMap);
  });

  it("correctly builds the trait reference map for a direct trait that is the fifth parameter", () => {
    // Arrange
    const allFunctionsInterfaces = JSON.parse(
      readFileSync(
        "./fixtures/direct-trait-5th-parameter-functions-interfaces.json",
        "utf-8"
      )
    );

    const expectedTraitReferenceMap = new Map(
      Object.entries({
        "test-trait": { e: "trait_reference" },
      })
    );

    // Act
    const traitReferenceMap = buildTraitReferenceMap(allFunctionsInterfaces);

    // Assert
    expect(traitReferenceMap).toEqual(expectedTraitReferenceMap);
  });

  it("correctly builds the trait reference map for a tuple nested trait that is the first parameter", () => {
    // Arrange
    const allFunctionsInterfaces = JSON.parse(
      readFileSync(
        "./fixtures/tuple-trait-1st-parameter-functions-interfaces.json",
        "utf-8"
      )
    );

    const expectedTraitReferenceMap = new Map(
      Object.entries({
        "test-trait": {
          "tuple-param": { tuple: { token: "trait_reference" } },
        },
      })
    );

    // Act
    const traitReferenceMap = buildTraitReferenceMap(allFunctionsInterfaces);

    // Assert
    expect(traitReferenceMap).toEqual(expectedTraitReferenceMap);
  });

  it("correctly enriches interface with trait reference data for a direct trait that is the first parameter", () => {
    // Arrange
    const targetContractId = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.trait";

    const allFunctionsInterfaces = JSON.parse(
      readFileSync("./fixtures/direct-trait-functions-interfaces.json", "utf-8")
    ).filter((f: any) => f.name !== "update-context");

    const traitReferenceMap = buildTraitReferenceMap(allFunctionsInterfaces);

    const ast = JSON.parse(
      readFileSync("./fixtures/direct-trait-ast.json", "utf-8")
    );

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
    const enrichedTestFunctionsInterfacesMap = enrichInterfaceWithTraitData(
      ast,
      traitReferenceMap,
      allFunctionsInterfaces,
      targetContractId
    );

    // Assert
    expect(enrichedTestFunctionsInterfacesMap).toEqual(expected);
  });

  it("correctly enriches interface with trait reference data for a direct trait that is the second parameter", () => {
    // Arrange
    const targetContractId = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.trait";

    const allFunctionsInterfaces = JSON.parse(
      readFileSync(
        "./fixtures/direct-trait-2nd-parameter-functions-interfaces.json",
        "utf-8"
      )
    ).filter((f: any) => f.name !== "update-context");

    const traitReferenceMap = buildTraitReferenceMap(allFunctionsInterfaces);

    const ast = JSON.parse(
      readFileSync("./fixtures/direct-trait-2nd-parameter-ast.json", "utf-8")
    );

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
    const enrichedTestFunctionsInterfacesMap = enrichInterfaceWithTraitData(
      ast,
      traitReferenceMap,
      allFunctionsInterfaces,
      targetContractId
    );

    // Assert
    expect(enrichedTestFunctionsInterfacesMap).toEqual(expected);
  });

  it("correctly enriches interface with trait reference data for a direct trait that is the fifth parameter", () => {
    // Arrange
    const targetContractId = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.trait";

    const allFunctionsInterfaces = JSON.parse(
      readFileSync(
        "./fixtures/direct-trait-5th-parameter-functions-interfaces.json",
        "utf-8"
      )
    ).filter((f: any) => f.name !== "update-context");

    const traitReferenceMap = buildTraitReferenceMap(allFunctionsInterfaces);

    const ast = JSON.parse(
      readFileSync("./fixtures/direct-trait-5th-parameter-ast.json", "utf-8")
    );

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
    const enrichedTestFunctionsInterfacesMap = enrichInterfaceWithTraitData(
      ast,
      traitReferenceMap,
      allFunctionsInterfaces,
      targetContractId
    );

    // Assert
    expect(enrichedTestFunctionsInterfacesMap).toEqual(expected);
  });

  it("correctly enriches interface with trait reference data for a tuple nested trait that is the first parameter", () => {
    // Arrange
    const targetContractId = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.trait";

    const allFunctionsInterfaces = JSON.parse(
      readFileSync(
        "./fixtures/tuple-trait-1st-parameter-functions-interfaces.json",
        "utf-8"
      )
    ).filter((f: any) => f.name !== "update-context");

    const traitReferenceMap = buildTraitReferenceMap(allFunctionsInterfaces);

    const ast = JSON.parse(
      readFileSync("./fixtures/tuple-trait-1st-parameter-ast.json", "utf-8")
    );

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
    const enrichedTestFunctionsInterfacesMap = enrichInterfaceWithTraitData(
      ast,
      traitReferenceMap,
      allFunctionsInterfaces,
      targetContractId
    );

    // Assert
    expect(enrichedTestFunctionsInterfacesMap).toEqual(expected);
  });

  it("correctly retrieves the contracts implementing a trait from the Clarinet project", async () => {
    // Arrange
    const simnet = await initSimnet(
      resolve(__dirname, "example", "Clarinet.toml")
    );

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

    const expected = ["SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG.ststx-token"];

    // Act
    const traitImplementations = getContractIdsImplementingTrait(
      traitData,
      simnet
    );

    // Assert
    expect(traitImplementations).toEqual(expected);
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
    const result = isTraitReferenceFunction(noTraitFunction);

    // Assert
    expect(result).toBe(false);
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
    const result = isTraitReferenceFunction(traitFunction);

    // Assert
    expect(result).toBe(true);
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
    const result = isTraitReferenceFunction(listFunction);

    // Assert
    expect(result).toBe(false);
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
    const result = isTraitReferenceFunction(listWithTraitFunction);

    // Assert
    expect(result).toBe(true);
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
    const result = isTraitReferenceFunction(tupleFunction);

    // Assert
    expect(result).toBe(false);
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
    const result = isTraitReferenceFunction(tupleWithTraitFunction);

    // Assert
    expect(result).toBe(true);
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
    const result = isTraitReferenceFunction(optionalFunction);

    // Assert
    expect(result).toBe(false);
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
    const result = isTraitReferenceFunction(optionalWithTraitFunction);

    // Assert
    expect(result).toBe(true);
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
    const result = isTraitReferenceFunction(responseFunction);

    // Assert
    expect(result).toBe(false);
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
    const result = isTraitReferenceFunction(responseWithTraitFunction);

    // Assert
    expect(result).toBe(true);
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
    const result = isTraitReferenceFunction(unexpectedTypeFunction);

    // Assert
    expect(result).toBe(false);
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
    const result = isTraitReferenceFunction(unrecognizedTypeFunction);

    // Assert
    expect(result).toBe(false);
  });
});
