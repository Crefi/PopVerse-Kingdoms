import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { getMyProfile, getMyMarches, getIncomingAttacks } from '../services/api';
import type { March } from '../types';

interface PlayerProfile {
  username: string;
  faction: string;
  coordinates: { x: number; y: number };
  resources: { food: number; iron: number; gold: number };
  diamonds: number;
  arenaRating: number;
  power: number;
  troops: Record<string, number>;
  buildings: Record<string, number>;
  guild?: { id: string; name: string };
}

export default function Dashboard() {
  const { user } = useAuthStore();
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [marches, setMarches] = useState<March[]>([]);
  const [incoming, setIncoming] = useState<March[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [profileRes, marchesRes, incomingRes] = await Promise.all([
          getMyProfile(),
          getMyMarches(),
          getIncomingAttacks(),
        ]);
        setProfile(profileRes.data);
        setMarches(marchesRes.data);
        setIncoming(incomingRes.data);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <div className="text-gray-400">Loading dashboard...</div>
      </div>
    );
  }

  const factionColors: Record<string, string> = {
    cinema: 'text-cinema',
    otaku: 'text-otaku',
    arcade: 'text-arcade',
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <Link
          to="/map"
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          View World Map
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Resources */}
        <div className="bg-gray-800 rounded-xl p-4">
          <h3 className="text-gray-400 text-sm mb-3">Resources</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-yellow-500">🌾 Food</span>
              <span className="text-white">{profile?.resources.food.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">⚙️ Iron</span>
              <span className="text-white">{profile?.resources.iron.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-yellow-400">💰 Gold</span>
              <span className="text-white">{profile?.resources.gold.toLocaleString()}</span>
            </div>
            <div className="flex justify-between border-t border-gray-700 pt-2 mt-2">
              <span className="text-blue-400">💎 Diamonds</span>
              <span className="text-white">{profile?.diamonds.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Player Info */}
        <div className="bg-gray-800 rounded-xl p-4">
          <h3 className="text-gray-400 text-sm mb-3">Player Info</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-400">Faction</span>
              <span className={`capitalize ${factionColors[user?.faction || '']}`}>
                {user?.faction}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Location</span>
              <span className="text-white">
                ({profile?.coordinates.x}, {profile?.coordinates.y})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Power</span>
              <span className="text-white">{profile?.power?.toLocaleString() || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Arena Rating</span>
              <span className="text-white">{profile?.arenaRating}</span>
            </div>
          </div>
        </div>

        {/* Troops */}
        <div className="bg-gray-800 rounded-xl p-4">
          <h3 className="text-gray-400 text-sm mb-3">Troops</h3>
          <div className="space-y-2">
            {profile?.troops && Object.entries(profile.troops).length > 0 ? (
              Object.entries(profile.troops).map(([type, count]) => (
                <div key={type} className="flex justify-between">
                  <span className="text-gray-400 capitalize">{type.replace('_', ' ')}</span>
                  <span className="text-white">{count.toLocaleString()}</span>
                </div>
              ))
            ) : (
              <div className="text-gray-500 text-sm">No troops trained</div>
            )}
          </div>
        </div>

        {/* Guild */}
        <div className="bg-gray-800 rounded-xl p-4">
          <h3 className="text-gray-400 text-sm mb-3">Guild</h3>
          {profile?.guild ? (
            <div className="space-y-2">
              <div className="text-white font-medium">{profile.guild.name}</div>
            </div>
          ) : (
            <div className="text-gray-500 text-sm">Not in a guild</div>
          )}
        </div>
      </div>

      {/* Active Marches */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-800 rounded-xl p-4">
          <h3 className="text-white font-medium mb-4">Your Active Marches</h3>
          {marches.length > 0 ? (
            <div className="space-y-3">
              {marches.map((march) => (
                <div
                  key={march.id}
                  className="bg-gray-700 rounded-lg p-3 flex justify-between items-center"
                >
                  <div>
                    <div className="text-white capitalize">{march.type}</div>
                    <div className="text-sm text-gray-400">
                      To ({march.targetX}, {march.targetY})
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-400">
                      Arrives: {new Date(march.arrivalTime).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-gray-500 text-sm">No active marches</div>
          )}
        </div>

        {/* Incoming Attacks */}
        <div className="bg-gray-800 rounded-xl p-4">
          <h3 className="text-white font-medium mb-4">
            Incoming Attacks
            {incoming.length > 0 && (
              <span className="ml-2 bg-red-600 text-white text-xs px-2 py-1 rounded-full">
                {incoming.length}
              </span>
            )}
          </h3>
          {incoming.length > 0 ? (
            <div className="space-y-3">
              {incoming.map((march) => (
                <div
                  key={march.id}
                  className="bg-red-900/30 border border-red-800 rounded-lg p-3 flex justify-between items-center"
                >
                  <div>
                    <div className="text-red-400">{march.playerName}</div>
                    <div className="text-sm text-gray-400">
                      From ({march.originX}, {march.originY})
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-red-400">
                      Arrives: {new Date(march.arrivalTime).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-gray-500 text-sm">No incoming attacks</div>
          )}
        </div>
      </div>
    </div>
  );
}
