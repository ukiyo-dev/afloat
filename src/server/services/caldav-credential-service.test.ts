import { describe, expect, it } from "vitest";

import { validateCalDavCredentialInput } from "@/server/services/caldav-credential-service";

describe("CalDAV credential validation", () => {
  it("accepts http and https credential inputs", () => {
    expect(() =>
      validateCalDavCredentialInput({
        serverUrl: "https://caldav.example.com",
        username: "user",
        password: "app-token"
      })
    ).not.toThrow();
  });

  it("rejects invalid URLs and blank fields", () => {
    expect(() =>
      validateCalDavCredentialInput({ serverUrl: "ftp://example.com", username: "user" })
    ).toThrow("http or https");
    expect(() =>
      validateCalDavCredentialInput({ serverUrl: "https://example.com", username: " " })
    ).toThrow("username");
    expect(() =>
      validateCalDavCredentialInput({
        serverUrl: "https://example.com",
        username: "user",
        password: " "
      })
    ).toThrow("password");
  });
});
