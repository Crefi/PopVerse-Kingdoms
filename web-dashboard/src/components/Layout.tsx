import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

const navItems = [
  { path: '/', label: 'Dashboard', icon: '🏠' },
  { path: '/map', label: 'World Map', icon: '🗺️' },
  { path: '/leaderboards', label: 'Leaderboards', icon: '🏆' },
  { path: '/battles', label: 'Battle History', icon: '⚔️' },
];

export default function Layout() {
  const { user, logout } = useAuthStore();
  const location = useLocation();

  const factionColors: Record<string, string> = {
    cinema: 'bg-cinema',
    otaku: 'bg-otaku',
    arcade: 'bg-arcade',
  };

  return (
    <div className="min-h-screen bg-gray-900 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <h1 className="text-xl font-bold text-white">PopVerse Kingdoms</h1>
        </div>

        {/* User Info */}
        {user && (
          <div className="p-4 border-b border-gray-700">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-full ${factionColors[user.faction]} flex items-center justify-center text-white font-bold`}
              >
                {user.username[0].toUpperCase()}
              </div>
              <div>
                <div className="text-white font-medium">{user.username}</div>
                <div className="text-sm text-gray-400 capitalize">{user.faction}</div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            {navItems.map((item) => (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                    location.pathname === item.path
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-gray-700">
          <button
            onClick={logout}
            className="w-full px-4 py-2 text-gray-300 hover:bg-gray-700 rounded-lg transition-colors"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
