import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { client, type Application } from "../api";

export function TrackerPage() {
  const [apps, setApps] = useState<Application[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});

  async function reload() {
    const [list, summary] = await Promise.all([client.applications(), client.tracking()]);
    setApps(list.applications);
    setCounts(summary.counts);
  }

  useEffect(() => {
    reload();
  }, []);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Application tracker</h1>
          <p>Every status change is stored as an event. Confirm submission after you finish on the employer site.</p>
        </div>
      </div>
      <div className="row" style={{ marginBottom: 16 }}>
        {Object.entries(counts).map(([status, count]) => (
          <span className="pill" key={status}>{status}: {count}</span>
        ))}
      </div>
      <table className="card">
        <thead>
          <tr>
            <th>Role</th>
            <th>Company</th>
            <th>Status</th>
            <th>Score</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {apps.map((item) => (
            <tr key={item.id}>
              <td><Link to={`/applications/${item.id}`}>{item.job?.title}</Link></td>
              <td>{item.job?.company}</td>
              <td>{item.status}</td>
              <td>{item.matchScore ?? "—"}</td>
              <td className="row">
                {["REQUIRES_USER_ACTION", "READY_FOR_SUBMISSION"].includes(item.status) && (
                  <button className="btn" onClick={async () => {
                    await client.confirmSubmit(item.id, item.applicationUrl);
                    await reload();
                  }}>I submitted it</button>
                )}
                {item.status === "APPROVED" && (
                  <button className="btn ghost" onClick={async () => {
                    await client.start(item.id);
                    await reload();
                  }}>Start assisted apply</button>
                )}
                {item.status === "FAILED" && (
                  <button className="btn ghost" onClick={async () => {
                    await client.retryApply(item.id);
                    await reload();
                  }}>Retry</button>
                )}
                {!["SUBMITTED", "REJECTED", "WITHDRAWN"].includes(item.status) && (
                  <button className="btn ghost" onClick={async () => {
                    await client.cancel(item.id);
                    await reload();
                  }}>Withdraw</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
