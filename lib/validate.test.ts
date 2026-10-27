import { describe, expect, it } from "vitest";
import { formatMobile, validateMobile, validateName } from "./validate";

describe("mobile numbers", () => {
  it("accepts real-looking Indian mobiles in any common format", () => {
    for (const v of ["9445012345", "+91 63851 20987", "07540050606", "917540050606", "8015 763 492", "9952390089"]) {
      expect(validateMobile(v), v).toMatchObject({ ok: true });
    }
    expect(validateMobile("+91 63851 20987")).toEqual({ ok: true, e164: "916385120987" });
  });

  it("rejects wrong formats", () => {
    for (const v of ["5876543210", "1234567890", "987654321", "98765432101", "abcdefghij", ""]) expect(validateMobile(v), v).toMatchObject({ ok: false, reason: "FORMAT" });
  });

  it("rejects obvious fakes", () => {
    const cases: [string, string][] = [
      ["9999999999", "SAME_DIGITS"],
      ["9000000000", "SAME_DIGITS"],
      ["9876543210", "PLACEHOLDER"],
      ["9123456789", "PLACEHOLDER"],
      ["9898989898", "PLACEHOLDER"],
      ["7676767676", "PATTERN"],
      ["9879879879", "PATTERN"],
      ["9876598765", "PLACEHOLDER"],
      ["9234567812", "SEQUENCE"],
      ["8765432109", "SEQUENCE"],
      ["9445094450", "PATTERN"],
    ];
    for (const [v, reason] of cases) expect(validateMobile(v), v).toMatchObject({ ok: false, reason });
  });

  it("formats into the +91 _____ _____ template", () => {
    expect(formatMobile("98765")).toBe("98765");
    expect(formatMobile("987654")).toBe("98765 4");
    expect(formatMobile("+91 9876543210 extra")).toBe("91987 65432");
  });
});

describe("names", () => {
  it("accepts English and Tamil names", () => {
    for (const v of ["Sriganan Ramesh", "ஸ்ரீகணன்", "K. Anand", "D'Souza", "Mary-Ann  Joseph", "முருகன் சுப்பிரமணியன்"]) {
      expect(validateName(v), v).toMatchObject({ ok: true });
    }
    expect(validateName("  Mary-Ann   Joseph ")).toEqual({ ok: true, clean: "Mary-Ann Joseph" });
  });

  it("rejects junk", () => {
    const cases: [string, string][] = [
      ["a", "SHORT"],
      ["", "SHORT"],
      ["123", "CHARS"],
      ["Ravi99", "CHARS"],
      ["😀😀", "CHARS"],
      ["aaaa", "FAKE"],
      ["http://x", "CHARS"],
      ["x@y.in", "CHARS"],
      ["A".repeat(61), "LONG"],
    ];
    for (const [v, reason] of cases) expect(validateName(v), v).toMatchObject({ ok: false, reason });
  });
});
