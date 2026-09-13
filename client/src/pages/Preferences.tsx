import { FormEvent, useEffect, useState } from "react";
import { client } from "../api";

const csv = (value: unknown) => (Array.isArray(value) ? value.join(", ") : "");

export function PreferencesPage() {
  const [pref, setPref] = useState<Record<string, unknown> | null>(null);
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    client.preferences().then((res) => setPref(res.preferences));
  }, []);

  if (!pref) return <p>Loading preferences…</p>;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const split = (key: string) => String(form.get(key)).split(",").map((s) => s.trim()).filter(Boolean);
    const res = await client.savePreferences({
      targetRoles: split("targetRoles"),
      preferredLocations: split("preferredLocations"),
      preferredTech: split("preferredTech"),
      workModes: split("workModes") as Array<"remote" | "hybrid" | "onsite">,
      searchKeywords: split("searchKeywords"),
      excludedCompanies: split("excludedCompanies"),
      excludedKeywords: split("excludedKeywords"),
      salaryMin: Number(form.get("salaryMin") || 0) || null,
      salaryMax: Number(form.get("salaryMax") || 0) || null,
      noticePeriodDays: Number(form.get("noticePeriodDays") || 0) || null,
      minimumMatchScore: Number(form.get("minimumMatchScore") || 50),
      autoSearchEnabled: form.get("autoSearchEnabled") === "on",
    });
    setPref(res.preferences);
    setPreview((await client.searchPreview()).preview);
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Job preferences</h1>
          <p>These filters run before AI scoring. Excluded companies and keywords never reach the match list.</p>
        </div>
      </div>
      <form className="card form-grid" onSubmit={save}>
        <label>Target roles<input name="targetRoles" defaultValue={csv(pref.targetRoles)} /></label>
        <label>Technologies<input name="preferredTech" defaultValue={csv(pref.preferredTech)} /></label>
        <label>Locations<input name="preferredLocations" defaultValue={csv(pref.preferredLocations)} /></label>
        <label>Work modes<input name="workModes" defaultValue={csv(pref.workModes) || "remote, hybrid"} /></label>
        <label>Search keywords<input name="searchKeywords" defaultValue={csv(pref.searchKeywords)} /></label>
        <label>Excluded companies<input name="excludedCompanies" defaultValue={csv(pref.excludedCompanies)} /></label>
        <label>Excluded keywords<input name="excludedKeywords" defaultValue={csv(pref.excludedKeywords)} /></label>
        <label>Minimum match score<input name="minimumMatchScore" type="number" defaultValue={String(pref.minimumMatchScore ?? 50)} /></label>
        <label>Salary min<input name="salaryMin" type="number" defaultValue={String(pref.salaryMin ?? "")} /></label>
        <label>Salary max<input name="salaryMax" type="number" defaultValue={String(pref.salaryMax ?? "")} /></label>
        <label>Notice period<input name="noticePeriodDays" type="number" defaultValue={String(pref.noticePeriodDays ?? "")} /></label>
        <label className="row">Enable scheduled search<input name="autoSearchEnabled" type="checkbox" defaultChecked={Boolean(pref.autoSearchEnabled)} /></label>
        <div className="span-2"><button className="btn">Save preferences</button></div>
      </form>
      {preview && (
        <article className="card" style={{ marginTop: 16 }}>
          <h3>Search preview</h3>
          <p>{JSON.stringify(preview, null, 2)}</p>
        </article>
      )}
    </div>
  );
}
