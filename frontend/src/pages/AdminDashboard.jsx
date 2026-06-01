import { useEffect, useState } from 'react';
import { approveDeletionRequest, cancelDeletionRequest, getAdminReports, getDeletionRequests } from '../api/admin';
import { resolveUploadImageUrl } from '../utils/uploadUrl';

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString();
}

function ReportRow({ report }) {
  const reporter = report.reporter || {};
  const target = report.targetUser || {};
  const reporterAvatar = resolveUploadImageUrl(reporter.avatarUrl || '');
  const targetAvatar = resolveUploadImageUrl(target.avatarUrl || '');

  return (
    <article className="admin-report-card">
      <header className="admin-report-header">
        <div className="admin-report-user">
          <div className="admin-report-avatar">
            {reporterAvatar ? (
              <img src={reporterAvatar} alt="Reporter avatar" />
            ) : (
              <span>{String(reporter.fullName || reporter.username || '?')[0]}</span>
            )}
          </div>
          <div>
            <strong>{reporter.fullName || 'Unknown reporter'}</strong>
            <div className="admin-report-handle">@{reporter.username || 'unknown'}</div>
          </div>
        </div>
        <div className="admin-report-meta">
          <span className="admin-report-status">{report.status}</span>
          <span className="admin-report-date">{formatDate(report.createdAt)}</span>
        </div>
      </header>
      <div className="admin-report-body">
        <p><strong>Reason:</strong> {report.reason}</p>
        {report.details ? <p><strong>Details:</strong> {report.details}</p> : null}
      </div>
      <footer className="admin-report-footer">
        <span>Target:</span>
        <div className="admin-report-user">
          <div className="admin-report-avatar">
            {targetAvatar ? (
              <img src={targetAvatar} alt="Target avatar" />
            ) : (
              <span>{String(target.fullName || target.username || '?')[0]}</span>
            )}
          </div>
          <div>
            <strong>{target.fullName || 'Unknown user'}</strong>
            <div className="admin-report-handle">@{target.username || 'unknown'}</div>
          </div>
        </div>
      </footer>
    </article>
  );
}

function AdminDashboard() {
  const [reports, setReports] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletionRequests, setDeletionRequests] = useState([]);
  const [deletionError, setDeletionError] = useState('');
  const [deletionLoading, setDeletionLoading] = useState(true);
  const [deletionActionId, setDeletionActionId] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function loadReports() {
      try {
        setIsLoading(true);
        setError('');
        const response = await getAdminReports({ page, pageSize });
        const rows = response?.data?.reports || [];
        const nextTotal = Number(response?.data?.total || 0);
        if (isMounted) {
          setReports(rows);
          setTotal(nextTotal);
        }
      } catch (err) {
        if (isMounted) {
          setError(err?.response?.data?.message || 'Unable to load reports');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadReports();

    return () => {
      isMounted = false;
    };
  }, [page, pageSize]);

  useEffect(() => {
    let isMounted = true;

    async function loadDeletionRequests() {
      try {
        setDeletionLoading(true);
        setDeletionError('');
        const response = await getDeletionRequests({ page: 1, pageSize: 20 });
        const rows = response?.data?.users || [];
        if (isMounted) {
          setDeletionRequests(rows);
        }
      } catch (err) {
        if (isMounted) {
          setDeletionError(err?.response?.data?.message || 'Unable to load deletion requests');
        }
      } finally {
        if (isMounted) {
          setDeletionLoading(false);
        }
      }
    }

    loadDeletionRequests();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleApproveDeletion(userId) {
    if (!userId) return;
    const confirmed = window.confirm('Approve and permanently delete this account?');
    if (!confirmed) return;

    setDeletionActionId(userId);
    setDeletionError('');
    try {
      await approveDeletionRequest(userId);
      setDeletionRequests((prev) => prev.filter((row) => row.id !== userId));
    } catch (err) {
      setDeletionError(err?.response?.data?.message || 'Unable to approve deletion request');
    } finally {
      setDeletionActionId('');
    }
  }

  async function handleCancelDeletion(userId) {
    if (!userId) return;
    const confirmed = window.confirm('Cancel this deletion request?');
    if (!confirmed) return;

    setDeletionActionId(userId);
    setDeletionError('');
    try {
      await cancelDeletionRequest(userId);
      setDeletionRequests((prev) => prev.filter((row) => row.id !== userId));
    } catch (err) {
      setDeletionError(err?.response?.data?.message || 'Unable to cancel deletion request');
    } finally {
      setDeletionActionId('');
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <section className="admin-dashboard-page">
      <section className="admin-deletion-section">
        <header className="admin-section-header">
          <h2>Account Deletion Requests</h2>
          <p>Approve requests to permanently remove accounts.</p>
        </header>

        {deletionLoading ? <p className="screen-loader">Loading deletion requests...</p> : null}
        {deletionError ? <p className="field-error">{deletionError}</p> : null}

        {!deletionLoading && !deletionError && deletionRequests.length === 0 ? (
          <p className="empty-state">No deletion requests pending.</p>
        ) : null}

        <div className="admin-deletion-list">
          {deletionRequests.map((request) => (
            <article className="admin-deletion-card" key={request.id}>
              <div className="admin-deletion-main">
                <strong>{request.fullName || 'Unknown user'}</strong>
                <div className="admin-deletion-handle">@{request.username || 'unknown'}</div>
                <small>Requested: {formatDate(request.deletionRequestedAt)}</small>
              </div>
              <div className="admin-deletion-actions">
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={() => handleCancelDeletion(request.id)}
                  disabled={deletionActionId === request.id}
                >
                  {deletionActionId === request.id ? 'Updating...' : 'Cancel'}
                </button>
                <button
                  className="btn-primary"
                  type="button"
                  onClick={() => handleApproveDeletion(request.id)}
                  disabled={deletionActionId === request.id}
                >
                  {deletionActionId === request.id ? 'Deleting...' : 'Approve & Delete'}
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="admin-reports-section">
        <header className="admin-section-header">
          <h2>Reports</h2>
          <p>Moderation reports submitted by users.</p>
        </header>

      {isLoading ? <p className="screen-loader">Loading reports...</p> : null}
      {error ? <p className="field-error">{error}</p> : null}

      {!isLoading && !error && reports.length === 0 ? (
        <p className="empty-state">No reports submitted yet.</p>
      ) : null}

      <div className="admin-report-list">
        {reports.map((report) => (
          <ReportRow key={report.id} report={report} />
        ))}
      </div>

        <div className="admin-report-pagination">
        <span className="admin-pagination-meta">Page {page} / {totalPages}</span>
        <button
          type="button"
          className="btn-ghost admin-pagination-btn"
          onClick={() => setPage((prev) => Math.max(1, prev - 1))}
          disabled={!hasPrev || isLoading}
          aria-label="Previous page"
          title="Previous"
        >
          &lt;
        </button>
        <button
          type="button"
          className="btn-ghost admin-pagination-btn"
          onClick={() => setPage((prev) => prev + 1)}
          disabled={!hasNext || isLoading}
          aria-label="Next page"
          title="Next"
        >
          &gt;
        </button>
        </div>
      </section>
    </section>
  );
}

export default AdminDashboard;
