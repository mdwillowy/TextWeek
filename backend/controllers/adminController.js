import { UserReport } from '../models/UserReport.js';

export async function listReports(req, res, next) {
  try {
    const pageRaw = Number(req.query.page || 1);
    const pageSizeRaw = Number(req.query.pageSize || 20);
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
    const pageSize = Number.isFinite(pageSizeRaw) && pageSizeRaw > 0
      ? Math.min(pageSizeRaw, 100)
      : 20;
    const skip = (page - 1) * pageSize;

    const total = await UserReport.countDocuments();
    const reports = await UserReport.find({})
      .populate('reporter', 'fullName username avatarUrl')
      .populate('targetUser', 'fullName username avatarUrl')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean();

    console.log('[admin_audit] reports_list', {
      adminUserId: String(req.authUser?._id || ''),
      ip: String(req.ip || ''),
      at: new Date().toISOString(),
      page,
      pageSize,
    });

    return res.json({
      success: true,
      data: {
        page,
        pageSize,
        total,
        reports: reports.map((report) => ({
          id: String(report._id),
          reporter: report.reporter
            ? {
                id: String(report.reporter._id),
                fullName: report.reporter.fullName,
                username: report.reporter.username,
                avatarUrl: report.reporter.avatarUrl || '',
              }
            : null,
          targetUser: report.targetUser
            ? {
                id: String(report.targetUser._id),
                fullName: report.targetUser.fullName,
                username: report.targetUser.username,
                avatarUrl: report.targetUser.avatarUrl || '',
              }
            : null,
          reason: report.reason,
          details: report.details || '',
          status: report.status,
          createdAt: report.createdAt,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
}
