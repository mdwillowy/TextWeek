import api from './axios';

export async function listBlockedUsers() {
  const response = await api.get('/moderation/blocks');
  return response.data;
}

export async function blockUser(targetUserId) {
  const response = await api.post(`/moderation/blocks/${targetUserId}`);
  return response.data;
}

export async function unblockUser(targetUserId) {
  const response = await api.delete(`/moderation/blocks/${targetUserId}`);
  return response.data;
}

export async function getBlockStatus(targetUserId) {
  const response = await api.get(`/moderation/blocks/${targetUserId}/status`);
  return response.data;
}

export async function reportUser({ username, reason, details }) {
  const response = await api.post('/moderation/reports', {
    targetUsername: username,
    reason,
    details: details || '',
  });
  return response.data;
}
