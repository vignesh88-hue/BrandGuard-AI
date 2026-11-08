import { useEffect, useState } from "react";
import {
  ShieldCheck,
  LayoutDashboard,
  FileText,
  ScanSearch,
  History,
  Settings,
  Bell,
  Upload,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  Sparkles,
  Menu,
  X,
  XCircle,
} from "lucide-react";

import "./App.css";

const API = "http://127.0.0.1:8000";

function App() {
  const [activePage, setActivePage] = useState("Dashboard");
  const [guidelines, setGuidelines] = useState([]);
  const [selectedGuideline, setSelectedGuideline] = useState("");
  const [content, setContent] = useState("");
  const [review, setReview] = useState(null);
  // Video review states
  const [reviewMode, setReviewMode] = useState("text");
  const [videoFile, setVideoFile] = useState(null);
  const [caption, setCaption] = useState("");
  const [videoPreview, setVideoPreview] = useState("");
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);

  // Fetch guidelines from FastAPI
  const fetchGuidelines = async () => {
    try {
      const response = await fetch(`${API}/guidelines`);

      if (!response.ok) {
        throw new Error("Unable to retrieve guidelines.");
      }
    


  // Fetch persistent review history from backend
// Fetch guidelines from FastAPI


    const data = await response.json();

    const items = Array.isArray(data)
      ? data
      : data.guidelines || [];

    setGuidelines(items);

    if (items.length > 0) {
      setSelectedGuideline((current) => current || items[0].id);
    }

  } catch (err) {
    setError(err.message);
  }
};


// Fetch persistent review history from backend
const fetchHistory = async () => {
  try {
    const response = await fetch(
      `${API}/review/history?limit=50&offset=0`
    );

    if (!response.ok) {
      throw new Error("Unable to retrieve review history.");
    }

    const data = await response.json();

    const formattedHistory = (data.reviews || []).map((item) => ({
      id: item.review_id,
      content: item.submitted_content || "",
      filename: item.guideline_filename || "Unknown guideline",
      date: new Date(item.created_at).toLocaleString(),

      result: {
        overall_status: item.overall_status,
        compliance_score: item.compliance_score,
        summary: item.summary,
      },

      approval_status: item.approval_status,
    }));

    setHistory(formattedHistory);

  } catch (err) {
    console.error("History loading error:", err);
  }
};
useEffect(() => {
  fetchGuidelines();
  fetchHistory();
}, []);

  // Upload PDF guidelines
  const handleUpload = async (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    setUploading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${API}/guidelines/upload`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Guideline upload failed.");
      }

      await fetchGuidelines();
      setActivePage("Guidelines");
      alert("Brand guidelines uploaded successfully!");
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  // Analyse content using Gemini
  const handleReview = async (event) => {
    event.preventDefault();

    if (!selectedGuideline || !content.trim()) {
      setError("Select a guideline and enter content to review.");
      return;
    }

    setLoading(true);
    setError("");
    setReview(null);

    try {
      const response = await fetch(
        `${API}/review/${selectedGuideline}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ content }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "AI review failed.");
      }

      const reviewResult = data.review;

const correctionWithheld =
  reviewResult.correction_withheld ??
  /correction\s+(?:was\s+)?withheld/i.test(
    reviewResult.summary || ""
  );

const finalReview = {
  ...reviewResult,
  correction_withheld: correctionWithheld,
};

setReview(finalReview);

      await fetchHistory();

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };


  // Analyse video using multimodal AI
