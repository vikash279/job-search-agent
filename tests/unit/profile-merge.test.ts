import { beforeEach, describe, expect, it } from "vitest";
import { applyParsedProfile, getOrCreateProfile, serializeProfile, updateProfile } from "../../src/modules/candidate-profile/service.js";
import { createUser, resetDb } from "../helpers.js";

describe("profile merge", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("does not overwrite user-edited fields when a CV is re-parsed", async () => {
    const { user } = await createUser();
    await updateProfile(user.id, {
      headline: "Manually verified headline",
      skills: ["TypeScript"],
    });
    await applyParsedProfile(user.id, {
      headline: "Parsed headline that should lose",
      skills: ["Python", "Java"],
      experience: [],
      education: [],
      achievements: [],
      certifications: [],
      projects: [],
      preferredRoles: [],
      preferredLocations: [],
      preferredWorkModes: [],
    });
    const profile = serializeProfile(await getOrCreateProfile(user.id));
    expect(profile.headline).toBe("Manually verified headline");
    expect(profile.skills).toEqual(["TypeScript"]);
  });
});
