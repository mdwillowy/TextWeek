export function sortParticipantIds(idA, idB) {
  const first = String(idA);
  const second = String(idB);
  return [first, second].sort();
}

export function buildParticipantKey(idA, idB) {
  return sortParticipantIds(idA, idB).join(':');
}
