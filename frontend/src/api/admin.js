import api from './axios';

export async function getAdminReports({ page = 1, pageSize = 20 } = {}) {
  const response = await api.get('/admin/reports', {
    params: { page, pageSize },
  });
  return response.data;
}

export async function getDeletionRequests({ page = 1, pageSize = 20 } = {}) {
  const response = await api.get('/admin/deletion-requests', {
    params: { page, pageSize },
  });
  return response.data;
}

export async function approveDeletionRequest(userId) {
  const response = await api.post(`/admin/deletion-requests/${userId}/approve`);
  return response.data;
}

export async function cancelDeletionRequest(userId) {
  const response = await api.post(`/admin/deletion-requests/${userId}/cancel`);
  return response.data;
}
