import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { getDiscordAuthUrl } from '../services/api';

export default function Login() {
  const navigate = useNavigate();
  const { devLoginWithId, isLoading, error } = useAuthStore();
  const [devDiscordId, setDevDiscordId] = useState('');
  const [showDevLogin, setShowDevLogin] = useState(false);

  const handleDiscordLogin = async () => {
    try {
      const { data } = await getDiscordAuthUrl();
      window.location.href = data.url + '&redirect=true';
    } catch (err) {
      console.error('Failed to get Discord auth URL:', err);
    }
  };

  const handleDevLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!devDiscordId.trim()) return;
    try {
      await devLoginWithId(devDiscordId.trim());
      navigate('/');
    } catch {
      // Error is handled in store
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-gray-800 rounded-xl p-8 shadow-xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">PopVerse Kingdoms</h1>
          <p className="text-gray-400">Web Dashboard</p>
        </div>

        <button
          onClick={handleDiscordLogin}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center gap-3 transition-colors"
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
          </svg>
          Login with Discord
        </button>

        <div className="mt-6 text-center">
          <button
            onClick={() => setShowDevLogin(!showDevLogin)}
            className="text-sm text-gray-500 hover:text-gray-400"
          >
            {showDevLogin ? 'Hide' : 'Show'} Dev Login
          </button>
        </div>

        {showDevLogin && (
          <form onSubmit={handleDevLogin} className="mt-4 space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Discord ID</label>
              <input
                type="text"
                value={devDiscordId}
                onChange={(e) => setDevDiscordId(e.target.value)}
                placeholder="Enter your Discord ID"
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Logging in...' : 'Dev Login'}
            </button>
            <p className="text-xs text-gray-500 text-center">
              Use your Discord ID (not username). You must have registered via /begin first.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
