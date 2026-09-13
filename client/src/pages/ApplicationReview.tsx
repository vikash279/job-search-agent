import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { client, type Application } from "../api";

export function ApplicationReviewPage() {
  const { id } = useParams();
  const [app, setApp] = useState<Application | null>(null);
  const [resumes, setResumes] = useState<Array<Record<string, unknown>>>([]);
  const [resumeVersionId, setResumeVersionId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function reload() {
    if (!id) return;
    const [applicationRes, resumeRes] = await Promise.all([client.application(id), client.resumes()]);
    setApp(applicationRes.application);
    setResumes(resumeRes.resumes);
    setResumeVersionId(applicationRes.application.resume?.id ?? "");
  }

  useEffect(() => {
    reload();
  }, [id]);

  if (!app) return <p>Loading…</p>;

  const reviewFields = (app.answers ?? [])
    .filter((answer) => !answer.answer.trim())
    .map((answer) => ({ fieldKey: answer.fieldKey, question: answer.question }));
  const canApprove = app.status === "PENDING_APPROVAL" && reviewFields.length === 0;

  async function saveEdits() {
    if (!app) return;
    await client.updateApplication(app.id, {
      coverLetter: app.coverLetter,
      tailoredResume: app.tailoredResume,
      answers: app.answers?.map((answer) => ({
        fieldKey: answer.fieldKey,
        question: answer.question,
        answer: answer.answer,
        source: "user_input",
        requiresReview: !answer.answer.trim(),
        confidence: answer.answer.trim() ? 1 : 0.2,
      })),
    });
    setMessage("Edits saved. Empty answers still require your review.");
    await reload();
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Application review</h1>
          <p>
            {app.review?.originalJobTitle || app.job?.title} at {app.review?.originalCompany || app.job?.company} · {app.status}
          </p>
        </div>
        <div className="row">
          <button className="btn ghost" onClick={saveEdits}>Save edits</button>
          <button
            className="btn"
            disabled={!canApprove}
            onClick={async () => {
              try {
                await saveEdits();
                await client.approve(app.id);
                await reload();
                setMessage("Approved. Nothing was submitted to the employer.");
              } catch (err) {
                setError(err instanceof Error ? err.message : "Approve failed");
              }
            }}
          >
            Approve
          </button>
          <button className="btn danger" onClick={async () => { await client.reject(app.id); await reload(); }}>Reject</button>
          {app.status === "APPROVED" && (
            <button
              className="btn gold"
              onClick={async () => {
                try {
                  const started = await client.start(app.id);
                  await reload();
                  setMessage(started.execution.message);
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Could not start assisted apply");
                }
              }}
            >
              Start assisted apply
            </button>
          )}
          {app.status === "FAILED" && (
            <button
              className="btn"
              onClick={async () => {
                try {
                  const retried = await client.retryApply(app.id);
                  await reload();
                  setMessage(retried.execution.message);
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Retry failed");
                }
              }}
            >
              Retry assisted apply
            </button>
          )}
        </div>
      </div>
      {error && <p className="notice">{error}</p>}
      {message && <p className="success">{message}</p>}
      {!canApprove && app.status === "PENDING_APPROVAL" && (
        <p className="notice">Fill every field marked for review before approval. Harbor will not guess sponsorship, authorization, salary, or relocation.</p>
      )}

      {app.execution && ["REQUIRES_USER_ACTION", "READY_FOR_SUBMISSION", "FAILED", "IN_PROGRESS"].includes(app.status) && (
        <article className="card" style={{ marginBottom: 16 }}>
          <h3>Assisted apply</h3>
          <p>{app.execution.message}</p>
          <p className="muted">
            Adapter: {app.execution.adapter ?? "assisted"} · Tested against a real portal: {app.execution.testedAgainstPortal ? "yes" : "no"}
          </p>
          {app.applicationUrl && (
            <p><a href={app.applicationUrl} target="_blank" rel="noreferrer">Open employer application URL</a></p>
          )}
          {(app.execution.checkpoints ?? []).length > 0 && (
            <ul>
              {app.execution.checkpoints!.map((item) => (
                <li key={`${item.reason}-${item.fieldKey ?? ""}`}>{item.message}</li>
              ))}
            </ul>
          )}
          {(app.execution.mappedFields ?? []).length > 0 && (
            <p className="muted">
              Verified fields mapped: {app.execution.mappedFields!.filter((field) => field.filled).map((field) => field.label).join(", ") || "none"}.
              Harbor does not store passwords, OTPs, cookies, or tokens.
            </p>
          )}
          {app.status === "REQUIRES_USER_ACTION" && (
            <div className="row">
              <button
                className="btn ghost"
                onClick={async () => {
                  const checkpoints = (app.execution?.checkpoints ?? [])
                    .map((item) => item.reason)
                    .filter((reason) => ["captcha", "otp", "mfa", "login", "anti_bot"].includes(reason));
                  const continued = await client.continueApply(app.id, checkpoints);
                  await reload();
                  setMessage(continued.execution.message);
                }}
              >
                I completed the human steps
              </button>
              <button
                className="btn"
                onClick={async () => {
                  await client.confirmSubmit(app.id, app.applicationUrl);
                  await reload();
                  setMessage("Recorded as submitted by you. Harbor did not send the application.");
                }}
              >
                I submitted it myself
              </button>
            </div>
          )}
          {app.status === "READY_FOR_SUBMISSION" && (
            <button
              className="btn"
              onClick={async () => {
                await client.confirmSubmit(app.id, app.applicationUrl);
                await reload();
                setMessage("Recorded as submitted by you. Harbor did not send the application.");
              }}
            >
              I submitted it myself
            </button>
          )}
        </article>
      )}

      {reviewFields.length > 0 && (
        <article className="card">
          <h3>Needs your review</h3>
          <ul>
            {reviewFields.map((field) => (
              <li key={field.fieldKey}>{field.question}</li>
            ))}
          </ul>
        </article>
      )}

      <div className="split" style={{ marginTop: 16 }}>
        <article className="card">
          <h3>Original job description</h3>
          <div className="desc">{app.review?.originalJobDescription || app.job?.description}</div>
          {app.applicationUrl && <p><a href={app.applicationUrl} target="_blank" rel="noreferrer">Employer application URL</a></p>}
        </article>
        <article className="card">
          <h3>Selected original CV</h3>
          <p>{app.review?.selectedResumeName || app.resume?.name || "Profile facts only — original file was not replaced"}</p>
          <div className="desc">{app.review?.originalResumeText || "No parsed resume text stored. The uploaded file remains unchanged."}</div>
          {app.status === "PENDING_APPROVAL" && (
            <label>
              Change resume and regenerate package
              <select value={resumeVersionId} onChange={(e) => setResumeVersionId(e.target.value)}>
                <option value="">Profile facts only</option>
                {resumes.map((resume) => (
                  <option key={String(resume.id)} value={String(resume.id)}>
                    {String(resume.name)}{resume.isDefault ? " (default)" : ""}
                  </option>
                ))}
              </select>
              <button
                className="btn ghost"
                type="button"
                onClick={async () => {
                  if (!app.jobId && !app.job?.id) return;
                  try {
                    const prepared = await client.prepare(app.jobId || app.job!.id, resumeVersionId || undefined);
                    setApp(prepared.application);
                    setMessage("Package regenerated from the selected original CV. The file itself was not changed.");
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Could not regenerate");
                  }
                }}
              >
                Regenerate from this resume
              </button>
            </label>
          )}
          <h3>Tailoring suggestions</h3>
          <ul>{(app.tailoringNotes ?? []).map((note) => <li key={note}>{note}</li>)}</ul>
        </article>
      </div>
      <article className="card" style={{ marginTop: 16 }}>
        <h3>Cover letter (editable)</h3>
        <textarea value={app.coverLetter ?? ""} onChange={(e) => setApp({ ...app, coverLetter: e.target.value })} />
      </article>
      <article className="card" style={{ marginTop: 16 }}>
        <h3>Tailored resume draft (editable)</h3>
        <p className="muted">This is a draft. The original CV file is not overwritten.</p>
        <textarea value={app.tailoredResume ?? ""} onChange={(e) => setApp({ ...app, tailoredResume: e.target.value })} />
      </article>
      <article className="card" style={{ marginTop: 16 }}>
        <h3>Questions and draft answers</h3>
        <p className="muted">You can edit every answer. Empty or sensitive answers stay in review until you complete them.</p>
        {(app.answers ?? []).map((answer, index) => (
          <label key={answer.id || answer.fieldKey}>
            {answer.question} {(!answer.answer.trim() || answer.requiresReview) && <span className="pill warn">needs review</span>}
            <textarea
              value={answer.answer}
              onChange={(e) => {
                const answers = [...(app.answers ?? [])];
                answers[index] = { ...answer, answer: e.target.value, requiresReview: !e.target.value.trim() };
                setApp({ ...app, answers });
              }}
            />
          </label>
        ))}
      </article>
    </div>
  );
}
