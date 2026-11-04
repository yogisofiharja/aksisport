import { describe, expect, it } from "vitest";
import { createCrashThrottle, describeError } from "./crashFilter";

describe("describeError", () => {
  it("reads errors, strings and other values", () => {
    const err = new TypeError("x is undefined");
    expect(describeError(err)).toEqual({
      message: "x is undefined",
      stack: err.stack,
    });
    expect(describeError("boom")).toEqual({ message: "boom", stack: "" });
    expect(describeError({ code: 7 })).toEqual({
      message: '{"code":7}',
      stack: "",
    });
    expect(describeError(undefined).message).toBe("undefined");
  });
});

describe("createCrashThrottle", () => {
  it("sends a message once a minute", () => {
    const allow = createCrashThrottle();
    expect(allow("boom\nat A", 0)).toBe(true);
    expect(allow("boom\nat B", 1000)).toBe(false); // same first line
    expect(allow("other", 1000)).toBe(true);
    expect(allow("boom", 61_000)).toBe(true);
  });

  it("caps one run", () => {
    const allow = createCrashThrottle(2);
    expect(allow("a", 0)).toBe(true);
    expect(allow("b", 0)).toBe(true);
    expect(allow("c", 0)).toBe(false);
  });
});
