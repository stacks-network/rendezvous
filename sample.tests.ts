import fc from "fast-check";
import { compareGenerators } from "./sample";
import { hexaString } from "./shared";

describe("Fast-check deprecated generators replacement validation", () => {
  const charSet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 !\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~";

  it("string-ascii Clarity type corresponding generator", () => {
    fc.assert(
      fc.property(
        fc.nat(),
        fc.integer({ min: 7, max: 20 }),
        (length, numSamples) => {
          const deprecatedGenerator = fc.stringOf(fc.constantFrom(...charSet), {
            maxLength: length,
            minLength: 0,
          });
          const replacementGenerator = fc.string({
            unit: fc.constantFrom(...charSet),
            maxLength: length,
          });

          const comparisonResults = compareGenerators(
            deprecatedGenerator,
            replacementGenerator,
            numSamples
          );

          const mismatchedPerSampleId = comparisonResults
            .filter((result) => result.mismatchedItems.length > 0)
            .reduce((acc, result) => {
              acc[result.sample] = result.mismatchedItems.map((item) => ({
                val1: item.val1,
                val2: item.val2,
              }));
              return acc;
            }, {} as Record<number, { val1: string; val2: string }[]>);

          expect(mismatchedPerSampleId).toEqual({});
        }
      )
    );
  });

  it("buff Clarity type corresponding generator", () => {
    fc.assert(
      fc.property(
        fc.nat(),
        fc.integer({ min: 7, max: 20 }),
        (length, numSamples) => {
          const deprecatedGenerator = fc.hexaString({ maxLength: 2 * length });

          const replacementGenerator = hexaString({
            maxLength: 2 * length,
          });

          const comparisonResults = compareGenerators(
            deprecatedGenerator,
            replacementGenerator,
            numSamples
          );

          const mismatchedPerSampleId = comparisonResults
            .filter((result) => result.mismatchedItems.length > 0)
            .reduce((acc, result) => {
              acc[result.sample] = result.mismatchedItems.map((item) => ({
                val1: item.val1,
                val2: item.val2,
              }));
              return acc;
            }, {} as Record<number, { val1: string; val2: string }[]>);

          expect(mismatchedPerSampleId).toEqual({});
        }
      )
    );
  });
});
