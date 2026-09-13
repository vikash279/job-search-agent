import { useEffect, useState } from "react";
import { client, type JobCard as Job } from "../api";
import { JobCard } from "../components/JobCard";

export function MatchesPage() {
  const [jobs, setJobs] = useState<Job[]>([]);

  useEffect(() => {
    client.jobs("?minScore=1").then((res) => {
      setJobs([...res.items].sort((a, b) => (b.match?.score ?? 0) - (a.match?.score ?? 0)));
    });
  }, []);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Ranked matches</h1>
          <p>Deterministic filters run first. Scores are stored with model and prompt versions.</p>
        </div>
      </div>
      <div className="grid">{jobs.map((job) => <JobCard key={job.id} job={job} />)}</div>
    </div>
  );
}
