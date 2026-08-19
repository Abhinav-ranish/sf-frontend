import {
  addressLine,
  avatarHue,
  formatTimestamp,
  initials,
  jobLine,
} from "@/lib/contacts/format";
import { makeContact } from "../../mocks/handlers";

describe("initials", () => {
  it("takes the first letter of each name", () => {
    expect(initials({ first_name: "ada", last_name: "lovelace" })).toBe("AL");
  });
});

describe("avatarHue", () => {
  it("is stable for the same seed and within the hue range", () => {
    expect(avatarHue("ada@example.com")).toBe(avatarHue("ada@example.com"));
    expect(avatarHue("ada@example.com")).toBeGreaterThanOrEqual(0);
    expect(avatarHue("ada@example.com")).toBeLessThan(360);
  });

  it("separates different seeds", () => {
    expect(avatarHue("ada@example.com")).not.toBe(avatarHue("grace@example.com"));
  });
});

describe("formatTimestamp", () => {
  it("renders UTC regardless of the machine's zone", () => {
    expect(formatTimestamp("2026-08-19T17:04:53.743932Z")).toBe(
      "19 Aug 2026, 17:04 UTC",
    );
  });

  it("degrades to a dash on garbage input", () => {
    expect(formatTimestamp("not a date")).toBe("—");
  });
});

describe("jobLine", () => {
  it("joins the title and the company", () => {
    expect(jobLine(makeContact())).toBe("Mathematician at Analytical Engines");
  });

  it("falls back to whichever one is set", () => {
    expect(jobLine(makeContact({ company: null }))).toBe("Mathematician");
    expect(jobLine(makeContact({ job_title: null }))).toBe("Analytical Engines");
    expect(jobLine(makeContact({ job_title: null, company: null }))).toBeNull();
  });
});

describe("addressLine", () => {
  it("skips the parts that are not filled in", () => {
    expect(addressLine(makeContact())).toBe("San Francisco, CA, USA");
  });

  it("pairs the state with the postal code", () => {
    expect(
      addressLine(makeContact({ address: "1 Market St", postal_code: "94105" })),
    ).toBe("1 Market St, San Francisco, CA 94105, USA");
  });

  it("returns null when there is no address at all", () => {
    expect(
      addressLine(
        makeContact({ city: null, state: null, country: null, postal_code: null }),
      ),
    ).toBeNull();
  });
});