const handleVideoReview = async (event) => {
  event.preventDefault();

  if (!selectedGuideline) {
    setError("Please select a brand guideline.");
    return;
  }

  if (!videoFile) {
    setError("Please select an MP4 video.");
    return;
  }

  if (!videoFile.name.toLowerCase().endsWith(".mp4")) {
    setError("Only MP4 videos are supported.");
    return;
  }

  if (videoFile.size > 100 * 1024 * 1024) {
    setError("Video size must be below 100 MB.");
    return;
  }

  setLoading(true);
  setError("");
  setReview(null);

  try {
    const formData = new FormData();

    formData.append("file", videoFile);
    formData.append("caption", caption);

    const response = await fetch(
      `${API}/review/video/${selectedGuideline}`,
      {
        method: "POST",
        body: formData,
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || "Video review failed.");
    }

    setReview({
      ...data.review,
      media_analysis: data.media_analysis,
      media_type: "video",
    });

    await fetchHistory();

  } catch (err) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
};


const handleVideoSelection = (event) => {
  const file = event.target.files?.[0];

  if (!file) return;

  if (!file.name.toLowerCase().endsWith(".mp4")) {
    setError("Please select an MP4 video.");
    event.target.value = "";
    return;
  }

  if (file.size > 100 * 1024 * 1024) {
    setError("Video size must be below 100 MB.");
    event.target.value = "";
    return;
  }

  setVideoFile(file);
  setVideoPreview(URL.createObjectURL(file));
  setReview(null);
  setError("");
};


  // Approve or reject a review
