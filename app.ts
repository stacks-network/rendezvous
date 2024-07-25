type Operator = "+" | "-" | "*" | "/";

export default function calculator(operator: Operator, inputs: number[]) {
  if (inputs.length < 2) {
    throw new Error(`inputs should have length >= 2`);
  }

  switch (operator) {
    case "+":
      return inputs.reduce((prev, curr) => prev + curr);
    case "-":
      return inputs.reduce((prev, curr) => prev - curr);
    case "*":
      return inputs.reduce((prev, curr) => prev * curr);
    case "/":
      return inputs.reduce((prev, curr) => prev / curr);
    default:
      throw new Error(`Unknown operator ${operator}`);
  }
}
