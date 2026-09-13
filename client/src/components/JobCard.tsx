import { Link } from "react-router-dom";
import type { JobCard as Job } from "../api";

function salary(job: Job) {
  if (!job.salaryMin && !job.salaryMax) return "Salary unknown";
  const currency = job.salaryCurrency || "";
  return `${currency} ${job.salaryMin ?? "?"}–${job.salaryMax ?? "?"}`.trim();
}

export function JobCard({ job }: { job: Job }) {
  const match = job.match;
  return (
    <article className="card job-card">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <h3><Link to={`/jobs/${job.id}`}>{job.title}</Link></h3>
          <div className="meta">
            <span>{job.company}</span>
            <span>{job.location || "Location unknown"}</span>
            <span className="pill">{job.workMode || "mode unknown"}</span>
            <span>{salary(job)}</span>
            <span className="pill">{job.source || "source"}</span>
            {job.postedAt && <span>{new Date(job.postedAt).toLocaleDateString()}</span>}
          </div>
        </div>
        {match && <div className="score">{match.score}</div>}
      </div>
      {match && (
        <>
          <div className="row">
            {match.matchedSkills.slice(0, 5).map((skill) => <span className="pill good" key={skill}>{skill}</span>)}
            {match.missingSkills.slice(0, 4).map((skill) => <span className="pill warn" key={skill}>{skill}</span>)}
          </div>
          {match.concerns[0] && <p className="muted">{match.concerns[0]}</p>}
        </>
      )}
      {job.applicationStatus && <p className="muted">Application: {job.applicationStatus}</p>}
    </article>
  );
}
