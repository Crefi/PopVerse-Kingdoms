import { useEffect, useState } from 'react';
import {
  getArenaLeaderboard,
  getPowerLeaderboard,
  getGuildLeaderboard,
  getFactionStats,
} from '../services/api';
import type { LeaderboardEntry } from '../types';

type Tab = 'arena' | 'power' | 'guilds' | 'factions';

interface GuildEntry {
  rank: number;
  id: string;
  name: string;
  memberCount: number;
  totalPower: number;
}

interface FactionStats {
  faction: string;
  playerCount: number;
  totalPower: number;
  avgArenaRating: number;
}

export default function Leaderboards() {
  const [activeTab, setActiveTab] = useState<Tab>('arena');
  const [arenaData, setArenaData] = useState<LeaderboardEntry[]>([]);
  const [powerData, setPowerData] = useState<LeaderboardEntry[]>([]);
  const [guildData, setGuildData] = useState<GuildEntry[]>([]);
  const [factionData, setFactionData] = useState<FactionStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        switch (activeTab) {
          case 'arena':
            const arenaRes = await getArenaLeaderboard();
            setArenaData(arenaRes.data);
            break;
          case 'power':
            const powerRes = await getPowerLeaderboard();
            setPowerData(powerRes.data);
            break;
          case 'guilds':
            const guildRes = await getGuildLeaderboard();
            setGuildData(guildRes.data);
            break;
          case 'factions':
            const factionRes = await getFactionStats();
            setFactionData(factionRes.data);
            break;
        }
      } catch (error) {
        console.error('Failed to fetch leaderboard:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [activeTab]);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'arena', label: 'Arena' },
    { id: 'power', label: 'Power' },
    { id: 'guilds', label: 'Guilds' },
    { id: 'factions', label: 'Factions' },
  ];

  const factionColors: Record<string, string> = {
    cinema: 'text-cinema',
    otaku: 'text-otaku',
    arcade: 'text-arcade',
  };

  const factionBgColors: Record<string, string> = {
    cinema: 'bg-cinema/20',
    otaku: 'bg-otaku/20',
    arcade: 'bg-arcade/20',
  };

  const renderRankBadge = (rank: number) => {
    if (rank === 1) return <span className="text-yellow-400">🥇</span>;
    if (rank === 2) return <span className="text-gray-300">🥈</span>;
    if (rank === 3) return <span className="text-amber-600">🥉</span>;
    return <span className="text-gray-500">#{rank}</span>;
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-white">Leaderboards</h1>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-700 pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg transition-colors ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:bg-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="bg-gray-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : (
          <>
            {/* Arena Leaderboard */}
            {activeTab === 'arena' && (
              <table className="w-full">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-gray-400">Rank</th>
                    <th className="px-4 py-3 text-left text-gray-400">Player</th>
                    <th className="px-4 py-3 text-left text-gray-400">Faction</th>
                    <th className="px-4 py-3 text-right text-gray-400">Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {arenaData.map((entry) => (
                    <tr key={entry.id} className="border-t border-gray-700 hover:bg-gray-700/50">
                      <td className="px-4 py-3">{renderRankBadge(entry.rank)}</td>
                      <td className="px-4 py-3 text-white">{entry.username}</td>
                      <td className={`px-4 py-3 capitalize ${factionColors[entry.faction]}`}>
                        {entry.faction}
                      </td>
                      <td className="px-4 py-3 text-right text-white">{entry.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Power Leaderboard */}
            {activeTab === 'power' && (
              <table className="w-full">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-gray-400">Rank</th>
                    <th className="px-4 py-3 text-left text-gray-400">Player</th>
                    <th className="px-4 py-3 text-left text-gray-400">Faction</th>
                    <th className="px-4 py-3 text-right text-gray-400">Power</th>
                  </tr>
                </thead>
                <tbody>
                  {powerData.map((entry) => (
                    <tr key={entry.id} className="border-t border-gray-700 hover:bg-gray-700/50">
                      <td className="px-4 py-3">{renderRankBadge(entry.rank)}</td>
                      <td className="px-4 py-3 text-white">{entry.username}</td>
                      <td className={`px-4 py-3 capitalize ${factionColors[entry.faction]}`}>
                        {entry.faction}
                      </td>
                      <td className="px-4 py-3 text-right text-white">
                        {entry.value.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Guild Leaderboard */}
            {activeTab === 'guilds' && (
              <table className="w-full">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-gray-400">Rank</th>
                    <th className="px-4 py-3 text-left text-gray-400">Guild</th>
                    <th className="px-4 py-3 text-center text-gray-400">Members</th>
                    <th className="px-4 py-3 text-right text-gray-400">Total Power</th>
                  </tr>
                </thead>
                <tbody>
                  {guildData.map((entry) => (
                    <tr key={entry.id} className="border-t border-gray-700 hover:bg-gray-700/50">
                      <td className="px-4 py-3">{renderRankBadge(entry.rank)}</td>
                      <td className="px-4 py-3 text-white">{entry.name}</td>
                      <td className="px-4 py-3 text-center text-gray-400">{entry.memberCount}</td>
                      <td className="px-4 py-3 text-right text-white">
                        {entry.totalPower.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Faction Stats */}
            {activeTab === 'factions' && (
              <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                {factionData.map((faction) => (
                  <div
                    key={faction.faction}
                    className={`rounded-xl p-6 ${factionBgColors[faction.faction]} border border-gray-700`}
                  >
                    <h3 className={`text-xl font-bold capitalize ${factionColors[faction.faction]}`}>
                      {faction.faction}
                    </h3>
                    <div className="mt-4 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Players</span>
                        <span className="text-white">{faction.playerCount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Total Power</span>
                        <span className="text-white">{faction.totalPower.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Avg Arena Rating</span>
                        <span className="text-white">{Math.round(faction.avgArenaRating)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
