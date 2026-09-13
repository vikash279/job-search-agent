import { FormEvent, useEffect, useState } from "react";
import { client, type JobCard as Job } from "../api";
import { JobCard } from "../components/JobCard";

export function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");

  async function load(q = "") {
    const res = await client.jobs(q ? `?q=${encodeURIComponent(q)}` : "");
    setJobs(res.items);
  }

  useEffect(() => {
    load();
  }, []);

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const keywords = String(form.get("keywords")).split(",").map((s) => s.trim()).filter(Boolean);
    setMessage("Searching permitted sources…");
    const result = await client.searchJobs({
      keywords,
      remoteOnly: form.get("remoteOnly") === "on",
      source: String(form.get("source") || ""),
    });
    setMessage(`Ingested ${result.count} jobs. Scoring in the background.`);
    await client.bulkMatch();
    await load(query);
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Job search</h1>
          <p>Discovery uses public APIs and local fixtures. Portal scraping is not used.</p>
        </div>
      </div>
      <form className="card form-grid" onSubmit={search}>
        <label>Keywords<input name="keywords" placeholder="typescript, react" /></label>
        <label>Source
          <select name="source">
            <option value="">All enabled</option>
            <option value="fixture">Local fixtures</option>
            <option value="remotive">Remotive public API</option>
          </select>
        </label>
        <label className="row">Remote only<input name="remoteOnly" type="checkbox" /></label>
        <div className="span-2 row">
          <button className="btn">Search and ingest</button>
          {message && <span className="muted">{message}</span>}
        </div>
      </form>
      <form className="row" style={{ margin: "18px 0" }} onSubmit={(e) => { e.preventDefault(); load(query); }}>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter stored jobs" />
        <button className="btn ghost">Filter</button>
      </form>
      <div className="grid">{jobs.map((job) => <JobCard key={job.id} job={job} />)}</div>
    </div>
  );
}
