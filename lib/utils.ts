export function cn(...inputs: any[]) {
  return inputs
    .flatMap((input) => {
      if (Array.isArray(input)) {
        return input;
      }

      return [input];
    })
    .filter((value) => typeof value === "string" && value.trim().length > 0)
    .join(" ");
}
