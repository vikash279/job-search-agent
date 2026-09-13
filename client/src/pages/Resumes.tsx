import { FormEvent, useEffect, useState } from "react";
import { client } from "../api";

export function ResumesPage() {
  const [resumes, setResumes] = useState<Array<Record<string, unknown>>>([]);
  const [message, setMessage] = useState("");

  async function reload() {
    const res = await client.resumes();
    setResumes(res.resumes);
  }

  useEffect(() => {
    reload();
  }, []);

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const file = (form.elements.namedItem("file") as HTMLInputElement).files?.[0];
    const name = String((form.elements.namedItem("name") as HTMLInputElement).value || "");
    if (!file) return;
    await client.uploadResume(file, name);
    setMessage("Resume stored. Parsing runs in the background.");
    await reload();
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Resume versions</h1>
          <p>Original files are kept. Parsing writes structured data onto a version, never over the file.</p>
        </div>
      </div>
      <form className="card form-grid" onSubmit={upload}>
        <label>Name<input name="name" placeholder="General software CV" /></label>
        <label>File<input name="file" type="file" accept=".pdf,.docx" required /></label>
        <div className="span-2"><button className="btn">Upload version</button></div>
      </form>
      {message && <p className="success">{message}</p>}
      <div className="grid cards" style={{ marginTop: 16 }}>
        {resumes.map((resume) => (
          <article className="card" key={String(resume.id)}>
            <h3>{String(resume.name)}</h3>
            <p className="muted">v{String(resume.version)} · {String(resume.fileType)}</p>
            {Boolean(resume.isDefault) && <span className="pill good">Default</span>}
            <div className="row" style={{ marginTop: 12 }}>
              {!resume.isDefault && (
                <button className="btn ghost" onClick={async () => {
                  await client.updateResume(String(resume.id), { isDefault: true });
                  await reload();
                }}>Make default</button>
              )}
              {!resume.isDefault && (
                <button className="btn danger" onClick={async () => {
                  await client.deleteResume(String(resume.id));
                  await reload();
                }}>Delete</button>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
