import { useEffect, useState } from 'react';
import api from '../../api/axios';
import useDebounce from '../../hooks/useDebounce';
import UserResultCard from './UserResultCard';

function UserSearch({ hideHeading = false, hideIdleHelper = false }) {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('Type at least 1 character to search usernames.');
  const debouncedQuery = useDebounce(query, 350);

  useEffect(() => {
    const trimmed = debouncedQuery.trim();

    if (!trimmed) {
      setUsers([]);
      setMessage('Type at least 1 character to search usernames.');
      return;
    }

    const run = async () => {
      setIsLoading(true);
      try {
        const response = await api.get('/users/search', { params: { username: trimmed } });
        const nextUsers = response.data.data.users;
        setUsers(nextUsers);
        setMessage(nextUsers.length === 0 ? 'No users found.' : '');
      } catch (err) {
        setUsers([]);
        setMessage(err?.response?.data?.message || 'Search failed. Try again.');
      } finally {
        setIsLoading(false);
      }
    };

    run();
  }, [debouncedQuery]);

  function handleOptimisticFollow(userId, isFollowing) {
    setUsers((prev) =>
      prev.map((item) => {
        if (item.id !== userId) return item;
        const nextFollowersCount = Math.max(0, (item.followersCount || 0) + (isFollowing ? 1 : -1));
        return {
          ...item,
          isFollowing,
          followersCount: nextFollowersCount,
        };
      })
    );
  }

  return (
    <section className="user-search">
      {!hideHeading && <h3>Search users</h3>}

      <label className="user-search-field search-input-field">
        <span>Username</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by username"
          aria-label="Search users by username"
        />
      </label>

      {isLoading && <p className="search-note">Searching...</p>}
      {!isLoading && message && (!hideIdleHelper || query.trim()) && <p className="search-note">{message}</p>}

      <ul className="search-results">
        {users.map((u) => (
          <UserResultCard key={u.id} user={u} onOptimisticChange={handleOptimisticFollow} />
        ))}
      </ul>
    </section>
  );
}

export default UserSearch;
