(() => {
  const originalRequest = request;
  let refreshPromise = null;

  function persistSession(nextSession) {
    session = nextSession;
    user = nextSession?.user || null;
    if (nextSession) localStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
    else localStorage.removeItem(SESSION_KEY);
  }

  async function refreshAccessToken() {
    if (!session?.refresh_token) return false;
    if (refreshPromise) return refreshPromise;

    refreshPromise = (async () => {
      try {
        const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
          method: 'POST',
          headers: {
            apikey: SUPABASE_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ refresh_token: session.refresh_token })
        });
        const data = await response.json();
        if (!response.ok || !data?.access_token) throw new Error(data?.message || 'Refresh token gagal');
        persistSession(data);
        return true;
      } catch (error) {
        console.warn('Sesi tidak dapat diperbarui', error);
        persistSession(null);
        return false;
      } finally {
        refreshPromise = null;
      }
    })();

    return refreshPromise;
  }

  request = async function requestWithRefresh(path, options = {}, useAuth = true, allowRetry = true) {
    try {
      return await originalRequest(path, options, useAuth);
    } catch (error) {
      const isJwtError = useAuth && /jwt|token|expired|401/i.test(error?.message || '');
      if (allowRetry && isJwtError && await refreshAccessToken()) {
        return requestWithRefresh(path, options, useAuth, false);
      }

      if (isJwtError) {
        persistSession(null);
        currentDay = null;
        await applySession();
        throw new Error('Sesi login berakhir. Silakan masuk kembali.');
      }
      throw error;
    }
  };

  (async () => {
    if (!session?.refresh_token) return;
    const refreshed = await refreshAccessToken();
    if (refreshed) await applySession();
    else await applySession();
  })();
})();
