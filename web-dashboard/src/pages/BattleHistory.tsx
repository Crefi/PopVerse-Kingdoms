import { useEffect, useState } from 'react';
import { getMyBattles } from '../services/api';
import { useAuthStore } from '../store/authStore';
import type { Battle } from '../types';

export default function BattleHistory() {
  const { user } = useAuthStore();
  const [battles, setBattles] = useState<Battle[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBattle, setSelectedBattle] = useState<Battle | null>(null);

  useEffect(() => {
    const fetchBattles = async () => {
      try {
        const { data } = await getMyBattles();
        setBattles(data);
      } catch (error) {
        console.error('Failed to fetch battles:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchBattles();
  }, []);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <div className="text-gray-400">Loading battle history...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-white">Battle History</h1>

      {battles.length === 0 ? (
        <div className="bg-gray-800 rounded-xl p-8 text-center text-gray-400">
          No battles yet. Attack other players or NPCs to see your battle history here.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Battle List */}
          <div className="bg-gray-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-gray-700">
              <h2 className="text-white font-medium">Recent Battles</h2>
            </div>
            <div className="divide-y divide-gray-700 max-h-[600px] overflow-y-auto">
              {battles.map((battle) => {
                const isAttacker = battle.attackerId === user?.playerId;
                const won =
                  (isAttacker && battle.winner === 'attacker') ||
                  (!isAttacker && battle.winner === 'defender');

                return (
                  <button
                    key={battle.id}
                    onClick={() => setSelectedBattle(battle)}
                    className={`w-full p-4 text-left hover:bg-gray-700/50 transition-colors ${
                      selectedBattle?.id === battle.id ? 'bg-gray-700' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={won ? 'text-green-400' : 'text-red-400'}>
                            {won ? '✓ Victory' : '✗ Defeat'}
                          </span>
                          <span className="text-gray-500">•</span>
                          <span className="text-gray-400 text-sm">
                            {isAttacker ? 'Attack' : 'Defense'}
                          </span>
                        </div>
                        <div className="text-white mt-1">
                          vs {isAttacker ? battle.defenderName : battle.attackerName}
                        </div>
                      </div>
                      <div className="text-sm text-gray-500">
                        {new Date(battle.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Battle Details */}
          <div className="bg-gray-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-gray-700">
              <h2 className="text-white font-medium">Battle Details</h2>
            </div>
            {selectedBattle ? (
              <div className="p-4 space-y-4">
                {/* Participants */}
                <div className="grid grid-cols-2 gap-4">
                  <div
                    className={`p-4 rounded-lg ${
                      selectedBattle.winner === 'attacker'
                        ? 'bg-green-900/30 border border-green-800'
                        : 'bg-red-900/30 border border-red-800'
                    }`}
                  >
                    <div className="text-sm text-gray-400">Attacker</div>
                    <div className="text-white font-medium">{selectedBattle.attackerName}</div>
                    {selectedBattle.winner === 'attacker' && (
                      <div className="text-green-400 text-sm mt-1">Winner</div>
                    )}
                  </div>
                  <div
                    className={`p-4 rounded-lg ${
                      selectedBattle.winner === 'defender'
                        ? 'bg-green-900/30 border border-green-800'
                        : 'bg-red-900/30 border border-red-800'
                    }`}
                  >
                    <div className="text-sm text-gray-400">Defender</div>
                    <div className="text-white font-medium">{selectedBattle.defenderName}</div>
                    {selectedBattle.winner === 'defender' && (
                      <div className="text-green-400 text-sm mt-1">Winner</div>
                    )}
                  </div>
                </div>

                {/* Losses */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-700 rounded-lg p-4">
                    <div className="text-sm text-gray-400 mb-2">Attacker Losses</div>
                    {Object.entries(selectedBattle.attackerLosses || {}).length > 0 ? (
                      <div className="space-y-1">
                        {Object.entries(selectedBattle.attackerLosses).map(([type, count]) => (
                          <div key={type} className="flex justify-between text-sm">
                            <span className="text-gray-300 capitalize">
                              {type.replace('_', ' ')}
                            </span>
                            <span className="text-red-400">-{count}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-gray-500 text-sm">No losses</div>
                    )}
                  </div>
                  <div className="bg-gray-700 rounded-lg p-4">
                    <div className="text-sm text-gray-400 mb-2">Defender Losses</div>
                    {Object.entries(selectedBattle.defenderLosses || {}).length > 0 ? (
                      <div className="space-y-1">
                        {Object.entries(selectedBattle.defenderLosses).map(([type, count]) => (
                          <div key={type} className="flex justify-between text-sm">
                            <span className="text-gray-300 capitalize">
                              {type.replace('_', ' ')}
                            </span>
                            <span className="text-red-400">-{count}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-gray-500 text-sm">No losses</div>
                    )}
                  </div>
                </div>

                {/* Resources Looted */}
                {Object.entries(selectedBattle.resourcesLooted || {}).length > 0 && (
                  <div className="bg-gray-700 rounded-lg p-4">
                    <div className="text-sm text-gray-400 mb-2">Resources Looted</div>
                    <div className="grid grid-cols-3 gap-2">
                      {Object.entries(selectedBattle.resourcesLooted).map(([type, amount]) => (
                        <div key={type} className="text-center">
                          <div className="text-yellow-400">{amount.toLocaleString()}</div>
                          <div className="text-gray-500 text-xs capitalize">{type}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Timestamp */}
                <div className="text-sm text-gray-500 text-center">
                  {new Date(selectedBattle.createdAt).toLocaleString()}
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-gray-500">
                Select a battle to view details
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
