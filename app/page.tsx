'use client'

import React, { useState, useEffect } from 'react';
import { Upload, Users, Trophy, Plus, Trash2, Edit2, Save } from 'lucide-react';
import { supabase } from '../lib/supabase';

// Type definitions
type Golfer = {
  name: string;
  order?: number;
};

type TierData = {
  tier1: Golfer[];
  tier2: Golfer[];
  tier3: Golfer[];
  tier4: Golfer[];
  tier5: Golfer[];
  tier6: Golfer[];
};

type Player = {
  id: string;
  name: string;
  picks: Record<string, string>;
  tournament_key: string;
  created_at?: string;
};

type ScoreData = {
  rounds: (number | null)[];
  total: number;
  toPar: number;
  madeCut: boolean;
  completedRounds: number;
};

type TournamentData = {
  name: string;
  golfers: Golfer[];
  tiers: TierData;
  players: Player[];
  scores: Record<string, ScoreData>;
};

type NewPlayer = {
  name: string;
  picks: Record<string, string>;
};

const GolfMajorPool = () => {
  const [golfers, setGolfers] = useState<Golfer[]>([]);
  const [tiers, setTiers] = useState<TierData>({
    tier1: [], tier2: [], tier3: [], tier4: [], tier5: [], tier6: []
  });
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentScores, setCurrentScores] = useState<Record<string, ScoreData>>({});
  const [activeTab, setActiveTab] = useState<'setup' | 'players' | 'scores' | 'leaderboard'>('setup');
  const [newPlayer, setNewPlayer] = useState<NewPlayer>({ name: '', picks: {} });
  const [selectedTournament, setSelectedTournament] = useState<string>('');
  const currentYear = new Date().getFullYear();
  const [tournaments, setTournaments] = useState<Record<string, TournamentData>>({});
  const [isAdminMode, setIsAdminMode] = useState<boolean>(false);
  const [editingScores, setEditingScores] = useState<Record<string, { rounds: (number | null | string)[]; madeCut: boolean }>>({});
  const [showPasswordPrompt, setShowPasswordPrompt] = useState<boolean>(false);
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  // Sample data for new tournaments
  const sampleGolfers: Golfer[] = [
    { name: 'Scottie Scheffler' }, { name: 'Rory McIlroy' }, { name: 'Jon Rahm' },
    { name: 'Viktor Hovland' }, { name: 'Xander Schauffele' }, { name: 'Collin Morikawa' },
    { name: 'Patrick Cantlay' }, { name: 'Wyndham Clark' }, { name: 'Max Homa' },
    { name: 'Justin Thomas' }, { name: 'Tiger Woods' }, { name: 'Jordan Spieth' },
    { name: 'Ludvig Aberg' }, { name: 'Cameron Smith' }, { name: 'Hideki Matsuyama' },
    { name: 'Tony Finau' }, { name: 'Russell Henley' }, { name: 'Sahith Theegala' },
    { name: 'Tommy Fleetwood' }, { name: 'Brian Harman' }, { name: 'Rickie Fowler' },
    { name: 'Jason Day' }, { name: 'Adam Scott' }, { name: 'Matt Fitzpatrick' },
    { name: 'Cameron Young' }, { name: 'Corey Conners' }, { name: 'Keegan Bradley' },
    { name: 'Shane Lowry' }, { name: 'Si Woo Kim' }, { name: 'Tyrrell Hatton' }
  ];

  // Load tournaments from database
  useEffect(() => {
    loadTournaments();
  }, []);

  // Load tournament data when selection changes
  useEffect(() => {
    if (selectedTournament) {
      loadTournamentData(selectedTournament);
    }
  }, [selectedTournament]);

  // Auto-switch to players tab when not in admin mode
  useEffect(() => {
    if (!isAdminMode && activeTab === 'setup') {
      setActiveTab('players');
    }
  }, [isAdminMode, activeTab]);

  const loadTournaments = async () => {
    try {
      const { data, error } = await supabase
        .from('tournaments')
        .select('*')
        .order('created_at');

      if (error) throw error;

      const tournamentMap: Record<string, TournamentData> = {};
      data?.forEach(tournament => {
        tournamentMap[tournament.tournament_key] = {
          name: tournament.name,
          golfers: tournament.golfers || [],
          tiers: tournament.tiers || {
            tier1: [], tier2: [], tier3: [], tier4: [], tier5: [], tier6: []
          },
          players: [],
          scores: {}
        };
      });

      setTournaments(tournamentMap);
    } catch (error) {
      console.error('Error loading tournaments:', error);
    }
  };

  const loadTournamentData = async (tournamentKey: string) => {
    setLoading(true);
    try {
      // Load tournament details
      const { data: tournamentData, error: tournamentError } = await supabase
        .from('tournaments')
        .select('*')
        .eq('tournament_key', tournamentKey)
        .single();

      if (tournamentError) throw tournamentError;

      // Load players
      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select('*')
        .eq('tournament_key', tournamentKey)
        .order('created_at');

      if (playersError) throw playersError;

      // Load scores
      const { data: scoresData, error: scoresError } = await supabase
        .from('scores')
        .select('*')
        .eq('tournament_key', tournamentKey);

      if (scoresError) throw scoresError;

      // Process scores into the format our app expects
      const scoresMap: Record<string, ScoreData> = {};
      scoresData?.forEach(score => {
        const validRounds = score.rounds?.filter((r: any) => r !== null) || [];
        const totalScore = validRounds.reduce((sum: number, round: number) => sum + round, 0);
        const completedRounds = validRounds.length;
        const par = 72 * completedRounds;
        const toPar = completedRounds > 0 ? totalScore - par : 0;

        scoresMap[score.golfer_name] = {
          rounds: score.rounds || [null, null, null, null],
          total: totalScore,
          toPar,
          madeCut: score.made_cut,
          completedRounds
        };
      });

      // Set all the data
      setGolfers(tournamentData.golfers || []);
      setTiers(tournamentData.tiers || {
        tier1: [], tier2: [], tier3: [], tier4: [], tier5: [], tier6: []
      });
      setPlayers(playersData || []);
      setCurrentScores(scoresMap);

      // Load sample data if tournament is empty
      if (!tournamentData.golfers || tournamentData.golfers.length === 0) {
        const allGolfers = [...sampleGolfers];
        for (let i = 31; i <= 60; i++) {
          allGolfers.push({ name: `Golfer ${i}` });
        }
        setGolfers(allGolfers);
        organizeTiers(allGolfers);
      }

    } catch (error) {
      console.error('Error loading tournament data:', error);
    }
    setLoading(false);
  };

  const saveTournamentData = async () => {
    if (!selectedTournament) return;

    try {
      await supabase
        .from('tournaments')
        .upsert({
          tournament_key: selectedTournament,
          name: tournaments[selectedTournament]?.name,
          golfers,
          tiers,
          updated_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Error saving tournament data:', error);
    }
  };

  const organizeTiers = async (golferList: Golfer[]) => {
    const newTiers: TierData = {
      tier1: golferList.slice(0, 10),
      tier2: golferList.slice(10, 20),
      tier3: golferList.slice(20, 30),
      tier4: golferList.slice(30, 40),
      tier5: golferList.slice(40, 50),
      tier6: golferList.slice(50)
    };
    setTiers(newTiers);
    await saveTournamentData();
  };

  const addPlayer = async () => {
    if (newPlayer.name && Object.keys(newPlayer.picks).length === 6) {
      // Check if this exact team already exists
      const teamExists = players.some(player => 
        JSON.stringify(player.picks) === JSON.stringify(newPlayer.picks)
      );
      
      if (teamExists) {
        alert('This exact team combination already exists! Please choose different golfers.');
        return;
      }

      try {
        const { data, error } = await supabase
          .from('players')
          .insert({
            tournament_key: selectedTournament,
            name: newPlayer.name,
            picks: newPlayer.picks
          })
          .select()
          .single();

        if (error) throw error;

        setPlayers([...players, data]);
        setNewPlayer({ name: '', picks: {} });
      } catch (error) {
        console.error('Error adding player:', error);
        alert('Error adding player. Please try again.');
      }
    }
  };

  const deletePlayer = async (playerId: string) => {
    try {
      const { error } = await supabase
        .from('players')
        .delete()
        .eq('id', playerId);

      if (error) throw error;

      setPlayers(players.filter(p => p.id !== playerId));
    } catch (error) {
      console.error('Error deleting player:', error);
    }
  };

  const saveScores = async () => {
    try {
      const scoreUpdates: any[] = [];
      
      Object.entries(editingScores).forEach(([golferName, scoreData]) => {
        const rounds = scoreData.rounds?.map(r => r === '' || r === null ? null : parseInt(r as string)) || [null, null, null, null];
        
        if (scoreData.madeCut === false) {
          rounds[2] = 80;
          rounds[3] = 80;
        }

        scoreUpdates.push({
          tournament_key: selectedTournament,
          golfer_name: golferName,
          rounds,
          made_cut: scoreData.madeCut !== false,
          updated_at: new Date().toISOString()
        });
      });

      const { error } = await supabase
        .from('scores')
        .upsert(scoreUpdates);

      if (error) throw error;

      // Reload scores to reflect changes
      loadTournamentData(selectedTournament);
      setEditingScores({});
    } catch (error) {
      console.error('Error saving scores:', error);
      alert('Error saving scores. Please try again.');
    }
  };

  // ... (rest of the helper functions remain the same)
  const handleAdminToggle = () => {
    if (isAdminMode) {
      setIsAdminMode(false);
    } else {
      setShowPasswordPrompt(true);
      setPasswordInput('');
    }
  };

  const handlePasswordSubmit = () => {
    if (passwordInput === 'fucktea') {
      setIsAdminMode(true);
      setShowPasswordPrompt(false);
      setPasswordInput('');
    } else {
      alert('Incorrect password!');
      setPasswordInput('');
    }
  };

  const handlePasswordCancel = () => {
    setShowPasswordPrompt(false);
    setPasswordInput('');
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const text = e.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim());
        
        const parsedGolfers = lines.map((line, index) => {
          const name = line.split(',')[0]?.trim();
          return { name, order: index };
        }).filter(golfer => golfer.name);
        
        setGolfers(parsedGolfers);
        await organizeTiers(parsedGolfers);
      };
      reader.readAsText(file);
    }
  };

  const updateGolferScore = (golferName: string, field: string, value: any) => {
    setEditingScores(prev => ({
      ...prev,
      [golferName]: {
        ...prev[golferName],
        [field]: value
      }
    }));
  };

  const getSelectedGolfers = (): string[] => {
    const selected = new Set<string>();
    players.forEach(player => {
      Object.values(player.picks).forEach(golferName => {
        selected.add(golferName);
      });
    });
    return Array.from(selected);
  };

  const initializeEditingScores = () => {
    const selectedGolfers = getSelectedGolfers();
    const initial: Record<string, { rounds: (number | null)[]; madeCut: boolean }> = {};
    
    selectedGolfers.forEach(golferName => {
      const existing = currentScores[golferName];
      initial[golferName] = {
        rounds: existing?.rounds || [null, null, null, null],
        madeCut: existing?.madeCut !== false
      };
    });
    setEditingScores(initial);
  };

  const calculatePlayerScores = () => {
    const results = players.map(player => {
      const golferScores = Object.values(player.picks).map(golferName => {
        const score = currentScores[golferName];
        if (!score) return null;
        
        const validRounds = score.rounds?.filter(r => r !== null) || [];
        if (validRounds.length === 0) return null;
        
        if (!score.madeCut) {
          const rounds = [...score.rounds];
          rounds[2] = 80;
          rounds[3] = 80;
          const cutScore = rounds.reduce((sum, round) => sum + (round || 0), 0);
          return {
            name: golferName,
            toPar: cutScore - (72 * 4),
            madeCut: false,
            total: cutScore,
            rounds: rounds
          };
        }
        
        return {
          name: golferName,
          toPar: score.toPar,
          madeCut: true,
          total: score.total,
          rounds: score.rounds,
          completedRounds: score.completedRounds
        };
      }).filter(Boolean);

      const bestFour = golferScores.sort((a, b) => a!.toPar - b!.toPar).slice(0, 4);
      const totalScore = bestFour.reduce((sum, golfer) => sum + golfer!.toPar, 0);
      const lowestIndividualScore = golferScores.length > 0 
        ? Math.min(...golferScores.map(g => g!.toPar))
        : 999;

      return {
        ...player,
        golferScores,
        bestFour,
        totalScore,
        lowestIndividualScore
      };
    });

    return results.sort((a, b) => {
      if (a.totalScore !== b.totalScore) return a.totalScore - b.totalScore;
      return a.lowestIndividualScore - b.lowestIndividualScore;
    });
  };

  const leaderboardResults = currentScores ? calculatePlayerScores() : [];

  const TierSelector = ({ tierName, tierNumber, golfers, selectedGolfer, onSelect }: {
    tierName: string;
    tierNumber: number;
    golfers: Golfer[];
    selectedGolfer: string | undefined;
    onSelect: (tierName: string, golfer: string) => void;
  }) => (
    <div className="mb-3 sm:mb-4">
      <h4 className="font-semibold mb-2 text-blue-600 text-sm sm:text-base">
        Tier {tierNumber} (Positions {(tierNumber-1)*10 + 1}-{tierNumber*10})
      </h4>
      <select 
        value={selectedGolfer || ''} 
        onChange={(e) => onSelect(tierName, e.target.value)}
        className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 text-base min-h-[44px]"
      >
        <option value="">Select a golfer...</option>
        {golfers.map(golfer => (
          <option key={golfer.name} value={golfer.name}>
            {golfer.name}
          </option>
        ))}
      </select>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading tournament data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-3 sm:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 flex items-center gap-2">
                <Trophy className="text-yellow-500" />
                <span className="hidden sm:inline">Golf Major Pool Manager</span>
                <span className="sm:hidden">Golf Pool</span>
              </h1>
              {selectedTournament && (
                <select
                  value={selectedTournament}
                  onChange={(e) => {
                    saveTournamentData();
                    setSelectedTournament(e.target.value);
                  }}
                  className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-sm sm:text-base min-h-[44px]"
                >
                  <option value="">Select Tournament</option>
                  {Object.entries(tournaments).map(([key, tournament]) => (
                    <option key={key} value={key}>
                      {tournament.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              {isAdminMode && selectedTournament && (
                <button
                  onClick={saveTournamentData}
                  className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 text-sm sm:text-base min-h-[44px]"
                >
                  <Save size={16} />
                  <span className="hidden sm:inline">Save Changes</span>
                  <span className="sm:hidden">Save</span>
                </button>
              )}
              <button
                onClick={handleAdminToggle}
                className={`px-3 py-2 rounded-lg text-sm sm:text-base min-h-[44px] ${
                  isAdminMode 
                    ? 'bg-red-100 text-red-700 hover:bg-red-200' 
                    : 'bg-green-100 text-green-700 hover:bg-green-200'
                }`}
              >
                {isAdminMode ? (
                  <>
                    <span className="hidden sm:inline">Switch to Player View</span>
                    <span className="sm:hidden">Player View</span>
                  </>
                ) : (
                  <>
                    <span className="hidden sm:inline">Admin Login</span>
                    <span className="sm:hidden">Admin</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {!selectedTournament && (
            <div className="max-w-4xl mx-auto px-2 sm:px-0">
              <div className="text-center mb-6 sm:mb-8">
                <Trophy className="mx-auto text-yellow-500 mb-4" size={48} />
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">Welcome to Golf Major Pool</h2>
                <p className="text-base sm:text-lg text-gray-600">Choose a tournament to view or manage</p>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                {Object.entries(tournaments).map(([key, tournament]) => (
                  <div 
                    key={key}
                    onClick={() => setSelectedTournament(key)}
                    className="bg-white border-2 border-gray-200 rounded-lg p-4 sm:p-6 hover:border-blue-500 hover:shadow-lg transition-all cursor-pointer group active:scale-95"
                  >
                    <div className="flex items-center justify-between mb-3 sm:mb-4">
                      <h3 className="text-lg sm:text-xl font-semibold text-gray-800 group-hover:text-blue-600 leading-tight">
                        {tournament.name}
                      </h3>
                      <Trophy className="text-yellow-500 group-hover:text-yellow-600 flex-shrink-0" size={20} />
                    </div>
                    
                    <div className="space-y-2 text-sm text-gray-600">
                      <div className="flex justify-between">
                        <span>Players:</span>
                        <span className="font-medium">{tournament.players?.length || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Golfers:</span>
                        <span className="font-medium">{tournament.golfers?.length || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Status:</span>
                        <span className={`font-medium ${
                          tournament.golfers?.length > 0 ? 'text-green-600' : 'text-gray-400'
                        }`}>
                          {tournament.golfers?.length > 0 ? 'Setup Complete' : 'Needs Setup'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-100">
                      <span className="text-blue-600 group-hover:text-blue-700 font-medium text-sm">
                        {tournament.golfers?.length > 0 ? 'View tournament details →' : 'Set up this tournament →'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedTournament && (
            <>
              {/* Tournament Info Bar */}
              <div className="bg-blue-50 p-3 sm:p-4 rounded-lg mb-4 sm:mb-6">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                  <div>
                    <h2 className="text-base sm:text-lg font-semibold text-blue-800">
                      {tournaments[selectedTournament]?.name}
                    </h2>
                    <p className="text-xs sm:text-sm text-blue-600">
                      {players.length} players • {golfers.length} golfers
                    </p>
                  </div>
                  <div className="text-xs sm:text-sm text-blue-600">
                    Live database connected ✓
                  </div>
                </div>
              </div>

              {/* Password Prompt Modal */}
              {showPasswordPrompt && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                  <div className="bg-white p-4 sm:p-6 rounded-lg shadow-lg max-w-md w-full">
                    <h3 className="text-lg font-semibold mb-4">Admin Access Required</h3>
                    <p className="text-gray-600 mb-4 text-sm sm:text-base">Enter admin password:</p>
                    <input
                      type="password"
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handlePasswordSubmit()}
                      placeholder="Enter password"
                      className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mb-4 text-base"
                      autoFocus
                    />
                    <div className="flex flex-col sm:flex-row justify-end gap-2">
                      <button
                        onClick={handlePasswordCancel}
                        className="px-4 py-3 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 text-base min-h-[44px]"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handlePasswordSubmit}
                        className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-base min-h-[44px]"
                      >
                        Login
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation Tabs */}
              <div className="flex overflow-x-auto space-x-2 sm:space-x-4 mb-4 sm:mb-6 border-b pb-2">
                {[
                  ...(isAdminMode ? [{ key: 'setup' as const, label: 'Setup', icon: Upload }] : []),
                  { key: 'players' as const, label: 'Players', icon: Users },
                  ...(isAdminMode ? [{ key: 'scores' as const, label: 'Scores', icon: Edit2 }] : []),
                  { key: 'leaderboard' as const, label: 'Leaderboard', icon: Trophy }
                ].map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key)}
                    className={`flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-3 border-b-2 whitespace-nowrap text-sm sm:text-base min-h-[44px] ${
                      activeTab === key 
                        ? 'border-blue-500 text-blue-600' 
                        : 'border-transparent text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    <Icon size={18} />
                    <span className="hidden sm:inline">{label}</span>
                    <span className="sm:hidden">
                      {label === 'Leaderboard' ? 'Board' : label}
                    </span>
                  </button>
                ))}
              </div>

             {/* Setup Tab */}
             {activeTab === 'setup' && isAdminMode && (
                <div className="space-y-4 sm:space-y-6">
                  <div className="bg-blue-50 p-3 sm:p-4 rounded-lg">
                    <h3 className="font-semibold mb-2 text-blue-800 text-sm sm:text-base">Upload Golfers</h3>
                    <p className="text-xs sm:text-sm text-blue-600 mb-3">
                      Upload a CSV file with golfer names. Golfers will be organized into tiers based on the order they appear in the file.
                    </p>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleFileUpload}
                      className="block w-full text-xs sm:text-sm text-gray-500 file:mr-2 sm:file:mr-4 file:py-2 file:px-3 sm:file:px-4 file:rounded-lg file:border-0 file:text-xs sm:file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 file:min-h-[40px]"
                    />
                    <div className="mt-3 p-2 sm:p-3 bg-green-50 border border-green-200 rounded">
                      <p className="text-xs text-green-800 font-medium">✓ Database Connected:</p>
                      <p className="text-xs text-green-700 mt-1">
                        All changes are automatically saved to your Supabase database and synced across all devices.
                      </p>
                    </div>
                  </div>

                  {/* Tiers Display */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                    {Object.entries(tiers).map(([tierName, tierGolfers], index) => (
                      <div key={tierName} className="bg-gray-50 p-3 sm:p-4 rounded-lg">
                        <h4 className="font-semibold mb-2 text-gray-700 text-sm sm:text-base">
                          Tier {index + 1} ({tierGolfers.length} golfers)
                        </h4>
                        <div className="space-y-1 max-h-32 sm:max-h-40 overflow-y-auto">
                          {tierGolfers.map((golfer, golferIndex) => (
                            <div key={golfer.name} className="text-xs sm:text-sm flex justify-between">
                              <span className="truncate mr-2">{golfer.name}</span>
                              <span className="text-gray-500 flex-shrink-0">#{(index * 10) + golferIndex + 1}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Players Tab */}
              {activeTab === 'players' && (
                <div className="space-y-4 sm:space-y-6">
                  {/* Add New Player - Admin Only */}
                  {isAdminMode && (
                    <div className="bg-green-50 p-3 sm:p-4 rounded-lg">
                      <h3 className="font-semibold mb-3 sm:mb-4 text-green-800 text-sm sm:text-base">Add New Player</h3>
                      <div className="mb-3 sm:mb-4">
                        <input
                          type="text"
                          placeholder="Player Name"
                          value={newPlayer.name}
                          onChange={(e) => setNewPlayer({ ...newPlayer, name: e.target.value })}
                          className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-green-500 text-base min-h-[44px]"
                        />
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        {Object.entries(tiers).map(([tierName, tierGolfers], index) => (
                          <TierSelector
                            key={tierName}
                            tierName={tierName}
                            tierNumber={index + 1}
                            golfers={tierGolfers}
                            selectedGolfer={newPlayer.picks[tierName]}
                            onSelect={(tier, golfer) => 
                              setNewPlayer({ 
                                ...newPlayer, 
                                picks: { ...newPlayer.picks, [tier]: golfer }
                              })
                            }
                          />
                        ))}
                      </div>
                      
                      <button
                        onClick={addPlayer}
                        disabled={!newPlayer.name || Object.keys(newPlayer.picks).length !== 6}
                        className="mt-3 sm:mt-4 flex items-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 text-base min-h-[44px]"
                      >
                        <Plus size={20} />
                        Add Player
                      </button>
                    </div>
                  )}

                  {/* Current Players */}
                  <div className="space-y-3">
                    <h3 className="font-semibold text-gray-800">Current Players ({players.length})</h3>
                    {players.map(player => {
                      // Calculate player's current performance
                      const playerScores = Object.values(player.picks).map(golferName => {
                        const score = currentScores[golferName];
                        if (!score) return { name: golferName, toPar: null, status: 'No score' };
                        
                        if (!score.madeCut) {
                          const rounds = [...score.rounds];
                          rounds[2] = 80;
                          rounds[3] = 80;
                          const cutScore = rounds.reduce((sum, round) => sum + (round || 0), 0);
                          return {
                            name: golferName,
                            toPar: cutScore - (72 * 4),
                            status: 'MC',
                            rounds: rounds
                          };
                        }
                        
                        return {
                          name: golferName,
                          toPar: score.toPar,
                          status: score.completedRounds < 4 ? `${score.completedRounds || 0}/4` : 'Done',
                          rounds: score.rounds
                        };
                      });

                      const validScores = playerScores.filter(g => g.toPar !== null);
                      const bestFour = validScores.sort((a, b) => a.toPar! - b.toPar!).slice(0, 4);
                      const totalScore = bestFour.reduce((sum, golfer) => sum + golfer.toPar!, 0);

                      return (
                        <div key={player.id} className="bg-white border rounded-lg p-4 shadow-sm">
                          {/* Player Header */}
                          <div className="flex justify-between items-center mb-3">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-3">
                              <h4 className="font-semibold text-lg">{player.name}</h4>
                              {validScores.length > 0 && (
                                <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold mt-1 sm:mt-0 ${
                                  totalScore < 0 ? 'bg-red-100 text-red-700' : 
                                  totalScore > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                                }`}>
                                  {totalScore > 0 ? '+' : ''}{totalScore}
                                  {bestFour.length < 4 && <span className="text-xs ml-1">({bestFour.length}/4)</span>}
                                </span>
                              )}
                            </div>
                            {isAdminMode && (
                              <button
                                onClick={() => deletePlayer(player.id)}
                                className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                          
                          {/* Mobile: Stack view, Desktop: Grid view */}
                          <div className="space-y-2 sm:space-y-0 sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 sm:gap-2">
                            {Object.entries(player.picks).map(([tier, golfer], index) => {
                              const golferScore = playerScores.find(g => g.name === golfer);
                              const isInBestFour = bestFour.some(g => g.name === golfer);
                              
                              return (
                                <div key={tier} className={`p-3 rounded-lg border ${
                                  isInBestFour 
                                    ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-300' 
                                    : 'bg-gray-50 border-gray-200'
                                }`}>
                                  {/* Mobile: Horizontal layout */}
                                  <div className="flex justify-between items-center sm:flex-col sm:items-start">
                                    <div className="flex-1 sm:w-full">
                                      <div className="flex items-center gap-2 mb-1 sm:mb-2">
                                        <span className="text-xs font-medium text-gray-600 bg-white px-2 py-1 rounded">
                                          T{index + 1}
                                        </span>
                                        {isInBestFour && (
                                          <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded sm:hidden">
                                            ★
                                          </span>
                                        )}
                                      </div>
                                      <div className="font-medium text-sm text-gray-800 mb-1 leading-tight">
                                        {golfer}
                                      </div>
                                    </div>
                                    
                                    {/* Score section */}
                                    <div className="flex flex-col items-end sm:items-start sm:w-full">
                                      {golferScore && (
                                        <>
                                          {golferScore.toPar !== null ? (
                                            <>
                                              <span className={`font-bold text-base sm:text-sm ${
                                                golferScore.toPar < 0 ? 'text-red-600' : 
                                                golferScore.toPar > 0 ? 'text-green-600' : 'text-gray-600'
                                              }`}>
                                                {golferScore.toPar > 0 ? '+' : ''}{golferScore.toPar}
                                              </span>
                                              <span className="text-xs text-gray-500">{golferScore.status}</span>
                                            </>
                                          ) : (
                                            <span className="text-gray-500 text-sm">-</span>
                                          )}
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Manage Scores Tab */}
              {activeTab === 'scores' && isAdminMode && (
                <div className="space-y-4 sm:space-y-6">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                    <h3 className="font-semibold text-gray-800">Manage Golfer Scores</h3>
                    <div className="flex gap-2">
                      <button
                        onClick={initializeEditingScores}
                        className="flex items-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm sm:text-base min-h-[44px]"
                      >
                        <Edit2 size={18} />
                        <span className="hidden sm:inline">Edit Scores</span>
                        <span className="sm:hidden">Edit</span>
                      </button>
                      <button
                        onClick={saveScores}
                        disabled={Object.keys(editingScores).length === 0}
                        className="flex items-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 text-sm sm:text-base min-h-[44px]"
                      >
                        <Save size={18} />
                        <span className="hidden sm:inline">Save Scores</span>
                        <span className="sm:hidden">Save</span>
                      </button>
                    </div>
                  </div>

                  {Object.keys(editingScores).length > 0 && (
                    <div className="bg-white rounded-lg shadow overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Golfer
                              </th>
                              <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                R1
                              </th>
                              <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                R2
                              </th>
                              <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                R3
                              </th>
                              <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                R4
                              </th>
                              <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Cut
                              </th>
                              <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Total
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {getSelectedGolfers().map(golferName => {
                              const editing = editingScores[golferName] || { rounds: [null, null, null, null], madeCut: true };
                              const validRounds = editing.rounds.filter(r => r !== null && r !== '');
                              const total = validRounds.reduce((sum, round) => sum + (parseInt(round as string) || 0), 0);
                              const completedRounds = validRounds.length;
                              const toPar = completedRounds > 0 ? total - (72 * completedRounds) : 0;
                              
                              return (
                                <tr key={golferName}>
                                  <td className="px-3 py-4 whitespace-nowrap font-medium text-sm">
                                    <div className="truncate max-w-32">{golferName}</div>
                                  </td>
                                  {editing.rounds.map((round, index) => (
                                    <td key={index} className="px-2 py-4 whitespace-nowrap text-center">
                                      <input
                                        type="number"
                                        value={round === null ? '' : round}
                                        onChange={(e) => {
                                          const newRounds = [...editing.rounds];
                                          newRounds[index] = e.target.value === '' ? null : e.target.value;
                                          updateGolferScore(golferName, 'rounds', newRounds);
                                        }}
                                        className="w-12 sm:w-16 px-1 sm:px-2 py-1 border rounded text-center focus:ring-2 focus:ring-blue-500 text-sm"
                                        min="60"
                                        max="90"
                                        placeholder="-"
                                        disabled={!editing.madeCut && index >= 2}
                                      />
                                      {!editing.madeCut && index >= 2 && (
                                        <div className="text-xs text-gray-500 mt-1">80</div>
                                      )}
                                    </td>
                                  ))}
                                  <td className="px-2 py-4 whitespace-nowrap text-center">
                                    <input
                                      type="checkbox"
                                      checked={editing.madeCut}
                                      onChange={(e) => {
                                        updateGolferScore(golferName, 'madeCut', e.target.checked);
                                        if (!e.target.checked) {
                                          const newRounds = [...editing.rounds];
                                          newRounds[2] = 80;
                                          newRounds[3] = 80;
                                          updateGolferScore(golferName, 'rounds', newRounds);
                                        }
                                      }}
                                      className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                    />
                                  </td>
                                  <td className="px-2 py-4 whitespace-nowrap text-center">
                                    {completedRounds > 0 && (
                                      <span className={`font-bold text-sm ${
                                        toPar < 0 ? 'text-red-600' : 
                                        toPar > 0 ? 'text-green-600' : 'text-gray-600'
                                      }`}>
                                        {toPar > 0 ? '+' : ''}{toPar}
                                        <div className="text-xs text-gray-500">
                                          ({completedRounds}R)
                                        </div>
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {Object.keys(editingScores).length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <p>Click &quot;Edit Scores&quot; to start entering tournament scores</p>
                      <p className="text-sm mt-2">Only golfers selected by players will appear here</p>
                    </div>
                  )}
                </div>
              )}

              {/* Leaderboard Tab */}
              {activeTab === 'leaderboard' && (
                <div className="space-y-4 sm:space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="font-semibold text-gray-800">Tournament Leaderboard</h3>
                  </div>

                  {leaderboardResults.length > 0 && (
                    <div className="bg-white rounded-lg shadow overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Rank
                              </th>
                              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Player
                              </th>
                              <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Score
                              </th>
                              <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                                Best 4 Golfers
                              </th>
                              <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Low
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {leaderboardResults.map((player, index) => (
                              <tr key={player.id} className={index === 0 ? 'bg-yellow-50' : ''}>
                                <td className="px-3 py-4 whitespace-nowrap">
                                  <div className="flex items-center">
                                    {index === 0 && <Trophy className="text-yellow-500 mr-2" size={16} />}
                                    <span className="font-medium">{index + 1}</span>
                                  </div>
                                </td>
                                <td className="px-3 py-4 whitespace-nowrap font-medium text-sm">
                                  <div className="truncate max-w-32">{player.name}</div>
                                </td>
                                <td className="px-2 py-4 whitespace-nowrap text-center">
                                  <span className={`font-bold ${
                                    player.totalScore < 0 ? 'text-red-600' : 
                                    player.totalScore > 0 ? 'text-green-600' : 'text-gray-600'
                                  }`}>
                                    {player.totalScore > 0 ? '+' : ''}{player.totalScore}
                                  </span>
                                </td>
                                <td className="px-2 py-4 text-center hidden sm:table-cell">
                                  <div className="text-xs space-y-1">
                                    {player.bestFour.map((golfer: any) => (
                                      <div key={golfer.name} className="flex justify-between">
                                        <span className="truncate mr-2 max-w-20">{golfer.name}</span>
                                        <span className={`font-medium ${
                                          golfer.toPar < 0 ? 'text-red-600' : 
                                          golfer.toPar > 0 ? 'text-green-600' : 'text-gray-600'
                                        }`}>
                                          {golfer.toPar > 0 ? '+' : ''}{golfer.toPar}
                                          {!golfer.madeCut && ' (MC)'}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </td>
                                <td className="px-2 py-4 whitespace-nowrap text-center text-sm">
                                  <span className={`font-medium ${
                                    player.lowestIndividualScore < 0 ? 'text-red-600' : 
                                    player.lowestIndividualScore > 0 ? 'text-green-600' : 'text-gray-600'
                                  }`}>
                                    {player.lowestIndividualScore > 0 ? '+' : ''}{player.lowestIndividualScore}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {Object.keys(currentScores).length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <p>No scores entered yet</p>
                      {isAdminMode && (
                      <p className="text-sm mt-2">Use the &quot;Scores&quot; tab to enter tournament results</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default GolfMajorPool;