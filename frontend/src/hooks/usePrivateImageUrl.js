import { useEffect, useMemo, useRef, useState } from 'react';
import api from '../api/axios';
import { isPrivateUploadUrl, resolveUploadUrl } from '../utils/uploadUrl';

export function usePrivateImageUrl(src) {
  const resolved = useMemo(() => resolveUploadUrl(src), [src]);
  const shouldFetch = useMemo(() => isPrivateUploadUrl(resolved), [resolved]);
  const [blobUrl, setBlobUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const activeUrlRef = useRef('');

  useEffect(() => {
    let isActive = true;

    if (!resolved) {
      setBlobUrl('');
      setIsLoading(false);
      return () => undefined;
    }

    if (!shouldFetch) {
      setBlobUrl('');
      setIsLoading(false);
      return () => undefined;
    }

    setIsLoading(true);
    api
      .get(resolved, { baseURL: '', responseType: 'blob' })
      .then((response) => {
        if (!isActive) return;
        const objectUrl = URL.createObjectURL(response.data);
        if (activeUrlRef.current) {
          URL.revokeObjectURL(activeUrlRef.current);
        }
        activeUrlRef.current = objectUrl;
        setBlobUrl(objectUrl);
      })
      .catch(() => {
        if (!isActive) return;
        setBlobUrl('');
      })
      .finally(() => {
        if (!isActive) return;
        setIsLoading(false);
      });

    return () => {
      isActive = false;
      if (activeUrlRef.current) {
        URL.revokeObjectURL(activeUrlRef.current);
        activeUrlRef.current = '';
      }
    };
  }, [resolved]);

  return {
    url: shouldFetch ? blobUrl : resolved,
    resolvedUrl: resolved,
    isPrivate: shouldFetch,
    isLoading,
  };
}
