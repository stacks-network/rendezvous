// Originally copied from hirosystems clarity-examples repository, further
// updated to match the idiomatic style of this project:
// https://github.com/hirosystems/clarity-examples/blob/ccd9ecf0bf136d7f28ef116706ed2936f6d8781a/examples/stx-defi/tests/stx-defi.test.ts

import { Cl } from "@stacks/transactions";
import { describe, expect, it } from "vitest";

const accounts = simnet.getAccounts();
const address1 = accounts.get("wallet_1")!;

describe("stx-defi tests", () => {
  it("deposit is called successfully", () => {
    // Arrange
    const amountToDeposit = 1000;

    // Act
    const { result } = simnet.callPublicFn(
      "stx-defi",
      "deposit",
      [Cl.uint(amountToDeposit)],
      address1
    );

    // Assert
    expect(result).toBeOk(Cl.bool(true));
  });

  it("deposit updates the total-deposits variable", () => {
    // Arrange
    const amountToDeposit = 1000;

    // Act
    simnet.callPublicFn(
      "stx-defi",
      "deposit",
      [Cl.uint(amountToDeposit)],
      address1
    );

    // Assert
    const totalDeposits1 = simnet.getDataVar("stx-defi", "total-deposits");
    expect(totalDeposits1).toBeUint(amountToDeposit);
  });

  it("second deposit updates the total-deposits variable", () => {
    // Arrange
    const amountToDeposit = 1000;

    simnet.callPublicFn(
      "stx-defi",
      "deposit",
      [Cl.uint(amountToDeposit)],
      address1
    );

    // Act
    simnet.callPublicFn(
      "stx-defi",
      "deposit",
      [Cl.uint(amountToDeposit)],
      address1
    );

    // Assert
    const totalDeposits = simnet.getDataVar("stx-defi", "total-deposits");
    expect(totalDeposits).toBeUint(2 * amountToDeposit);
  });

  it("owed amount is correct after borrowing half of the total deposits", () => {
    // Arrange
    const amountToDeposit = 1000;
    const amountToBorrow = amountToDeposit / 2;

    simnet.callPublicFn(
      "stx-defi",
      "deposit",
      [Cl.uint(amountToDeposit)],
      address1
    );

    // Act
    simnet.callPublicFn(
      "stx-defi",
      "borrow",
      [Cl.uint(amountToBorrow)],
      address1
    );

    // Assert
    const { result } = simnet.callReadOnlyFn(
      "stx-defi",
      "get-amount-owed",
      [],
      address1
    );

    expect(result).toBeOk(Cl.uint(amountToBorrow));
  });

  it("no owed amount after attempting to borrow more than half of the total deposits", () => {
    // Arrange
    const amountToDeposit = 1000;
    const amountToBorrow = amountToDeposit / 2 + 1;

    simnet.callPublicFn(
      "stx-defi",
      "deposit",
      [Cl.uint(amountToDeposit)],
      address1
    );

    // Act
    simnet.callPublicFn(
      "stx-defi",
      "borrow",
      [Cl.uint(amountToBorrow)],
      address1
    );

    // Assert
    const { result } = simnet.callReadOnlyFn(
      "stx-defi",
      "get-amount-owed",
      [],
      address1
    );

    expect(result).toBeOk(Cl.uint(0));
  });

  it("repayment clears the owed amount", () => {
    // Arrange
    const amountToDeposit = 1000;
    const amountToBorrow = amountToDeposit / 2;

    simnet.callPublicFn(
      "stx-defi",
      "deposit",
      [Cl.uint(amountToDeposit)],
      address1
    );

    simnet.callPublicFn(
      "stx-defi",
      "borrow",
      [Cl.uint(amountToBorrow)],
      address1
    );

    // Act
    simnet.callPublicFn(
      "stx-defi",
      "repay",
      [Cl.uint(amountToBorrow)],
      address1
    );

    // Assert
    const { result } = simnet.callReadOnlyFn(
      "stx-defi",
      "get-amount-owed",
      [],
      address1
    );
    expect(result).toBeOk(Cl.uint(0));
  });

  it("owes interest if repayment does not happen within the same burn block", () => {
    // Arrange
    const amountToDeposit = 1000;
    const amountToBorrow = amountToDeposit / 2;
    const blocksToPass = 5;
    const accruedInterest = 2;

    simnet.callPublicFn(
      "stx-defi",
      "deposit",
      [Cl.uint(amountToDeposit)],
      address1
    );

    // Act
    simnet.callPublicFn(
      "stx-defi",
      "borrow",
      [Cl.uint(amountToBorrow)],
      address1
    );

    simnet.mineEmptyBurnBlocks(blocksToPass);

    // Assert
    const { result: owedAmount } = simnet.callReadOnlyFn(
      "stx-defi",
      "get-amount-owed",
      [],
      address1
    );

    expect(owedAmount).toBeOk(Cl.uint(amountToBorrow + accruedInterest));
  });

  it("no yield to claim if no burn blocks pass", () => {
    // Arrange
    const amountToDeposit = 1000;
    const amountToBorrow = amountToDeposit / 2;
    const errNonPositiveAmount = 3;

    simnet.callPublicFn(
      "stx-defi",
      "deposit",
      [Cl.uint(amountToDeposit)],
      address1
    );

    simnet.callPublicFn(
      "stx-defi",
      "borrow",
      [Cl.uint(amountToBorrow)],
      address1
    );

    simnet.callPublicFn(
      "stx-defi",
      "repay",
      [Cl.uint(amountToBorrow)],
      address1
    );

    // Act
    const { result } = simnet.callPublicFn(
      "stx-defi",
      "claim-yield",
      [],
      address1
    );

    // Assert
    expect(result).toBeErr(Cl.uint(errNonPositiveAmount));
  });

  it("can claim yield after if repayment happens after a few burn blocks", () => {
    // Arrange
    const amountToDeposit = 1000;
    const amountToBorrow = amountToDeposit / 2;
    const blocksToPass = 5;

    simnet.callPublicFn(
      "stx-defi",
      "deposit",
      [Cl.uint(amountToDeposit)],
      address1
    );

    simnet.callPublicFn(
      "stx-defi",
      "borrow",
      [Cl.uint(amountToBorrow)],
      address1
    );

    simnet.mineEmptyBurnBlocks(blocksToPass);

    simnet.callPublicFn(
      "stx-defi",
      "repay",
      [Cl.uint(amountToBorrow)],
      address1
    );

    // Act
    const { result } = simnet.callPublicFn(
      "stx-defi",
      "claim-yield",
      [],
      address1
    );

    // Assert
    expect(result).toBeOk(Cl.bool(true));
  });
});
