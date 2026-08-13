export function sanitizeUser(userDoc) {
  const source = userDoc.toObject ? userDoc.toObject() : userDoc;

  return {
    id: String(source._id),
    fullName: source.fullName,
    dateOfBirth: source.dateOfBirth,
    gender: source.gender,
    username: source.username,
    phoneNumber: source.phoneNumber || '',
    bio: source.bio || '',
    avatarUrl: source.avatarUrl || '',
    role: source.role || 'user',
    followersCount: source.followersCount || 0,
    followingCount: source.followingCount || 0,
    isPhoneVerified: Boolean(source.isPhoneVerified),
    isPrivate: Boolean(source.isPrivate),
    isOnline: Boolean(source.isOnline),
    lastSeen: source.lastSeen || null,
    settings: {
      readReceiptsEnabled: source.settings?.readReceiptsEnabled ?? true,
      showOnlineStatus: source.settings?.showOnlineStatus ?? true,
      theme: source.settings?.theme || 'system',
    },
    deletionRequestedAt: source.deletionRequestedAt || null,
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
  };
}
