import api from './axios';

export async function getAdminReports({ page = 1, pageSize = 20 } = {}) {
  const response = await api.get('/admin/reports', {
    params: { page, pageSize },
  });
  return response.data;
}
