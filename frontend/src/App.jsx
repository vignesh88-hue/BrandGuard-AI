import { useCallback, useEffect, useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import {
  ShieldCheck, LayoutDashboard, FileText, ScanSearch, History,
  Settings, Bell, Upload, CheckCircle2, AlertTriangle, ArrowUpRight,
  Sparkles, Menu, X, XCircle, Video, Image as ImageIcon, RefreshCw, Download,
  Clock3, Activity,  Zap, ChevronRight, FileCheck2, LoaderCircle, Trash2
} from "lucide-react";
import "./App.css";

const API = (import.meta.env.VITE_API_URL || "https://brandguard-ai-backend-p325.onrender.com").replace(/\/$/, "");
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

async function readResponse(response, fallback) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || data.message || fallback);
  return data;
}

function formatDate(value) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleString();
}

function StatusBadge({ status }) {
  const approved = String(status || "").toLowerCase() === "approved";
  return (
    <span className={`status-badge ${approved ? "approved" : "review"}`}>
      <span className="status-dot" />
      {approved ? "Approved" : "Needs review"}
    </span>
  );
}

function ProviderBadge({ provider }) {
  if (!provider) return null;

  const name = String(provider).toLowerCase();

  const label = {
    gemini: "Gemini AI",
    groq: "Groq AI"
  }[name] || name;

  return (
    <span className={`provider-badge ${name}`}>
      <Sparkles size={13} />
      {label}
    </span>
  );
}


