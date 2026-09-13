import { FormEvent, useEffect, useState } from "react";
import { client } from "../api";

function csv(value: unknown): string {
  return Array.isArray(value) ? value.join(", ") : "";
}

export function ProfilePage() {
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    client.profile().then((res) => setProfile(res.profile));
  }, []);

  if (!profile) return <p>Loading profile…</p>;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = {
      headline: String(form.get("headline")),
      summary: String(form.get("summary")),
      currentTitle: String(form.get("currentTitle")),
      currentCompany: String(form.get("currentCompany")),
      yearsExperience: Number(form.get("yearsExperience") || 0) || null,
      skills: String(form.get("skills")).split(",").map((s) => s.trim()).filter(Boolean),
      preferredRoles: String(form.get("preferredRoles")).split(",").map((s) => s.trim()).filter(Boolean),
      preferredLocations: String(form.get("preferredLocations")).split(",").map((s) => s.trim()).filter(Boolean),
      preferredWorkModes: String(form.get("preferredWorkModes")).split(",").map((s) => s.trim()).filter(Boolean),
      noticePeriodDays: Number(form.get("noticePeriodDays") || 0) || null,
      expectedSalaryMin: Number(form.get("expectedSalaryMin") || 0) || null,
      expectedSalaryMax: Number(form.get("expectedSalaryMax") || 0) || null,
    };
    const res = await client.updateProfile(body);
    setProfile(res.profile);
    setMessage("Profile saved. Edited fields are marked verified.");
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = (event.currentTarget.elements.namedItem("file") as HTMLInputElement).files?.[0];
    if (!file) return;
    const res = await client.parseResume(file);
    setProfile(res.profile);
    setMessage("CV parsed. Review the extracted fields before treating them as verified.");
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Candidate profile</h1>
          <p>Harbor only uses facts you confirm. Parsing never overwrites a field you already edited.</p>
        </div>
      </div>
      <form className="card" onSubmit={upload}>
        <label>
          Upload CV (PDF or DOCX)
          <input name="file" type="file" accept=".pdf,.docx" required />
        </label>
        <button className="btn gold">Parse resume</button>
      </form>
      <form className="card form-grid" style={{ marginTop: 16 }} onSubmit={save}>
        <label>Headline<input name="headline" defaultValue={String(profile.headline ?? "")} key={`h-${profile.updatedAt}`} /></label>
        <label>Current title<input name="currentTitle" defaultValue={String(profile.currentTitle ?? "")} /></label>
        <label>Current company<input name="currentCompany" defaultValue={String(profile.currentCompany ?? "")} /></label>
        <label>Years experience<input name="yearsExperience" type="number" defaultValue={String(profile.yearsExperience ?? "")} /></label>
        <label className="span-2">Summary<textarea name="summary" defaultValue={String(profile.summary ?? "")} /></label>
        <label className="span-2">Skills<input name="skills" defaultValue={csv(profile.skills)} /></label>
        <label>Preferred roles<input name="preferredRoles" defaultValue={csv(profile.preferredRoles)} /></label>
        <label>Preferred locations<input name="preferredLocations" defaultValue={csv(profile.preferredLocations)} /></label>
        <label>Work modes<input name="preferredWorkModes" defaultValue={csv(profile.preferredWorkModes)} /></label>
        <label>Notice period (days)<input name="noticePeriodDays" type="number" defaultValue={String(profile.noticePeriodDays ?? "")} /></label>
        <label>Salary min<input name="expectedSalaryMin" type="number" defaultValue={String(profile.expectedSalaryMin ?? "")} /></label>
        <label>Salary max<input name="expectedSalaryMax" type="number" defaultValue={String(profile.expectedSalaryMax ?? "")} /></label>
        <div className="span-2 row">
          <button className="btn">Save profile</button>
          {message && <span className="success">{message}</span>}
        </div>
      </form>
    </div>
  );
}