const handleDecision = async (reviewId, decision) => {
  const confirmed = window.confirm(
    `Are you sure you want to ${decision} this review?`
  );

  if (!confirmed) return;

  try {
    const response = await fetch(
      `${API}/review/history/${reviewId}/decision`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ decision }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || "Unable to update decision.");
    }

    await fetchHistory();

    alert(data.message);

  } catch (err) {
    setError(err.message);
  }
};

  const navigation = [
    { name: "Dashboard", icon: LayoutDashboard },
    { name: "Guidelines", icon: FileText },
    { name: "Content Review", icon: ScanSearch },
    { name: "Review History", icon: History },
  ];

  const totalReviews = history.length;

  const approvedReviews = history.filter(
    (item) => item.result.overall_status === "approved"
  ).length;

  const flaggedReviews = history.filter(
    (item) => item.result.overall_status === "needs_review"
  ).length;



  const renderDashboard = () => (
    <>
      <div className="welcome-section">
        <div>
          <div className="eyebrow">
            <Sparkles size={15} /> AI-POWERED BRAND GOVERNANCE
          </div>

          <h1>Good to see you.</h1>

          <p>
            Monitor your brand consistency and keep every piece of
            content aligned with your guidelines.
          </p>
        </div>

        <button
          className="primary-button"
          onClick={() => setActivePage("Content Review")}
        >
          <ScanSearch size={17} />
          New Review
        </button>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon purple">
            <FileText size={21} />
          </div>
          <p>Brand Guidelines</p>
          <h2>{guidelines.length}</h2>
          <span>Uploaded documents</span>
        </div>

        <div className="stat-card">
          <div className="stat-icon blue">
            <ScanSearch size={21} />
          </div>
          <p>Total Reviews</p>
          <h2>{totalReviews}</h2>
          <span>Current session</span>
        </div>

        <div className="stat-card">
          <div className="stat-icon green">
            <CheckCircle2 size={21} />
          </div>
          <p>Approved</p>
          <h2>{approvedReviews}</h2>
          <span>Compliant content</span>
        </div>

        <div className="stat-card">
          <div className="stat-icon orange">
            <AlertTriangle size={21} />
          </div>
          <p>Needs Review</p>
          <h2>{flaggedReviews}</h2>
          <span>Content requiring attention</span>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="panel">
          <div className="panel-heading">
            <div>
              <h3>Recent Activity</h3>
              <p>Your latest content reviews</p>
            </div>

            <button
              className="text-button"
              onClick={() => setActivePage("Review History")}
            >
              View all <ArrowUpRight size={15} />
            </button>
          </div>

          {history.length === 0 ? (
            <div className="empty-state">
              <ScanSearch size={32} />
              <h3>No reviews yet</h3>
              <p>Your recent AI reviews will appear here.</p>
            </div>
          ) : (
            history.slice(0, 4).map((item) => (
              <div className="activity-item" key={item.id}>
                <div className="activity-icon">
                  <FileText size={18} />
                </div>

                <div className="activity-details">
                  <strong>
                    {item.content.slice(0, 45)}
                    {item.content.length > 45 ? "..." : ""}
                  </strong>
                  <span>{item.date}</span>
                </div>

                <span
                  className={`status-badge ${
                    item.result.overall_status === "approved"
                      ? "approved"
                      : "needs-review"
                  }`}
                >
                  {item.result.overall_status === "approved"
                    ? "Approved"
                    : "Needs Review"}
                </span>
              </div>
            ))
          )}
        </div>

        <div className="panel quick-panel">
          <div className="panel-heading">
            <div>
              <h3>Quick Actions</h3>
              <p>Get started with BrandGuard</p>
            </div>
          </div>

          <button
            className="quick-action"
            onClick={() => setActivePage("Content Review")}
          >
            <div className="quick-icon purple">
              <ScanSearch size={20} />
            </div>
            <div>
              <strong>Analyse Content</strong>
              <span>Check content against brand rules</span>
            </div>
            <ArrowUpRight size={18} />
          </button>

          <label className="quick-action upload-action">
            <div className="quick-icon blue">
              <Upload size={20} />
            </div>
            <div>
              <strong>Upload Guidelines</strong>
              <span>Add a new brand PDF</span>
            </div>
            <ArrowUpRight size={18} />
            <input
              type="file"
              accept=".pdf"
              hidden
              onChange={handleUpload}
            />
          </label>

          {uploading && <p className="loading-text">Uploading PDF...</p>}
        </div>
      </div>
    </>
  );

  const renderGuidelines = () => (
    <>
      <div className="page-heading">
        <div>
          <h1>Brand Guidelines</h1>
          <p>Manage your organization's approved brand documents.</p>
        </div>

        <label className="primary-button">
          <Upload size={17} />
          Upload PDF
          <input
            type="file"
            accept=".pdf"
            hidden
            onChange={handleUpload}
          />
        </label>
      </div>

      <div className="panel">
        <div className="panel-heading">
          <div>
            <h3>Uploaded Documents</h3>
            <p>{guidelines.length} documents available</p>
          </div>
        </div>

        {guidelines.length === 0 ? (
          <div className="empty-state">
            <FileText size={32} />
            <h3>No guidelines uploaded</h3>
            <p>Upload your first brand guidelines PDF.</p>
          </div>
        ) : (
          guidelines.map((item) => (
            <div className="activity-item" key={item.id}>
              <div className="activity-icon">
                <FileText size={19} />
              </div>

              <div className="activity-details">
                <strong>{item.filename}</strong>
                <span>ID: {item.id}</span>
              </div>

              <span className="status-badge approved">
                Available
              </span>
            </div>
          ))
        )}

        {uploading && <p className="loading-text">Uploading PDF...</p>}
      </div>
    </>
  );

  const renderReview = () => (
    <>
      <div className="page-heading">
        <div>
          <h1>AI Content Review</h1>
          <p>
            Evaluate your content using Gemini and your approved
            brand guidelines.
          </p>
        </div>
      </div>

      <div className="review-layout">
        <form className="panel review-form"
  onSubmit={reviewMode === "text" ? handleReview : handleVideoReview}>
          <div className="panel-heading">
            <div>
              <h3>Submit Content</h3>
              <p>Enter the content you want to analyse.</p>
            </div>
            <Sparkles size={22} className="purple-text" />
          </div>


          {/* Review Mode Selector */}
<div className="review-mode-selector">
  <button
    type="button"
    className={`primary-button ${
      reviewMode === "text" ? "" : "secondary-button"
    }`}
    onClick={() => {
      setReviewMode("text");
      setReview(null);
      setError("");
    }}
  >
    Text Review
  </button>

  <button
    type="button"
    className={`primary-button ${
      reviewMode === "video" ? "" : "secondary-button"
    }`}
    onClick={() => {
      setReviewMode("video");
      setReview(null);
      setError("");
    }}
  >
    Video Review
  </button>
</div>

          <label className="field-label">Select Brand Guidelines</label>

          <select
            value={selectedGuideline}
            onChange={(event) => setSelectedGuideline(event.target.value)}
            required
          >
            <option value="">Choose a guideline</option>

            {guidelines.map((item) => (
              <option key={item.id} value={item.id}>
                {item.filename}
              </option>
            ))}
          </select>

          {reviewMode === "text" ? (
  <>
    <label className="field-label">Content to Analyse</label>

    <textarea
      value={content}
      onChange={(event) => setContent(event.target.value)}
      placeholder="Paste your social media caption, marketing copy or other brand content here..."
      maxLength={20000}
      required
    />

    <div className="character-count">
      {content.length}/20000 characters
    </div>
  </>
) : (
  <>
    <label className="field-label">Upload Video (MP4)</label>

    <input
      type="file"
      accept="video/mp4,.mp4"
      onChange={handleVideoSelection}
      required
    />

    {videoPreview && (
      <div className="video-preview">
        <video
          src={videoPreview}
          controls
          width="100%"
          style={{ borderRadius: "12px", marginTop: "15px" }}
        />
        <p>{videoFile?.name}</p>
      </div>
    )}

    <label className="field-label">Social Media Caption</label>

    <textarea
      value={caption}
      onChange={(event) => setCaption(event.target.value)}
      placeholder="Enter the caption associated with this video..."
      maxLength={20000}
    />

    <div className="character-count">
      {caption.length}/20000 characters
    </div>

    <p className="loading-text">
      Supported format: MP4 · Maximum size: 100 MB
    </p>
  </>
)}


          <button
            type="submit"
            className="primary-button full-button"
            disabled={loading || guidelines.length === 0}
          >
            {loading ? (
  reviewMode === "video"
    ? "Analysing Video..."
    : "Analysing with Gemini..."
) : (
  <>
    <Sparkles size={17} />
    {reviewMode === "video"
      ? "Analyse Video"
      : "Analyse Content"}
  </>
)}
          </button>
        </form>

        <div className="panel result-panel">
          <div className="panel-heading">
            <div>
              <h3>Analysis Results</h3>
              <p>AI-generated compliance report</p>
            </div>
            <ShieldCheck size={23} className="purple-text" />
          </div>

          {!review ? (
            <div className="empty-state">
              <ScanSearch size={38} />
              <h3>Waiting for content</h3>
              <p>
                Submit content to see your brand compliance report.
              </p>
            </div>
          ) : (
            <>
              <div className="score-card">
                <div>
                  <span>Compliance Score</span>
                  <h2>{review.compliance_score}<small>/100</small></h2>
                </div>

                <span
                  className={`status-badge ${
                    review.overall_status === "approved"
                      ? "approved"
                      : "needs-review"
                  }`}
                >
                  {review.overall_status === "approved"
                    ? "Approved"
                    : "Needs Review"}
                </span>
              </div>

              <p className="result-summary">{review.summary}</p>

              {Array.isArray(review.rule_results) && review.rule_results.length > 0 && (
                <div className="rule-results-section">
                  <h4 className="result-subheading">
                    Guideline Evaluation ({review.rule_results.length} rules)
                  </h4>
                  {review.rule_results.map((item) => (
                    <div className="violation-card" key={item.rule_number}>
                      <div className="violation-heading">
                        <strong>Rule {item.rule_number}: {item.category}</strong>
                        <span className={`status-badge ${
                          item.status === "compliant"
                            ? "approved"
                            : item.status === "violation"
                              ? "needs-review"
                              : "needs-review"
                        }`}>
                          {String(item.status || "unknown").replaceAll("_", " ")}
                        </span>
                      </div>
                      <p>{item.evidence || "No evidence supplied."}</p>
                      <small>Confidence: {Number.isFinite(Number(item.confidence))
                        ? `${(Number(item.confidence) * 100).toFixed(0)}%`
                        : "Not provided"}</small>
                    </div>
                  ))}
                </div>
              )}

              {review.media_analysis && (
  <div className="correction-box">
    <h4>Video Analysis Report</h4>

    <p>
      <strong>Video:</strong>{" "}
      {review.media_analysis.filename}
    </p>

    <p>
      <strong>Duration:</strong>{" "}
      {review.media_analysis.metadata?.duration?.toFixed(2)} seconds
    </p>

    <p>
      <strong>Resolution:</strong>{" "}
      {review.media_analysis.metadata?.width} ×{" "}
      {review.media_analysis.metadata?.height}
    </p>

    <p>
      <strong>Frames analysed:</strong>{" "}
      {review.media_analysis.frames_analyzed}
    </p>

    {review.media_analysis.speech && (
      <>
        <h4>Speech Transcription</h4>

        <p>
          {review.media_analysis.speech.transcription}
        </p>

        {review.media_analysis.speech.requires_human_review && (
          <p className="error-banner">
            Speech transcription contains uncertain segments. Please verify the transcript before making a final decision.
          </p>
        )}

        {Array.isArray(review.media_analysis.speech.uncertain_segments) &&
          review.media_analysis.speech.uncertain_segments.length > 0 && (
            <div className="suggestion">
              <strong>Words requiring verification</strong>
              {review.media_analysis.speech.uncertain_segments.map((segment, index) => (
                <p key={index}>
                  {typeof segment === "string"
                    ? segment
                    : segment.word || segment.text || JSON.stringify(segment)}
                </p>
              ))}
            </div>
          )}

        <p>
          Language: {review.media_analysis.speech.language}
          {" · "}
          Confidence:{" "}
          {(
            review.media_analysis.speech.language_probability * 100
          ).toFixed(1)}%
        </p>
      </>
    )}

    {review.media_analysis.audio && (
      <>
        <h4>Audio Quality</h4>

        <p>
          Silence:{" "}
          {review.media_analysis.audio.silence_percentage}%
        </p>

        <p>
          Clipping:{" "}
          {review.media_analysis.audio.clipping_percentage}%
        </p>

        {review.media_analysis.audio.quality_warnings?.map(
          (warning, index) => (
            <p key={index}>⚠️ {warning}</p>
          )
        )}
      </>
    )}
  </div>
)}

              <h4 className="result-subheading">
                Detected Issues ({review.violations?.length || 0})
              </h4>

              {review.violations?.length > 0 ? (
                review.violations.map((violation, index) => (
                  <div className="violation-card" key={index}>
                    <div className="violation-heading">
                      <strong>{violation.category}</strong>
                      <span className="severity">
                        {violation.severity}
                      </span>
                    </div>

                    <p>{violation.issue}</p>

                    <div className="suggestion">
                      <strong>Suggested correction</strong>
                      <p>{violation.suggestion}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p>No violations detected.</p>
              )}

              {review.corrected_content && (
                <div className="correction-box">
                  <h4>{review.correction_withheld
                    ? "Correction Withheld"
                    : "Suggested Corrected Content"
                  }</h4>
                  {review.correction_withheld && (
                    <p className="result-summary">
                       AI-generated correction failed safety validation.
                      The original content has been preserved for human review.
                    </p>
                  )}
                  <p>{review.corrected_content}</p>
                  {!review.correction_withheld && (
                  <button
                    className="text-button"
                    type="button"
                    onClick={() =>
                      navigator.clipboard.writeText(
                        review.corrected_content
                      )
                      
                    }
                  >
                    Copy corrected content
                  </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );

  const renderHistory = () => (
  <>
    <div className="page-heading">
      <div>
        <h1>Review History</h1>
        <p>View and manage your previously analysed content.</p>
      </div>
    </div>

    <div className="panel">
      {history.length === 0 ? (
        <div className="empty-state">
          <History size={32} />
          <h3>No review history</h3>
          <p>Your completed reviews will appear here.</p>
        </div>
      ) : (
        history.map((item) => (
          <div className="activity-item" key={item.id}>
            <div className="activity-icon">
              <FileText size={18} />
            </div>

            <div className="activity-details">
              <strong>{item.content.slice(0, 65)}</strong>

              <span>
                {item.date} · {item.filename}
              </span>

              <span>
                AI Score: {item.result.compliance_score}/100
              </span>

              <span>
                Human Decision: {item.approval_status}
              </span>

              {item.approval_status === "pending" && (
                <div className="decision-actions">
                  <button
                    className="approve-button"
                    onClick={() =>
                      handleDecision(item.id, "approved")
                    }
                  >
                    <CheckCircle2 size={15} />
                    Approve
                  </button>

                  <button
                    className="reject-button"
                    onClick={() =>
                      handleDecision(item.id, "rejected")
                    }
                  >
                    <XCircle size={15} />
                    Reject
                  </button>
                </div>
              )}
            </div>

            <span className="status-badge needs-review">
              {item.result.compliance_score}/100
            </span>
          </div>
        ))
      )}
    </div>
  </>
);

  const renderPage = () => {
    switch (activePage) {
      case "Guidelines":
        return renderGuidelines();
      case "Content Review":
        return renderReview();
      case "Review History":
        return renderHistory();
      default:
        return renderDashboard();
    }
  };

  return (
    <div className="app-container">
      <aside className={`sidebar ${mobileMenu ? "mobile-open" : ""}`}>
        <div className="brand-logo">
          <div className="logo-icon">
            <ShieldCheck size={25} />
          </div>
          <div>
            <h2>BrandGuard<span>AI</span></h2>
            <p>Brand Intelligence</p>
          </div>

          <button
            className="mobile-close"
            onClick={() => setMobileMenu(false)}
          >
            <X size={20} />
          </button>
        </div>

        <div className="nav-label">WORKSPACE</div>

        <nav>
          {navigation.map(({ name, icon: Icon }) => (
            <button
              key={name}
              className={`nav-item ${
                activePage === name ? "active" : ""
              }`}
              onClick={() => {
                setActivePage(name);
                setMobileMenu(false);
              }}
            >
              <Icon size={19} />
              {name}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-status">
            <span className="online-dot"></span>
            Backend connection
            <strong>Active</strong>
          </div>

          <button className="nav-item" disabled>
            <Settings size={19} />
            Settings
          </button>

          <div className="profile">
            <div className="avatar">NF</div>
            <div>
              <strong>NeuralForge</strong>
              <span>Demo Organisation</span>
            </div>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <button
            className="menu-button"
            onClick={() => setMobileMenu(true)}
          >
            <Menu size={22} />
          </button>

          <div className="breadcrumb">
            Workspace <span>/</span> {activePage}
          </div>

          <div className="topbar-right">
            <span className="system-status">
              <span className="online-dot"></span>
              System operational
            </span>
            <button className="icon-button" title="Notifications">
              <Bell size={19} />
            </button>
            <div className="top-avatar">NF</div>
          </div>
        </header>

        <div className="page-content">
          {error && (
            <div className="error-banner">
              <AlertTriangle size={18} />
              {error}
              <button onClick={() => setError("")}>Dismiss</button>
            </div>
          )}

          {renderPage()}
        </div>

        <footer className="footer">
          BrandGuard AI · Intelligent Brand Governance
          <span>Powered by Gemini</span>
        </footer>
      </main>
    </div>
  );
}


export default App;