function App() {
  const [activePage, setActivePage] = useState("Dashboard");
  const [guidelines, setGuidelines] = useState([]);
  const [selectedGuideline, setSelectedGuideline] = useState("");
  const [content, setContent] = useState("");
  const [reviewMode, setReviewMode] = useState("text");
  const [videoFile, setVideoFile] = useState(null);
  const [videoPreview, setVideoPreview] = useState("");
  const [caption, setCaption] = useState("");
  const [review, setReview] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [search, setSearch] = useState("");

  const fetchGuidelines = useCallback(async () => {
    const response = await fetch(`${API}/guidelines`);
    const data = await readResponse(response, "Unable to retrieve guidelines.");
    const items = Array.isArray(data) ? data : (data.guidelines || []);
    setGuidelines(items);
    setSelectedGuideline((current) =>
      items.some((item) => item.id === current) ? current : (items[0]?.id || "")
    );
  }, []);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const response = await fetch(`${API}/review/history?limit=50&offset=0`);
      const data = await readResponse(response, "Unable to retrieve review history.");
      setHistory(Array.isArray(data) ? data : (data.reviews || []));
    } catch (err) {
      console.error("History loading error:", err);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGuidelines().catch((err) => setError(err.message));
    fetchHistory();
  }, [fetchGuidelines, fetchHistory]);

  useEffect(() => {
    return () => {
      if (videoPreview) URL.revokeObjectURL(videoPreview);
    };
  }, [videoPreview]);

  const totalReviews = history.length;
  const approvedReviews = history.filter((item) => item.overall_status === "approved").length;
  const flaggedReviews = history.filter((item) => item.overall_status !== "approved").length;
  const averageScore = totalReviews
    ? Math.round(history.reduce((sum, item) => sum + (Number(item.compliance_score) || 0), 0) / totalReviews)
    : 0;

  const filteredGuidelines = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return guidelines;
    return guidelines.filter((item) => (item.filename || "").toLowerCase().includes(term));
  }, [guidelines, search]);

  const navigate = (page) => {
    setActivePage(page);
    setMobileMenu(false);
    setError("");
    setNotice("");
  };

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("Please choose a PDF file.");
      event.target.value = "";
      return;
    }
    setUploading(true);
    setError("");
    setNotice("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(`${API}/guidelines/upload`, { method: "POST", body: formData });
      await readResponse(response, "Guideline upload failed.");
      await fetchGuidelines();
      setActivePage("Guidelines");
      setNotice("Brand guidelines uploaded successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const handleVideoSelection = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".mp4")) {
      setError("Only MP4 videos are supported.");
      event.target.value = "";
      return;
    }
    if (file.size > MAX_VIDEO_BYTES) {
      setError("Video size must be below 100 MB.");
      event.target.value = "";
      return;
    }
    setVideoFile(file);
    setVideoPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(file);
    });
    setReview(null);
    setError("");
  };

  const handleReview = async (event) => {
    event.preventDefault();
    if (!selectedGuideline) {
      setError("Select a brand guideline before starting the review.");
      return;
    }
    if (reviewMode === "text" && !content.trim()) {
      setError("Enter the content you want to analyse.");
      return;
    }
    if (reviewMode === "video" && !videoFile) {
      setError("Choose an MP4 video before starting the review.");
      return;
    }

    setLoading(true);
    setError("");
    setNotice("");
    setReview(null);
    try {
      let response;
      if (reviewMode === "text") {
        response = await fetch(`${API}/review/${selectedGuideline}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: content.trim() })
        });
      } else {
        const formData = new FormData();
        formData.append("file", videoFile);
        formData.append("caption", caption);
        response = await fetch(`${API}/review/video/${selectedGuideline}`, {
          method: "POST",
          body: formData
        });
      }
      const data = await readResponse(response, "AI review failed.");
      const result = data.review || data;

      const aiProvider =
      data.ai_provider ||
      result._provider ||
      null;
      const correctionWithheld = result.correction_withheld ??
        /correction\s+(?:was\s+)?withheld/i.test(result.summary || "");
      setReview({
        ai_provider: aiProvider,
        ...result,
        correction_withheld: correctionWithheld,
        media_analysis: data.media_analysis || result.media_analysis || null,
        media_type: reviewMode
      });
      await fetchHistory();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDecision = async (reviewId, decision) => {
    const confirmed = window.confirm(`Are you sure you want to ${decision} this review?`);
    if (!confirmed) return;
    setError("");
    try {
      const response = await fetch(`${API}/review/history/${reviewId}/decision`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision })
      });
      const data = await readResponse(response, "Unable to update the review decision.");
      setNotice(data.message || `Review ${decision}.`);
      await fetchHistory();
    } catch (err) {
      setError(err.message);
    }
  };

  const resetReview = () => {
    setReview(null);
    setContent("");
    setCaption("");
    setVideoFile(null);
    if (videoPreview) URL.revokeObjectURL(videoPreview);
    setVideoPreview("");
    setError("");
  };

  const navigation = [
    { name: "Dashboard", icon: LayoutDashboard },
    { name: "Guidelines", icon: FileText },
    { name: "Content Review", icon: ScanSearch },
    { name: "Review History", icon: History }
  ];

  const renderDashboard = () => {
    const recent = history.slice(0, 4);
    const attentionItems = history.filter((item) =>
      String(item.overall_status || "").toLowerCase() !== "approved"
    ).slice(0, 3);
    const scoreTone = averageScore >= 80 ? "good" : averageScore >= 60 ? "watch" : "risk";
    const complianceCategories = [
      { label: "Content & messaging", value: averageScore, color: "teal" },
      { label: "Human verification", value: history.length ? Math.max(0, 100 - Math.round((flaggedReviews / totalReviews) * 100)) : 0, color: "blue" },
      { label: "Guideline coverage", value: guidelines.length ? 100 : 0, color: "violet" }
    ];

    return (
      <>
        <section className="dashboard-hero">
          <div className="dashboard-hero-copy">
            <div className="eyebrow"><Sparkles size={14} /> BRAND INTELLIGENCE WORKSPACE</div>
            <h1>Good day, NeuralForge.</h1>
            <p>Keep every campaign consistent, compliant and unmistakably on-brand.</p>
            <div className="hero-actions">
              <button className="button button-primary" onClick={() => navigate("Content Review")}><ScanSearch size={16} /> Start a content review</button>
              <button className="button button-outline" onClick={() => navigate("Guidelines")}><Upload size={16} /> Add guidelines</button>
            </div>
          </div>
          <div className="hero-shield"><div className="hero-shield-glow"><ShieldCheck size={42} /></div><span>BRAND TRUST<br />STARTS HERE</span></div>
        </section>

        <div className="dashboard-section-title">
          <div><span className="section-kicker">WORKSPACE OVERVIEW</span><h2>Compliance at a glance</h2></div>
          <span className="live-label"><span className="status-dot" /> Live workspace data</span>
        </div>

        <section className="stats-grid dashboard-stats">
          <StatCard icon={ShieldCheck} label="Average compliance" value={`${averageScore}%`} note="Across saved content reviews" tone="green" />
          <StatCard icon={FileText} label="Brand guidelines" value={guidelines.length} note="Approved reference documents" tone="violet" />
          <StatCard icon={CheckCircle2} label="Approved reviews" value={approvedReviews} note="AI checks marked compliant" tone="blue" />
          <StatCard icon={AlertTriangle} label="Needs attention" value={flaggedReviews} note="Awaiting closer review" tone="amber" />
        </section>

        <section className="dashboard-main-grid">
          <div className="surface-card compliance-card">
            <div className="section-heading">
              <div><h2>Brand compliance health</h2><p>Your current performance across reviewed content</p></div>
              <span className={`health-pill ${scoreTone}`}>{totalReviews ? (averageScore >= 80 ? "Healthy" : averageScore >= 60 ? "Monitor" : "At risk") : "Awaiting data"}</span>
            </div>
            <div className="compliance-visual">
              <div className="compliance-gauge" style={{ "--score": `${averageScore}%` }}>
                <div className="gauge-inner"><strong>{averageScore}<small>%</small></strong><span>Average score</span></div>
              </div>
              <div className="compliance-copy">
                <strong>{totalReviews ? `${totalReviews} content ${totalReviews === 1 ? "review" : "reviews"} completed` : "Your first review starts here"}</strong>
                <p>{totalReviews ? `${approvedReviews} approved and ${flaggedReviews} requiring attention.` : "Upload your brand guidelines, then run a review to populate your compliance dashboard."}</p>
                <button className="text-action" onClick={() => navigate("Review History")}>Explore review history <ArrowUpRight size={14} /></button>
              </div>
            </div>
            <div className="category-progress">
              {complianceCategories.map((item) => (
                <div className="category-row" key={item.label}>
                  <div className="category-label"><span>{item.label}</span><strong>{item.value}%</strong></div>
                  <div className="progress-track"><span className={item.color} style={{ width: `${item.value}%` }} /></div>
                </div>
              ))}
            </div>
          </div>

          <div className="surface-card quick-actions-card">
            <div className="section-heading"><div><h2>Quick actions</h2><p>Move your brand workflow forward</p></div><span className="quick-action-symbol"><Zap size={18} /></span></div>
            <button className="action-tile" onClick={() => navigate("Content Review")}><span className="action-icon teal"><ScanSearch size={18} /></span><span><strong>Review new content</strong><small>Check text or video against your rules</small></span><ChevronRight size={17} /></button>
            <button className="action-tile" onClick={() => navigate("Guidelines")}><span className="action-icon violet"><Upload size={18} /></span><span><strong>Manage guidelines</strong><small>Upload and select brand standards</small></span><ChevronRight size={17} /></button>
            <button className="action-tile" onClick={() => navigate("Review History")}><span className="action-icon amber"><History size={18} /></span><span><strong>Review past decisions</strong><small>Track approvals and flagged content</small></span><ChevronRight size={17} /></button>
            <div className="quick-actions-foot"><ShieldCheck size={15} /><span>Human review remains part of the approval process.</span></div>
          </div>
        </section>

        <section className="dashboard-bottom-grid">
          <div className="surface-card activity-card">
            <div className="section-heading"><div><h2>Recent review activity</h2><p>The latest content checked by BrandGuard AI</p></div><button className="button button-ghost button-small" onClick={() => navigate("Review History")}>View all <ArrowUpRight size={14} /></button></div>
            {recent.length ? <div className="dashboard-activity-list">{recent.map((item, index) => <HistoryRow key={item.review_id || item.id || index} item={item} compact />)}</div> : <EmptyState icon={Activity} title="No activity to show yet" text="Your latest content reviews will appear here once you run your first analysis." />}
          </div>
          <div className="surface-card attention-card">
            <div className="section-heading"><div><h2>Priority attention</h2><p>Reviews that may need a human decision</p></div><span className="attention-count">{attentionItems.length}</span></div>
            {attentionItems.length ? attentionItems.map((item, index) => <div className="attention-item" key={item.review_id || item.id || index}><span className="attention-mark"><AlertTriangle size={15} /></span><div><strong>{(item.submitted_content || item.summary || "Media review").slice(0, 55)}{(item.submitted_content || item.summary || "").length > 55 ? "…" : ""}</strong><small>{formatDate(item.created_at)}</small></div><span className="attention-score">{Number.isFinite(Number(item.compliance_score)) ? `${item.compliance_score}%` : "—"}</span></div>) : <EmptyState icon={CheckCircle2} title="Nothing flagged" text="No reviews currently require attention." />}
            <button className="attention-link" onClick={() => navigate("Review History")}>Open review queue <ArrowUpRight size={14} /></button>
          </div>
        </section>
      </>
    );
  };

  const renderGuidelines = () => (
    <>
      <PageHeading title="Brand guidelines" subtitle="Your organisation's approved brand standards and reference documents.">
        <label className={`button button-primary upload-button ${uploading ? "is-disabled" : ""}`}>
          {uploading ? <LoaderCircle className="spin" size={17} /> : <Upload size={17} />}
          {uploading ? "Uploading…" : "Upload PDF"}
          <input type="file" accept=".pdf,application/pdf" hidden onChange={handleUpload} disabled={uploading} />
        </label>
      </PageHeading>
      <div className="surface-card">
        <div className="section-heading section-heading-wrap">
          <div><h2>Uploaded documents <span className="count-pill">{guidelines.length}</span></h2><p>Select a document when starting a content review.</p></div>
          <div className="search-box"><ScanSearch size={16} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search guidelines" /></div>
        </div>
        {filteredGuidelines.length === 0 ? <EmptyState icon={FileText} title={guidelines.length ? "No matching documents" : "No guidelines uploaded"} text={guidelines.length ? "Try another search term." : "Upload your first brand guideline PDF to get started."} /> :
          <div className="guideline-list">{filteredGuidelines.map((item) => (
            <div className="guideline-row" key={item.id}>
              <div className="file-icon"><FileText size={21} /></div>
              <div className="guideline-info"><strong>{item.filename || "Untitled guideline"}</strong><small>Document ID · {item.id}</small></div>
              <span className="document-status"><span /> Available</span>
              <button className="button button-outline button-small" onClick={() => { setSelectedGuideline(item.id); navigate("Content Review"); }}>Use guideline <ArrowUpRight size={14} /></button>
            </div>
          ))}</div>}
      </div>
    </>
  );

  const renderReview = () => (
    <>
      <PageHeading title="Content review" subtitle="Check written content or video against your selected brand guidelines." />
      <div className="review-layout review-layout-refined">
        <form className="surface-card review-form" onSubmit={handleReview}>
          <div className="section-heading"><div><h2>New compliance check</h2><p>Choose your source and submit it for analysis.</p></div><span className="ai-chip"><Sparkles size={13} /> AI powered</span></div>
          <label className="field-label" htmlFor="guideline-select">Brand guideline</label>
          <select id="guideline-select" className="form-control" value={selectedGuideline} onChange={(e) => setSelectedGuideline(e.target.value)} required>
            <option value="">Choose a guideline document</option>
            {guidelines.map((item) => <option key={item.id} value={item.id}>{item.filename}</option>)}
          </select>

          <div className="mode-switch" role="group" aria-label="Review type">
            <button type="button" className={reviewMode === "text" ? "mode-option active" : "mode-option"} onClick={() => { setReviewMode("text"); setError(""); }}> <FileText size={17} /> Text review</button>
            <button type="button" className={reviewMode === "video" ? "mode-option active" : "mode-option"} onClick={() => { setReviewMode("video"); setError(""); }}> <Video size={17} /> Video review</button>
          </div>

          {reviewMode === "text" ? <>
            <label className="field-label" htmlFor="content-input">Content to analyse</label>
            <textarea id="content-input" className="form-control content-input" value={content} onChange={(e) => setContent(e.target.value)} placeholder="Paste a social media caption, marketing copy, campaign message or other brand content…" maxLength={20000} required />
            <div className="field-meta"><span>Keep your content under 20,000 characters.</span><span>{content.length.toLocaleString()} / 20,000</span></div>
          </> : <>
            <label className="field-label" htmlFor="video-input">Video file</label>
            <label className={`dropzone ${videoFile ? "has-file" : ""}`} htmlFor="video-input">
              <input id="video-input" type="file" accept="video/mp4,.mp4" hidden onChange={handleVideoSelection} />
              {videoFile ? <><div className="dropzone-icon"><Video size={23} /></div><strong>{videoFile.name}</strong><small>{(videoFile.size / (1024 * 1024)).toFixed(1)} MB · MP4 video</small></> :
                <><div className="dropzone-icon"><Upload size={23} /></div><strong>Choose an MP4 video</strong><small>Click to browse · Maximum file size 100 MB</small></>}
            </label>
            {videoPreview && <video className="video-preview" src={videoPreview} controls />}
            <label className="field-label" htmlFor="caption-input">Social media caption <span className="optional-label">Optional</span></label>
            <textarea id="caption-input" className="form-control caption-input" value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Paste the caption that accompanies this video…" maxLength={20000} />
            <div className="field-meta"><span>Caption is checked alongside the video and audio.</span><span>{caption.length.toLocaleString()} / 20,000</span></div>
          </>}

          <div className="privacy-note"><ShieldCheck size={16} /><span>Your content is analysed against the selected guideline. Review uncertain findings before publishing.</span></div>
          <button className="button button-primary submit-button" type="submit" disabled={loading || uploading || guidelines.length === 0}>
            {loading ? <><LoaderCircle className="spin" size={17} /> Analysing {reviewMode === "video" ? "video" : "content"}…</> : <><Sparkles size={17} /> Analyse {reviewMode === "video" ? "video" : "content"}</>}
          </button>
          {guidelines.length === 0 && <p className="inline-hint">Upload a brand guideline before starting a review.</p>}
        </form>

        <div className="surface-card result-panel result-summary-panel">
          <div className="section-heading"><div><h2>Analysis report</h2><p>At-a-glance compliance summary</p></div><span className="report-icon"><ShieldCheck size={20} /></span></div>
          {!review ? <EmptyState icon={ScanSearch} title="Your report will appear here" text="Submit text or a video to see the compliance score and key findings." /> : <ReviewResults review={review} summaryOnly onDownload={() => downloadReviewReport(review)} />}
        </div>
      </div>

      {review && <section className="surface-card review-details-panel">
        <div className="section-heading details-main-heading">
          <div><span className="section-kicker">DETAILED FINDINGS</span><h2>Review findings & diagnostics</h2><p>Issues, recommendations and supporting evidence from the analysis.</p></div>
          <button className="button button-outline" onClick={() => downloadReviewReport(review)}><Download size={16} /> Download report</button>
        </div>
        <ReviewResults review={review} detailsOnly />
      </section>}
    </>
  );

  const renderHistory = () => (
    <>
      <PageHeading title="Review history" subtitle="A record of content checks and human approval decisions.">
        <button className="button button-outline" onClick={fetchHistory} disabled={historyLoading}>{historyLoading ? <LoaderCircle className="spin" size={16} /> : <RefreshCw size={16} />} Refresh</button>
      </PageHeading>
      <div className="surface-card">
        <div className="section-heading"><div><h2>All reviews <span className="count-pill">{history.length}</span></h2><p>Review status and human decision are tracked separately.</p></div></div>
        {historyLoading && history.length === 0 ? <EmptyState icon={LoaderCircle} title="Loading review history" text="Retrieving saved reviews…" /> :
          history.length === 0 ? <EmptyState icon={History} title="No review history" text="Completed reviews will be saved here." /> :
            <div className="history-list">{history.map((item) => <HistoryRow key={item.review_id} item={item} onDecision={handleDecision} />)}</div>}
      </div>
    </>
  );

  const renderPage = () => {
    if (activePage === "Guidelines") return renderGuidelines();
    if (activePage === "Content Review") return renderReview();
    if (activePage === "Review History") return renderHistory();
    return renderDashboard();
  };

  return (
    <div className="app-shell">
      {mobileMenu && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileMenu(false)} />}
      <aside className={`sidebar ${mobileMenu ? "mobile-open" : ""}`}>
        <div className="brand-lockup">
          <div className="brand-mark"><ShieldCheck size={24} /></div>
          <div><strong>BrandGuard<span> AI</span></strong><small>BRAND INTELLIGENCE</small></div>
          <button className="mobile-close" onClick={() => setMobileMenu(false)} aria-label="Close menu"><X size={19} /></button>
        </div>
        <div className="nav-caption">WORKSPACE</div>
        <nav className="side-nav">{navigation.map(({ name, icon: Icon }) => (
          <button key={name} className={`nav-item ${activePage === name ? "active" : ""}`} onClick={() => navigate(name)}>
            <Icon size={18} strokeWidth={1.9} /><span>{name}</span>{activePage === name && <span className="nav-active-mark" />}
          </button>
        ))}</nav>
        <div className="sidebar-bottom">
          <div className="sidebar-status"><span className="status-dot" /><div><strong>Workspace API</strong><small>Connection configured</small></div></div>
          <button className="nav-item settings-item" disabled><Settings size={18} /><span>Settings</span></button>
          <div className="profile-card"><div className="profile-avatar">NF</div><div><strong>NeuralForge</strong><small>Demo organisation</small></div><span className="profile-menu">•••</span></div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left"><button className="menu-button" onClick={() => setMobileMenu(true)} aria-label="Open navigation"><Menu size={21} /></button><div className="breadcrumb">Workspace <ChevronRight size={14} /> <strong>{activePage}</strong></div></div>
          <div className="topbar-actions"><span className="topbar-status"><span className="status-dot" /> Brand workspace</span><button className="icon-action" title="Notifications"><Bell size={18} /></button><div className="top-avatar">NF</div></div>
        </header>
        <div className="page-content">
          {error && <div className="alert alert-error"><AlertTriangle size={17} /><span>{error}</span><button onClick={() => setError("")} aria-label="Dismiss error"><X size={16} /></button></div>}
          {notice && <div className="alert alert-success"><CheckCircle2 size={17} /><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Dismiss notice"><X size={16} /></button></div>}
          {renderPage()}
        </div>
        <footer className="app-footer"><span>© {new Date().getFullYear()} BrandGuard AI</span><span>Intelligent brand governance <i /> Powered by AI</span></footer>
      </main>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, note, tone }) {
  return <div className="stat-card"><div className={`stat-icon ${tone}`}><Icon size={19} /></div><div className="stat-label">{label}</div><strong className="stat-value">{value}</strong><small>{note}</small></div>;
}

function PageHeading({ title, subtitle, children }) {
  return <div className="page-heading"><div><div className="eyebrow">BRANDGUARD AI / WORKSPACE</div><h1>{title}</h1><p>{subtitle}</p></div>{children && <div className="heading-actions">{children}</div>}</div>;
}

function EmptyState({ icon: Icon, title, text }) {
  return <div className="empty-state"><div className="empty-icon"><Icon size={23} /></div><strong>{title}</strong><p>{text}</p></div>;
}

function HistoryRow({ item, compact = false, onDecision }) {
  const id = item.review_id || item.id;
  const score = Number(item.compliance_score);
  const summary = item.submitted_content || item.summary || "Video or media review";
  return (
    <div className={`history-row ${compact ? "compact" : ""}`}>
      <div className="history-file-icon"><FileCheck2 size={19} /></div>
      <div className="history-main"><strong>{summary.length > (compact ? 62 : 100) ? `${summary.slice(0, compact ? 62 : 100)}…` : summary}</strong>
        <div ProviderBadge provider={item.ai_provider} ><span><Clock3 size={12} /> {formatDate(item.created_at)}</span><span>{item.guideline_filename || "Brand guideline"}</span></div>
        {!compact && <div className="history-decision">Human decision: <strong>{item.approval_status || "pending"}</strong></div>}
        {!compact && onDecision && item.approval_status === "pending" && <div className="decision-actions"><button className="decision-button approve" onClick={() => onDecision(id, "approved")}><CheckCircle2 size={14} /> Approve</button><button className="decision-button reject" onClick={() => onDecision(id, "rejected")}><XCircle size={14} /> Reject</button></div>}
      </div>
      <div className="history-trailing"><StatusBadge status={item.overall_status} /><strong className="history-score">{Number.isFinite(score) ? `${score}/100` : "—"}</strong></div>
    </div>
  );
}

function SpeedometerGauge({ value, max = 100, label, tone = "teal", suffix = "" }) {
  const safeValue = Number.isFinite(Number(value)) ? Number(value) : 0;
  const percentage = Math.max(0, Math.min(100, max > 0 ? (safeValue / max) * 100 : 0));
  return (
    <div className={`mini-gauge ${tone}`} style={{ "--gauge-value": `${percentage}%`, "--needle-angle": `${-90 + percentage * 1.8}deg` }}>
      <div className="mini-gauge-arc"><span className="mini-gauge-needle" /></div>
      <strong>{safeValue}{suffix}</strong>
      <small>{label}</small>
    </div>
  );
}

function escapeReportHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));
}

function downloadReviewReport(review) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;

  let y = 20;

  const score = Number(review.compliance_score);
  const violations = Array.isArray(review.violations)
    ? review.violations : [];

  const rules = Array.isArray(review.rule_results)
    ? review.rule_results : [];

  const media = review.media_analysis || {};
  const speech = media.speech || media.speech_report;
  const audio = media.audio || media.audio_report;

  function checkPage(height = 12) {
    if (y + height > pageHeight - 18) {
      doc.addPage();
      y = 20;
    }
  }

  function heading(text) {
    checkPage(18);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(20, 45, 67);
    doc.text(text, margin, y);
    y += 9;
  }

  function paragraph(text, size = 9) {
    if (!text) return;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    doc.setTextColor(85, 100, 115);

    const lines = doc.splitTextToSize(
      String(text),
      contentWidth
    );

    const height = lines.length * 5;

    checkPage(height);

    doc.text(lines, margin, y);
    y += height + 4;
  }

  function divider() {
    checkPage(8);
    doc.setDrawColor(220, 229, 235);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;
  }

  // HEADER
  doc.setFillColor(17, 38, 60);
  doc.rect(0, 0, pageWidth, 43, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("BrandGuard AI", margin, 19);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("BRAND COMPLIANCE REVIEW REPORT", margin, 28);

  doc.setFontSize(8);
  doc.text(
    new Date().toLocaleString(),
    margin,
    36
  );

  y = 55;

  // COMPLIANCE SCORE
  heading("Compliance overview");

  doc.setFillColor(239, 247, 246);
  doc.roundedRect(
    margin,
    y,
    contentWidth,
    29,
    3,
    3,
    "F"
  );

  doc.setTextColor(10, 130, 115);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(25);

  doc.text(
    `${Number.isFinite(score) ? score : "—"}/100`,
    margin + 7,
    y + 13
  );

  doc.setFontSize(9);
  doc.setTextColor(65, 85, 100);

  doc.text(
    `Status: ${review.overall_status || "Needs review"}`,
    margin + 7,
    y + 22
  );

  // Gauge
  const gaugeX = pageWidth - margin - 18;
  const gaugeY = y + 14;

  doc.setDrawColor(220, 230, 235);
  doc.setLineWidth(3);
  doc.circle(gaugeX, gaugeY, 9);

  doc.setDrawColor(10, 159, 145);
  doc.setLineWidth(3);

  doc.circle(
    gaugeX,
    gaugeY,
    9,
    "S",
    Math.max(0, Math.min(100, score)) / 100 * 360
  );

  y += 39;

  // SUMMARY
  heading("Executive summary");
  paragraph(review.summary || "No summary available.");

  divider();

  // VIOLATIONS
  heading(`Issues to address (${violations.length})`);

  if (!violations.length) {
    paragraph("No confirmed violations were returned.");
  }

  violations.forEach((item, index) => {
    checkPage(35);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(30, 50, 70);

    doc.text(
      `${index + 1}. ${item.category || "Brand guideline"}`,
      margin,
      y
    );

    y += 7;

    paragraph(`Severity: ${item.severity || "Medium"}`);
    paragraph(item.issue || item.description || "No description available.");

    if (item.suggestion) {
      doc.setTextColor(10, 130, 100);
      paragraph(`Suggested correction: ${item.suggestion}`);
    }

    divider();
  });

  // RULE EVALUATION
  heading(`Guideline evaluation (${rules.length} rules)`);

  rules.forEach((rule) => {
    checkPage(22);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(30, 50, 70);

    doc.text(
      `Rule ${rule.rule_number ?? "—"}: ${rule.category || "Guideline"}`,
      margin,
      y
    );

    y += 6;

    paragraph(
      `Status: ${String(rule.status || "Unknown").replaceAll("_", " ")}`
    );

    paragraph(rule.evidence || "No evidence supplied.");

    divider();
  });

  // VIDEO AND SPEECH ANALYSIS
  if (media && Object.keys(media).length) {
    heading("Media analysis");

    paragraph(`File: ${media.filename || "Uploaded media"}`);

    paragraph(
      `Frames analysed: ${media.frames_analyzed ?? "—"}`
    );

    if (speech) {
      heading("Speech transcription");

      paragraph(
        speech.transcription ||
        speech.transcript ||
        speech.text ||
        "No transcript available."
      );

      if (speech.requires_human_review) {
        paragraph(
          "Human verification is recommended because uncertain speech segments were detected."
        );
      }
    }

    if (audio) {
      heading("Audio quality");

      paragraph(
        `Silence: ${audio.silence_percentage ?? "—"}%`
      );

      paragraph(
        `Clipping: ${audio.clipping_percentage ?? "—"}%`
      );
    }
  }

  // FOOTER ON EVERY PAGE
  const pageCount = doc.internal.getNumberOfPages();

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);

    doc.setFontSize(8);
    doc.setTextColor(130, 140, 150);

    doc.text(
      "BrandGuard AI | AI-assisted brand governance",
      margin,
      pageHeight - 9
    );

    doc.text(
      `Page ${i} of ${pageCount}`,
      pageWidth - margin,
      pageHeight - 9,
      { align: "right" }
    );
  }

  doc.save(
    `BrandGuard-Report-${new Date().toISOString().slice(0, 10)}.pdf`
  );
}

function ReviewResults({ review, summaryOnly = false, detailsOnly = false, onDownload }) {
  const score = Number(review.compliance_score);
  const violations = Array.isArray(review.violations) ? review.violations : [];
  const ruleResults = Array.isArray(review.rule_results) ? review.rule_results : [];
  const media = review.media_analysis;
  const speech = media?.speech || media?.speech_report;
  const audio = media?.audio || media?.audio_report;
  const evaluated = ruleResults.length;
  const compliant = ruleResults.filter((item) => item.status === "compliant").length;
  const issueRatio = evaluated ? (violations.length / evaluated) * 100 : 0;

  if (summaryOnly) return (
    <div className="results-content summary-only">
      <div className="result-score-panel">
        <div><span className="result-overline">OVERALL COMPLIANCE</span><div className="big-score">{Number.isFinite(score) ? score : "—"}<small>/100</small></div><StatusBadge status={review.overall_status} /></div>
        <ProviderBadge provider={review.ai_provider} />
        <SpeedometerGauge value={Number.isFinite(score) ? score : 0} label="Compliance" tone={score >= 80 ? "good" : score >= 60 ? "warning" : "risk"} suffix="%" />
      </div>
      {review.summary && <div className="summary-box"><strong>Executive summary</strong><p>{review.summary}</p></div>}
      <div className="result-metrics gauge-metrics">
        <SpeedometerGauge value={violations.length} max={Math.max(evaluated, violations.length, 1)} label="Detected issues" tone={violations.length ? "risk" : "good"} />
        <SpeedometerGauge value={evaluated} max={Math.max(evaluated, 1)} label="Rules evaluated" tone="blue" />
        <SpeedometerGauge value={compliant} max={Math.max(evaluated, 1)} label="Rules compliant" tone="good" />
      </div>
      <button className="button button-primary report-download-button" onClick={onDownload}><Download size={16} /> Download report</button>
    </div>
  );

  if (detailsOnly) return (
    <div className="results-content detailed-results">
      {violations.length > 0 ? <section className="result-section"><div className="result-section-heading"><h3>Issues to address</h3><span>{violations.length} found</span></div><div className="issues-grid">{violations.map((item, index) => <div className="issue-card" key={`${item.category}-${index}`}><div className="issue-top"><strong>{item.category || "Brand guideline"}</strong><span className={`severity-tag ${String(item.severity || "medium").toLowerCase()}`}>{item.severity || "Medium"}</span></div><p>{item.issue || item.description}</p>{item.suggestion && <div className="suggestion-box"><strong>Suggested correction</strong><p>{item.suggestion}</p></div>}</div>)}</div></section> :
        <div className="no-issues"><CheckCircle2 size={17} /><span>No confirmed violations were returned by the analysis.</span></div>}

      {ruleResults.length > 0 && <details className="details-section" open><summary>Guideline-by-guideline evaluation ({ruleResults.length})</summary><div className="rule-list">{ruleResults.map((item) => <div className="rule-row" key={item.rule_number}><div><strong>Rule {item.rule_number}: {item.category}</strong><p>{item.evidence || "No evidence supplied."}</p></div><span className={`rule-status ${item.status === "compliant" ? "good" : item.status === "violation" ? "bad" : "uncertain"}`}>{String(item.status || "unknown").replaceAll("_", " ")}</span></div>)}</div></details>}

      {review.corrected_content && <div className="correction-panel"><div className="result-section-heading"><h3>{review.correction_withheld ? "Correction withheld" : "Suggested corrected content"}</h3></div>{review.correction_withheld && <p className="withheld-note">The generated correction did not pass validation. The original content has been preserved for human review.</p>}<p className="corrected-copy">{review.corrected_content}</p>{!review.correction_withheld && <button className="button button-outline button-small" onClick={() => navigator.clipboard?.writeText(review.corrected_content)}>Copy corrected content</button>}</div>}

      {media && <details className="details-section media-details" open><summary><Video size={16} /> Video, speech and audio diagnostics</summary><div className="media-grid"><div><span>File</span><strong>{media.filename || "Uploaded video"}</strong></div><div><span>Duration</span><strong>{media.metadata?.duration != null ? `${Number(media.metadata.duration).toFixed(1)} sec` : "—"}</strong></div><div><span>Resolution</span><strong>{media.metadata?.width && media.metadata?.height ? `${media.metadata.width} × ${media.metadata.height}` : "—"}</strong></div><div><span>Frames analysed</span><strong>{media.frames_analyzed ?? "—"}</strong></div></div>
        {speech && <div className="diagnostic-block"><h4>Speech transcription</h4><p>{speech.transcription || speech.transcript || speech.text || "No transcript available."}</p>{speech.requires_human_review && <div className="uncertain-warning"><AlertTriangle size={15} /> Some speech segments are uncertain. Verify the transcript before making a final decision.</div>}{Array.isArray(speech.uncertain_segments) && speech.uncertain_segments.length > 0 && <div className="uncertain-list"><strong>Segments requiring verification</strong>{speech.uncertain_segments.map((segment, index) => <span key={index}>{typeof segment === "string" ? segment : segment.word || segment.text || JSON.stringify(segment)}</span>)}</div>}</div>}
        {audio && <div className="diagnostic-block"><h4>Audio quality</h4><div className="media-grid"><div><span>Silence</span><strong>{audio.silence_percentage ?? "—"}%</strong></div><div><span>Clipping</span><strong>{audio.clipping_percentage ?? "—"}%</strong></div></div>{audio.quality_warnings?.map((warning, index) => <p className="audio-warning" key={index}><AlertTriangle size={13} /> {warning}</p>)}</div>}
      </details>}
    </div>
  );

  return null;
}

export default App;
