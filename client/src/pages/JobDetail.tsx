import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { client, type JobDetail } from "../api";

export function JobDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [resumes, setResumes] = useState<Array<Record<string, unknown>>>([]);
  const [resumeVersionId, setResumeVersionId] = useState("");
  const [error, setError] = useState("");

  async function reload() {
    if (!id) return;
    const [jobRes, resumeRes] = await Promise.all([client.job(id), client.resumes()]);
    setJob(jobRes.job);
    setResumes(resumeRes.resumes);
    if (!resumeVersionId) {
      const selected = resumeRes.resumes.find((item) => item.isDefault) ?? resumeRes.resumes[0];
      if (selected?.id) setResumeVersionId(String(selected.id));
    }
  }

  useEffect(() => {
    reload();
  }, [id]);

  if (!job) return <p>Loading…</p>;
  const match = job.match;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>{job.title}</h1>
          <p>{job.company} · {job.location} · {job.workMode} · {job.source}</p>
        </div>
        <div className="row">
          <button className="btn ghost" onClick={async () => {
            job.saved ? await client.unsaveJob(job.id) : await client.saveJob(job.id);
            await reload();
          }}>{job.saved ? "Unsave" : "Save"}</button>
          <button className="btn" onClick={async () => {
            const matchRes = await client.matchJob(job.id);
            setJob({ ...job, match: matchRes.match });
          }}>Score match</button>
          <button className="btn gold" onClick={async () => {
            try {
              const prepared = await client.prepare(job.id, resumeVersionId || undefined);
              navigate(`/applications/${prepared.application.id}`);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not prepare");
            }
          }}>Prepare application</button>
        </div>
      </div>
      {error && <p className="notice">{error}</p>}
      <div className="split">
        <article className="card">
          <h3>Job description</h3>
          <div className="desc">{job.description}</div>
        </article>
        <article className="card">
          <label>
            Resume to use
            <select value={resumeVersionId} onChange={(e) => setResumeVersionId(e.target.value)}>
              <option value="">Profile facts only</option>
              {resumes.map((resume) => (
                <option key={String(resume.id)} value={String(resume.id)}>
                  {String(resume.name)}{resume.isDefault ? " (default)" : ""}
                </option>
              ))}
            </select>
          </label>
          <p className="muted">Harbor picks the closest version if you leave this on default. The original file is never overwritten.</p>
          {match ? (
            <>
              <div className="row"><div className="score">{match.score}</div><strong>{match.recommendation}</strong></div>
              <p>{match.explanation}</p>
              <p><strong>Matched:</strong> {match.matchedSkills.join(", ") || "none"}</p>
              <p><strong>Missing:</strong> {match.missingSkills.join(", ") || "none"}</p>
              <p><strong>Concerns:</strong> {match.concerns.join("; ") || "none"}</p>
            </>
          ) : <p className="muted">No score yet.</p>}
          {job.application && <p>Existing application: <Link to={`/applications/${job.application.id}`}>{job.application.status}</Link></p>}
        </article>
      </div>
    </div>
  );
}
