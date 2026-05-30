import api from './axios';

export async function followUser(targetUserId) {
  const response = await api.post(`/follows/${targetUserId}`);
  return response.data;
}

export async function unfollowUser(targetUserId) {
  const response = await api.delete(`/follows/${targetUserId}`);
  return response.data;
}

export async function removeFollower(followerUserId) {
  const response = await api.delete(`/follows/followers/${followerUserId}`);
  return response.data;
}

export async function getFollowers(userId, params = {}) {
  const response = await api.get(`/follows/followers/${userId}`, { params });
  return response.data;
}

export async function getFollowing(userId, params = {}) {
  const response = await api.get(`/follows/following/${userId}`, { params });
  return response.data;
}

export async function getFollowStatus(userId) {
  const response = await api.get(`/follows/status/${userId}`);
  return response.data;
}
