'use client'

import React, { useState, useEffect } from 'react';
import { Upload, Users, Trophy, Plus, Trash2, Edit2, Save, Star, Info } from 'lucide-react';
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
  thru?: number; // holes completed in current round
  currentRound?: number; // current round score in progress
};

type TournamentData = {
  name: string;
  logo?: string; // Added logo field
  golfers: Golfer[];
  tiers: TierData;
  players: Player[];
  scores: Record<string, ScoreData>;
  par: number;
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
  const [activeTab, setActiveTab] = useState<'setup' | 'players' | 'scorecard' | 'leaderboard'>('setup');
  const [newPlayer, setNewPlayer] = useState<NewPlayer>({ name: '', picks: {} });
  const [selectedTournament, setSelectedTournament] = useState<string>('');
  const currentYear = new Date().getFullYear();
  const [tournaments, setTournaments] = useState<Record<string, TournamentData>>({});
  const [isAdminMode, setIsAdminMode] = useState<boolean>(false);
  const [editingScores, setEditingScores] = useState<Record<string, { rounds: (number | null | string)[]; madeCut: boolean; thru?: number; currentRound?: number }>>({});
  const [showPasswordPrompt, setShowPasswordPrompt] = useState<boolean>(false);
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [currentPar, setCurrentPar] = useState<number>(72);
  
  // API Integration states
  const [apiKey, setApiKey] = useState<string>('');
  const [tournamentApiId, setTournamentApiId] = useState<string>('');
  const [apiStatus, setApiStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [lastFetchTime, setLastFetchTime] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [showApiConfig, setShowApiConfig] = useState<boolean>(false);

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

// Tournament logos mapping - Local images
const tournamentLogos: Record<string, string> = {
  'masters-2025': '/images/logos/masters-logo.png',
  'pga-championship-2025': '/images/logos/pga-championship-logo.png',
  'us-open-2025': '/images/logos/us-open-logo.png',
  'british-open-2025': '/images/logos/british-open-logo.png',
};
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
          logo: tournament.logo || tournamentLogos[tournament.tournament_key], // Add logo support
          golfers: tournament.golfers || [],
          tiers: tournament.tiers || {
            tier1: [], tier2: [], tier3: [], tier4: [], tier5: [], tier6: []
          },
          players: [],
          scores: {},
          par: tournament.par || 72
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

      // Set the current par for this tournament
      const tournamentPar = tournamentData.par || 72;
      setCurrentPar(tournamentPar);

      // Process scores into the format our app expects
      const scoresMap: Record<string, ScoreData> = {};
      scoresData?.forEach(score => {
        // Handle missed cut players
        if (!score.made_cut) {
          // For missed cut, ensure rounds 3 and 4 are set to par + 8
          const rounds = [...(score.rounds || [null, null, null, null])];
          const penaltyScore = tournamentPar + 8;
          rounds[2] = penaltyScore; // Round 3
          rounds[3] = penaltyScore; // Round 4
          
          const totalScore = rounds.reduce((sum: number, round: number | null) => sum + (round || 0), 0);
          const actualRounds = rounds.filter(r => r !== null).length;
          const toPar = totalScore - (tournamentPar * 4); // Calculate against par for 4 rounds
          
          scoresMap[score.golfer_name] = {
            rounds: rounds,
            total: totalScore,
            toPar,
            madeCut: false,
            completedRounds: actualRounds,
            thru: score.thru || null,
            currentRound: score.current_round || null
          };
        } else {
          // For players who made the cut, calculate normally
          const rounds = score.rounds || [null, null, null, null];
          const validRounds = rounds.filter((r: any) => r !== null);
          const totalScore = validRounds.reduce((sum: number, round: number) => sum + round, 0);
          const completedRounds = validRounds.length;
          const par = tournamentPar * completedRounds;
          const toPar = completedRounds > 0 ? totalScore - par : 0;

          scoresMap[score.golfer_name] = {
            rounds: rounds,
            total: totalScore,
            toPar,
            madeCut: true,
            completedRounds,
            thru: score.thru || null,
            currentRound: score.current_round || null
          };
        }
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

  const saveTournamentData = async (parValue?: number) => {
    if (!selectedTournament) {
      console.log('No tournament selected, cannot save');
      return;
    }

    // Use the passed par value if provided, otherwise use currentPar
    const parToSave = parValue !== undefined ? parValue : currentPar;
    
    console.log('Saving tournament data:', {
      tournament_key: selectedTournament,
      name: tournaments[selectedTournament]?.name,
      par: parToSave,
      parValue,
      currentPar
    });

    try {
      const dataToSave = {
        tournament_key: selectedTournament,
        name: tournaments[selectedTournament]?.name || 'Untitled Tournament',
        logo: tournaments[selectedTournament]?.logo, // Add logo to save data
        golfers,
        tiers,
        par: parToSave,
        updated_at: new Date().toISOString()
      };

      console.log('Data being sent to Supabase:', dataToSave);

      // Try upsert first
      let { data, error } = await supabase
        .from('tournaments')
        .upsert(dataToSave)
        .select();

      // If upsert fails, try update then insert approach
      if (error) {
        console.log('Upsert failed, trying update/insert approach:', error);
        
        // Try to update first
        const { data: updateData, error: updateError } = await supabase
          .from('tournaments')
          .update(dataToSave)
          .eq('tournament_key', selectedTournament)
          .select();

        if (updateError || !updateData || updateData.length === 0) {
          console.log('Update failed or no rows affected, trying insert:', updateError);
          
          // If update fails, try insert
          const { data: insertData, error: insertError } = await supabase
            .from('tournaments')
            .insert(dataToSave)
            .select();

          if (insertError) {
            console.error('Insert also failed:', insertError);
            alert(`Error saving tournament: ${insertError.message}`);
            return;
          }
          
          data = insertData;
        } else {
          data = updateData;
        }
      }

      console.log('Supabase response:', data);
      
      // Update the local tournaments state with the new par value
      setTournaments(prev => ({
        ...prev,
        [selectedTournament]: {
          ...prev[selectedTournament],
          par: parToSave
        }
      }));

      console.log('Tournament data saved successfully');
    } catch (error) {
      console.error('Error saving tournament data:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Unexpected error: ${errorMessage}`);
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
        
        // Ensure missed cut players have penalty scores
        if (scoreData.madeCut === false) {
          const penaltyScore = currentPar + 8;
          rounds[2] = penaltyScore; // Round 3
          rounds[3] = penaltyScore; // Round 4
        }

        scoreUpdates.push({
          tournament_key: selectedTournament,
          golfer_name: golferName,
          rounds,
          made_cut: scoreData.madeCut !== false,
          thru: scoreData.thru || null,
          current_round: scoreData.currentRound || null,
          updated_at: new Date().toISOString()
        });
      });

      const { error } = await supabase
        .from('scores')
        .upsert(scoreUpdates, { onConflict: 'tournament_key,golfer_name' });

      if (error) throw error;

      // Reload scores to reflect changes
      await loadTournamentData(selectedTournament);
      setEditingScores({});
    } catch (error) {
      console.error('Error saving scores:', error);
      alert('Error saving scores. Please try again.');
    }
  };

  // SlashGolfAPI Integration Functions
  const fetchTournamentSchedule = async (year: string = '2025') => {
    if (!apiKey) return null;

    try {
      const scheduleUrl = `https://live-golf-data.p.rapidapi.com/schedule?year=${year}&orgId=1`;
      console.log('Fetching schedule from:', scheduleUrl);

      const response = await fetch(scheduleUrl, {
        headers: {
          'X-RapidAPI-Key': apiKey,
          'X-RapidAPI-Host': 'live-golf-data.p.rapidapi.com'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Schedule data:', data);
        return data;
      }
    } catch (error) {
      console.error('Error fetching schedule:', error);
    }
    return null;
  };

  const fetchLiveScores = async () => {
    if (!apiKey || !tournamentApiId) {
      alert('Please configure your SlashGolf API key and Tournament ID first');
      setShowApiConfig(true);
      return;
    }

    setApiStatus('loading');
    setApiError(null);

    try {
      // Parse tournament API ID to get tournId and year
      let tournId: string;
      let year: string;

      if (tournamentApiId.includes('-')) {
        // Format: "us-open-2025" or "006-2025"
        const [tournamentPart, yearPart] = tournamentApiId.split('-');
        year = yearPart || new Date().getFullYear().toString();
        
        // If it's already a number, use it directly
        if (/^\d+$/.test(tournamentPart)) {
          tournId = tournamentPart;
        } else {
          // Try to fetch schedule first to get real tournament IDs
          const schedule = await fetchTournamentSchedule(year);
          
          if (schedule?.schedule) {
            // Search for tournament by name
            const tournament = schedule.schedule.find((t: any) => 
              t.name.toLowerCase().includes(tournamentPart.replace('-', ' '))
            );
            
            if (tournament) {
              tournId = tournament.tournId;
              console.log(`Found tournament: ${tournament.name} → ID: ${tournId}`);
            } else {
              // Fallback mapping (these might be wrong!)
              const tournamentMap: Record<string, string> = {
                'masters': '014',
                'pga': '003',
                'us': '006', 
                'british': '100',
                'open': '100'
              };
              
              // Try partial matching
              const mapKey = Object.keys(tournamentMap).find(key => 
                tournamentPart.toLowerCase().includes(key)
              );
              
              if (mapKey) {
                tournId = tournamentMap[mapKey];
                console.log(`Using fallback mapping: ${tournamentPart} → ${tournId}`);
              } else {
                throw new Error(`Tournament "${tournamentPart}" not found in schedule. Available tournaments: ${schedule.schedule.map((t: any) => t.name).join(', ')}`);
              }
            }
          } else {
            throw new Error(`Could not fetch tournament schedule. Please use numeric tournament ID format: "006-2025"`);
          }
        }
      } else {
        throw new Error(`Invalid format. Use "tournament-year" (e.g., "us-open-2025") or "tournId-year" (e.g., "006-2025")`);
      }
      
      console.log('Final API call parameters:', { tournId, year, originalInput: tournamentApiId });
      
      // RapidAPI endpoint for leaderboard
      const apiUrl = `https://live-golf-data.p.rapidapi.com/leaderboard?tournId=${tournId}&year=${year}&orgId=1`;
      
      console.log('API URL:', apiUrl);
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'X-RapidAPI-Key': apiKey,
          'X-RapidAPI-Host': 'live-golf-data.p.rapidapi.com',
          'Content-Type': 'application/json'
        }
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.log('Error response:', errorText);
        
        if (response.status === 429) {
          throw new Error('API rate limit exceeded. Please wait before trying again.');
        }
        if (response.status === 401) {
          throw new Error('Invalid API key. Please check your RapidAPI key.');
        }
        if (response.status === 400) {
          throw new Error(`Invalid parameters: tournId="${tournId}", year="${year}". Check if this tournament exists for ${year}.`);
        }
        if (response.status === 404) {
          throw new Error(`Tournament not found: tournId="${tournId}" for year="${year}". Try a different tournament ID.`);
        }
        
        throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      console.log('SlashGolf API Response:', data);

      // Process the API response and update scores
      await processApiScores(data);
      
      setApiStatus('success');
      setLastFetchTime(new Date().toISOString());
      
    } catch (error) {
      console.error('Detailed error info:', error);
      setApiError(error instanceof Error ? error.message : 'Failed to fetch scores');
      setApiStatus('error');
    }
  };

  const processApiScores = async (apiData: any) => {
    if (!selectedTournament) return;

    const scoreUpdates: any[] = [];
    const processedGolfers = new Set<string>(); // Track already processed golfers
    
    // Helper function to extract numbers from MongoDB-like format
    const extractNumber = (value: any): number | null => {
      if (value === null || value === undefined) return null;
      if (typeof value === 'number') return value;
      if (typeof value === 'string') {
        const parsed = parseInt(value);
        return isNaN(parsed) ? null : parsed;
      }
      // Handle MongoDB format: {"$numberInt":"72"}
      if (typeof value === 'object' && value.$numberInt) {
        const parsed = parseInt(value.$numberInt);
        return isNaN(parsed) ? null : parsed;
      }
      return null;
    };
    
    // SlashGolf API response structure: { leaderboardRows: [...] }
    const leaderboardRows = apiData.leaderboardRows || [];
    const unmatchedApiPlayers: string[] = [];
    
    console.log('Processing', leaderboardRows.length, 'players from API');
    
    leaderboardRows.forEach((player: any) => {
      // Construct full name for matching
      const fullName = `${player.firstName} ${player.lastName}`.trim();
      const golferName = findMatchingGolfer(fullName);
      
      if (golferName && !processedGolfers.has(golferName)) {
        // Mark this golfer as processed to avoid duplicates
        processedGolfers.add(golferName);
        
        console.log('Matched player:', fullName, '→', golferName);
        
        // Extract round scores from the rounds array
        const rounds: (number | null)[] = [null, null, null, null];
        if (player.rounds && Array.isArray(player.rounds)) {
          player.rounds.forEach((round: any) => {
            const roundId = extractNumber(round.roundId || 1);
            if (roundId !== null) {
              const roundIndex = roundId - 1; // Convert to 0-based index
              if (roundIndex >= 0 && roundIndex < 4) {
                rounds[roundIndex] = extractNumber(round.strokes);
              }
            }
          });
        }

        // Determine if player made the cut
        const madeCut = player.status !== 'cut' && player.status !== 'wd' && player.status !== 'dq';
        
        // Apply missed cut penalty if needed
        if (!madeCut) {
          const penaltyScore = currentPar + 8;
          rounds[2] = rounds[2] || penaltyScore;
          rounds[3] = rounds[3] || penaltyScore;
        }

        // Extract current round progress - handle MongoDB format
        const currentHole = extractNumber(player.currentHole);
        const thru = currentHole && !player.roundComplete ? currentHole : null;
        const currentRoundScore = extractNumber(player.currentRoundScore);

        scoreUpdates.push({
          tournament_key: selectedTournament,
          golfer_name: golferName,
          rounds,
          made_cut: madeCut,
          // Only include thru and current_round if they have valid non-null values
          ...(thru !== null && { thru }),
          ...(currentRoundScore !== null && { current_round: currentRoundScore }),
          updated_at: new Date().toISOString()
        });
        
        console.log('Updated score for', golferName, {
          rounds,
          madeCut,
          thru,
          currentRoundScore,
          originalStatus: player.status,
          rawCurrentHole: player.currentHole,
          rawCurrentRoundScore: player.currentRoundScore
        });
      } else if (golferName && processedGolfers.has(golferName)) {
        console.log('Skipping duplicate:', fullName, '→', golferName, '(already processed)');
      } else {
        console.log('No match found for:', fullName);
        unmatchedApiPlayers.push(fullName);
      }
    });

    if (scoreUpdates.length > 0) {
      console.log('Saving', scoreUpdates.length, 'unique score updates to database');
      console.log('Sample score update:', scoreUpdates[0]);
      console.log('Sample rounds data:', scoreUpdates[0].rounds);
      
      const { error } = await supabase
        .from('scores')
        .upsert(scoreUpdates, { onConflict: 'tournament_key,golfer_name' });

      if (error) {
        console.error('Database error details:', error);
        console.error('Error message:', error.message);
        console.error('Error details:', error.details);
        throw new Error(`Database error: ${error.message}`);
      }

      // Reload tournament data to show updated scores (but don't save tournament data)
      const { data: updatedScoresData, error: scoresError } = await supabase
        .from('scores')
        .select('*')
        .eq('tournament_key', selectedTournament);

      if (!scoresError && updatedScoresData) {
        // Process scores into the format our app expects
        const scoresMap: Record<string, ScoreData> = {};
        updatedScoresData.forEach(score => {
          if (!score.made_cut) {
            const rounds = [...(score.rounds || [null, null, null, null])];
            const penaltyScore = currentPar + 8;
            rounds[2] = penaltyScore;
            rounds[3] = penaltyScore;
            
            const totalScore = rounds.reduce((sum: number, round: number | null) => sum + (round || 0), 0);
            const actualRounds = rounds.filter(r => r !== null).length;
            const toPar = totalScore - (currentPar * 4);
            
            scoresMap[score.golfer_name] = {
              rounds: rounds,
              total: totalScore,
              toPar,
              madeCut: false,
              completedRounds: actualRounds,
              thru: score.thru || null,
              currentRound: score.current_round || null
            };
          } else {
            const rounds = score.rounds || [null, null, null, null];
            const validRounds = rounds.filter((r: any) => r !== null);
            const totalScore = validRounds.reduce((sum: number, round: number) => sum + round, 0);
            const completedRounds = validRounds.length;
            const par = currentPar * completedRounds;
            const toPar = completedRounds > 0 ? totalScore - par : 0;

            scoresMap[score.golfer_name] = {
              rounds: rounds,
              total: totalScore,
              toPar,
              madeCut: true,
              completedRounds,
              thru: score.thru || null,
              currentRound: score.current_round || null
            };
          }
        });
        
        // Update the scores state
        setCurrentScores(scoresMap);
      }
      
      console.log(`✓ Successfully updated scores for ${scoreUpdates.length} golfers`);
      
      // Report on unmatched golfers in the tournament
      const tournamentGolfers = golfers.map(g => g.name);
      const updatedGolfers = scoreUpdates.map(s => s.golfer_name);
      const unmatchedInTournament = tournamentGolfers.filter(name => !updatedGolfers.includes(name));
      
      if (unmatchedInTournament.length > 0) {
        console.log(`⚠️ ${unmatchedInTournament.length} golfers in your tournament didn't get API updates:`);
        unmatchedInTournament.forEach(name => console.log(`   - ${name}`));
        console.log('These golfers may not be playing in this tournament or have different names in the API.');
      }
      
      if (unmatchedApiPlayers.length > 0) {
        console.log(`📋 ${unmatchedApiPlayers.length} players from API couldn't be matched to your tournament:`);
        unmatchedApiPlayers.slice(0, 10).forEach(name => console.log(`   - ${name}`));
        if (unmatchedApiPlayers.length > 10) {
          console.log(`   ... and ${unmatchedApiPlayers.length - 10} more`);
        }
      }
    } else {
      console.warn('No golfer matches found. Check golfer names in your tournament.');
    }
  };

  const findMatchingGolfer = (apiPlayerName: string): string | null => {
    if (!apiPlayerName) return null;
    
    // Common golf nickname mappings
    const nicknameMap: Record<string, string> = {
      'patrick': 'pat',
      'pat': 'patrick',
      'robert': 'bob',
      'bob': 'robert',
      'william': 'bill',
      'bill': 'william',
      'james': 'jim',
      'jim': 'james',
      'thomas': 'tom',
      'tom': 'thomas',
      'richard': 'rick',
      'rick': 'richard',
      'richard': 'dick',
      'dick': 'richard',
      'matthew': 'matt',
      'matt': 'matthew',
      'michael': 'mike',
      'mike': 'michael',
      'christopher': 'chris',
      'chris': 'christopher',
      'anthony': 'tony',
      'tony': 'anthony',
      'daniel': 'dan',
      'dan': 'daniel',
      'andrew': 'andy',
      'andy': 'andrew',
      'jonathan': 'jon',
      'jon': 'jonathan',
      'samuel': 'sam',
      'sam': 'samuel',
      'joseph': 'joe',
      'joe': 'joseph'
    };
    
    // Normalize function to handle special characters and formatting
    const normalizeString = (str: string): string => {
      return str
        .toLowerCase()
        .trim()
        // Remove common suffixes
        .replace(/\b(jr\.?|sr\.?|iii?|iv|v|r\.?)\b/g, '')
        // Remove middle initials (single letters with or without periods)
        .replace(/\b[a-z]\.?\b/g, ' ')
        // Normalize special characters
        .replace(/[àáâãäå]/g, 'a')
        .replace(/[èéêë]/g, 'e')
        .replace(/[ìíîï]/g, 'i')
        .replace(/[òóôõöø]/g, 'o')
        .replace(/[ùúûü]/g, 'u')
        .replace(/[ýÿ]/g, 'y')
        .replace(/[ñ]/g, 'n')
        .replace(/[ç]/g, 'c')
        .replace(/[ß]/g, 'ss')
        // Remove extra whitespace
        .replace(/\s+/g, ' ')
        .trim();
    };

    const normalizedApiName = normalizeString(apiPlayerName);
    console.log(`🔍 Trying to match: "${apiPlayerName}" → normalized: "${normalizedApiName}"`);
    
    // Try exact match first
    const exactMatch = golfers.find(g => 
      normalizeString(g.name) === normalizedApiName
    );
    if (exactMatch) {
      console.log(`✅ Exact match: "${apiPlayerName}" → "${exactMatch.name}"`);
      return exactMatch.name;
    }
    
    // Extract name parts for more sophisticated matching
    const apiParts = normalizedApiName.split(' ').filter(p => p.length > 1);
    const apiFirstName = apiParts[0];
    const apiLastName = apiParts[apiParts.length - 1];
    
    // Try last name + first name/nickname match
    if (apiLastName && apiLastName.length > 2 && apiFirstName && apiFirstName.length > 1) {
      const nameVariationsMatch = golfers.find(g => {
        const golferParts = normalizeString(g.name).split(' ').filter(p => p.length > 1);
        if (golferParts.length >= 2) {
          const golferFirstName = golferParts[0];
          const golferLastName = golferParts[golferParts.length - 1];
          
          // Check if last names match and first names are related
          if (golferLastName === apiLastName) {
            // Direct first name match
            if (golferFirstName === apiFirstName) return true;
            
            // Nickname variations
            if (nicknameMap[golferFirstName] === apiFirstName || 
                nicknameMap[apiFirstName] === golferFirstName) return true;
            
            // First name contains the other (e.g., "Jon" vs "Jonathan")
            if (golferFirstName.includes(apiFirstName) || apiFirstName.includes(golferFirstName)) {
              return Math.abs(golferFirstName.length - apiFirstName.length) <= 3;
            }
          }
        }
        return false;
      });
      
      if (nameVariationsMatch) {
        console.log(`✅ Name variation match: "${apiPlayerName}" → "${nameVariationsMatch.name}"`);
        return nameVariationsMatch.name;
      }
    }
    
    // Try last name only match (most reliable for golf)
    if (apiLastName && apiLastName.length > 2) {
      const lastNameMatches = golfers.filter(g => {
        const golferParts = normalizeString(g.name).split(' ').filter(p => p.length > 1);
        const golferLastName = golferParts[golferParts.length - 1];
        return golferLastName === apiLastName;
      });
      
      if (lastNameMatches.length === 1) {
        console.log(`✅ Unique last name match: "${apiPlayerName}" → "${lastNameMatches[0].name}"`);
        return lastNameMatches[0].name;
      } else if (lastNameMatches.length > 1) {
        console.log(`⚠️ Multiple last name matches for "${apiPlayerName}":`, lastNameMatches.map(g => g.name));
        // If multiple matches, try to use first name to disambiguate
        const disambiguated = lastNameMatches.find(g => {
          const golferFirstName = normalizeString(g.name).split(' ')[0];
          return golferFirstName.startsWith(apiFirstName.substring(0, 2)) || 
                 apiFirstName.startsWith(golferFirstName.substring(0, 2));
        });
        if (disambiguated) {
          console.log(`✅ Disambiguated match: "${apiPlayerName}" → "${disambiguated.name}"`);
          return disambiguated.name;
        }
      }
    }
    
    // Try fuzzy matching for slight spelling differences
    const fuzzyMatch = golfers.find(g => {
      const golferNormalized = normalizeString(g.name);
      const golferParts = golferNormalized.split(' ').filter(p => p.length > 1);
      
      // Calculate similarity score
      let matchScore = 0;
      let totalParts = Math.max(apiParts.length, golferParts.length);
      
      for (let i = 0; i < Math.min(apiParts.length, golferParts.length); i++) {
        const apiPart = apiParts[i];
        const golferPart = golferParts[i];
        
        if (apiPart === golferPart) {
          matchScore += 1;
        } else if (apiPart.length >= 3 && golferPart.length >= 3) {
          // Check if parts are very similar (allowing for 1 character difference)
          const maxLen = Math.max(apiPart.length, golferPart.length);
          const minLen = Math.min(apiPart.length, golferPart.length);
          if (maxLen - minLen <= 1) {
            let differences = 0;
            for (let j = 0; j < minLen; j++) {
              if (apiPart[j] !== golferPart[j]) differences++;
            }
            if (differences <= 1) matchScore += 0.8;
          }
        }
      }
      
      // Require at least 70% similarity
      return (matchScore / totalParts) >= 0.7;
    });
    
    if (fuzzyMatch) {
      console.log(`✅ Fuzzy match: "${apiPlayerName}" → "${fuzzyMatch.name}"`);
      return fuzzyMatch.name;
    }
    
    // Try reversed name order (for names like "Kim Si Woo" vs "Si Woo Kim")
    if (apiParts.length >= 2) {
      const reversedName = `${apiLastName} ${apiFirstName}`;
      const reversedMatch = golfers.find(g => {
        const normalized = normalizeString(g.name);
        return normalized === reversedName || 
               normalized.includes(reversedName) || 
               reversedName.includes(normalized);
      });
      
      if (reversedMatch) {
        console.log(`✅ Reversed name match: "${apiPlayerName}" → "${reversedMatch.name}"`);
        return reversedMatch.name;
      }
    }
    
    // Enhanced partial matching
    const enhancedPartialMatch = golfers.find(g => {
      const golferNormalized = normalizeString(g.name);
      const golferParts = golferNormalized.split(' ').filter(p => p.length > 1);
      
      // Count significant word matches (3+ characters)
      const significantApiParts = apiParts.filter(p => p.length >= 3);
      const matchingParts = significantApiParts.filter(apiPart => 
        golferParts.some(golferPart => 
          golferPart.includes(apiPart) || apiPart.includes(golferPart)
        )
      );
      
      // Require at least half of significant parts to match
      return matchingParts.length >= Math.ceil(significantApiParts.length / 2) && 
             matchingParts.length >= 1;
    });
    
    if (enhancedPartialMatch) {
      console.log(`✅ Enhanced partial match: "${apiPlayerName}" → "${enhancedPartialMatch.name}"`);
      return enhancedPartialMatch.name;
    }
    
    console.log(`❌ No match found for: "${apiPlayerName}" (normalized: "${normalizedApiName}")`);
    
    // Enhanced debugging - show potential matches
    const potentialMatches = golfers.filter(g => {
      const golferNormalized = normalizeString(g.name);
      const golferParts = golferNormalized.split(' ').filter(p => p.length > 1);
      return apiParts.some(apiPart => 
        golferParts.some(golferPart => 
          (apiPart.length >= 3 && golferPart.includes(apiPart)) ||
          (golferPart.length >= 3 && apiPart.includes(golferPart))
        )
      );
    }).slice(0, 5);
    
    if (potentialMatches.length > 0) {
      console.log(`🔍 Potential matches for "${apiPlayerName}":`, potentialMatches.map(g => g.name));
    }
    
    // Show all golfers if no potential matches (for debugging)
    if (potentialMatches.length === 0) {
      console.log(`📋 All tournament golfers:`, golfers.map(g => g.name).slice(0, 10));
    }
    
    return null;
  };

  const saveApiKey = (key: string) => {
    setApiKey(key);
    if (typeof window !== 'undefined') {
      localStorage.setItem('slashgolf_api_key', key);
      localStorage.setItem('slashgolf_tournament_id', tournamentApiId);
    }
  };

  // Load API key on component mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedKey = localStorage.getItem('slashgolf_api_key');
      const savedTournamentId = localStorage.getItem('slashgolf_tournament_id');
      if (savedKey) {
        setApiKey(savedKey);
      }
      if (savedTournamentId) {
        setTournamentApiId(savedTournamentId);
      }
    }
  }, []);

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
    setEditingScores(prev => {
      const existing = prev[golferName] || {
        rounds: [null, null, null, null],
        madeCut: true,
        thru: undefined,
        currentRound: undefined
      };
      
      return {
        ...prev,
        [golferName]: {
          ...existing,
          [field]: value
        }
      };
    });
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
    const allGolfers = golfers.map(g => g.name);
    const initial: Record<string, { rounds: (number | null)[]; madeCut: boolean; thru?: number; currentRound?: number }> = {};
    
    allGolfers.forEach(golferName => {
      const existing = currentScores[golferName];
      initial[golferName] = {
        rounds: existing?.rounds || [null, null, null, null],
        madeCut: existing?.madeCut !== false,
        thru: existing?.thru,
        currentRound: existing?.currentRound
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
          const penaltyScore = currentPar + 8;
          rounds[2] = penaltyScore;
          rounds[3] = penaltyScore;
          const cutScore = rounds.reduce((sum: number, round) => sum + (round || 0), 0);
          return {
            name: golferName,
            toPar: cutScore - (currentPar * 4),
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
      const totalScore = bestFour.reduce((sum: number, golfer) => sum + golfer!.toPar, 0);
      const lowestIndividualScore = golferScores.length > 0 
        ? Math.min(...golferScores.map(g => g!.toPar))
        : null; // Changed from 999 to null when no scores

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
      // Handle null values in lowestIndividualScore comparison
      if (a.lowestIndividualScore === null && b.lowestIndividualScore === null) return 0;
      if (a.lowestIndividualScore === null) return 1; // null values go to end
      if (b.lowestIndividualScore === null) return -1; // null values go to end
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
        className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 text-base min-h-[44px] text-gray-900 bg-white"
      >
        <option value="" className="text-gray-500">Select a golfer...</option>
        {golfers.map(golfer => (
          <option key={golfer.name} value={golfer.name} className="text-gray-900">
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
    <div className="min-h-screen bg-gray-50 p-3 sm:p-6 text-gray-900" style={{color: '#111827', backgroundColor: '#f9fafb'}}>
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 text-gray-900" style={{color: '#111827', backgroundColor: '#ffffff'}}>
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
                    setCurrentPar(tournaments[e.target.value]?.par || 72);
                  }}
                  className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-sm sm:text-base min-h-[44px] text-gray-900"
                >
                  <option value="" className="text-gray-500">Select Tournament</option>
                  {Object.entries(tournaments).map(([key, tournament]) => (
                    <option key={key} value={key} className="text-gray-900">
                      {tournament.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              {isAdminMode && selectedTournament && (
                <button
                  onClick={() => saveTournamentData()}
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
                    {/* Tournament Logo and Header */}
                    <div className="flex items-center justify-between mb-3 sm:mb-4">
                      <div className="flex items-center gap-3">
                        {tournament.logo ? (
                          <img 
                            src={tournament.logo} 
                            alt={`${tournament.name} logo`}
                            className="w-12 h-12 object-contain flex-shrink-0"
                            onError={(e) => {
                              // Fallback to trophy icon if logo fails to load
                              e.currentTarget.style.display = 'none';
                              e.currentTarget.parentElement?.querySelector('.fallback-icon')?.classList.remove('hidden');
                            }}
                          />
                        ) : (
                          <Trophy className="text-yellow-500 flex-shrink-0" size={24} />
                        )}
                        <Trophy className="text-yellow-500 group-hover:text-yellow-600 flex-shrink-0 hidden fallback-icon" size={24} />
                        <h3 className="text-lg sm:text-xl font-semibold text-gray-800 group-hover:text-blue-600 leading-tight">
                          {tournament.name}
                        </h3>
                      </div>
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
              {/* Tournament Info Bar with Logo */}
              <div className="bg-blue-50 p-3 sm:p-4 rounded-lg mb-4 sm:mb-6">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                  <div className="flex items-center gap-3">
                    {tournaments[selectedTournament]?.logo ? (
                      <img 
                        src={tournaments[selectedTournament].logo} 
                        alt={`${tournaments[selectedTournament].name} logo`}
                        className="w-10 h-10 object-contain flex-shrink-0"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.parentElement?.querySelector('.fallback-icon')?.classList.remove('hidden');
                        }}
                      />
                    ) : (
                      <Trophy className="text-blue-600 flex-shrink-0" size={24} />
                    )}
                    <Trophy className="text-blue-600 flex-shrink-0 hidden fallback-icon" size={24} />
                    <div>
                      <h2 className="text-base sm:text-lg font-semibold text-blue-800">
                        {tournaments[selectedTournament]?.name}
                      </h2>
                      <p className="text-xs sm:text-sm text-blue-600">
                        {players.length} players • {golfers.length} golfers • Par {currentPar}
                      </p>
                    </div>
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
                      className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mb-4 text-base text-gray-900 bg-white placeholder-gray-500"
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

              {/* API Configuration Modal */}
              {showApiConfig && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                  <div className="bg-white p-4 sm:p-6 rounded-lg shadow-lg max-w-md w-full">
                    <h3 className="text-lg font-semibold mb-4">SlashGolf API Configuration</h3>
                    <p className="text-gray-600 mb-4 text-sm sm:text-base">Configure your RapidAPI credentials for SlashGolf:</p>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          RapidAPI Key
                        </label>
                        <input
                          type="password"
                          value={apiKey}
                          onChange={(e) => setApiKey(e.target.value)}
                          placeholder="Enter your RapidAPI key for SlashGolf"
                          className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base text-gray-900 bg-white placeholder-gray-500"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Tournament ID
                        </label>
                        <input
                          type="text"
                          value={tournamentApiId}
                          onChange={(e) => {
                            setTournamentApiId(e.target.value);
                            if (typeof window !== 'undefined') {
                              localStorage.setItem('slashgolf_tournament_id', e.target.value);
                            }
                          }}
                          placeholder="e.g. us-open-2025, masters-2025, pga-championship-2025"
                          className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base text-gray-900 bg-white placeholder-gray-500"
                        />
                        <div className="text-xs text-gray-600 mt-1">
                          <strong>Format:</strong> tournament-year or tournId-year<br/>
                          <strong>Examples:</strong> "us-open-2025", "masters-2025", or "006-2025"<br/>
                          <strong>Tip:</strong> Click "Show Schedule" to see available tournament IDs
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-yellow-50 p-3 rounded-lg mt-4 mb-4">
                      <p className="text-xs text-yellow-800">
                        <strong>Note:</strong> Your RapidAPI configuration will be stored locally in your browser. 
                        Get your API key from <strong>RapidAPI → SlashGolf Live Golf Data</strong>. 
                        The Tournament ID should be in format: tournament-year (e.g., "us-open-2025").
                      </p>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row justify-end gap-2">
                      <button
                        onClick={() => setShowApiConfig(false)}
                        className="px-4 py-3 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 text-base min-h-[44px]"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => {
                          saveApiKey(apiKey);
                          if (typeof window !== 'undefined') {
                            localStorage.setItem('slashgolf_tournament_id', tournamentApiId);
                          }
                          setShowApiConfig(false);
                        }}
                        disabled={!apiKey || !tournamentApiId}
                        className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 text-base min-h-[44px]"
                      >
                        Save Configuration
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
                  { key: 'scorecard' as const, label: 'Scorecard', icon: Edit2 },
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
                      {label === 'Leaderboard' ? 'Board' : label === 'Scorecard' ? 'Card' : label}
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

                  {/* Par Setting Section */}
                  <div className="bg-yellow-50 p-3 sm:p-4 rounded-lg">
                    <h3 className="font-semibold mb-2 text-yellow-800 text-sm sm:text-base">Tournament Par Setting</h3>
                    <p className="text-xs sm:text-sm text-yellow-600 mb-3">
                      Set the par for each round of this tournament. This affects all scoring calculations.
                    </p>
                    <div className="flex items-center gap-4">
                      <label className="text-sm font-medium text-yellow-800">
                        Par per round:
                      </label>
                      <input
                        type="number"
                        value={currentPar}
                        onChange={async (e) => {
                          const newPar = parseInt(e.target.value) || 72;
                          console.log('Par changing from', currentPar, 'to', newPar);
                          setCurrentPar(newPar);
                          // Auto-save when par changes, passing the new value directly
                          console.log('Calling saveTournamentData with par:', newPar);
                          await saveTournamentData(newPar);
                        }}
                        min="68"
                        max="76"
                        className="w-20 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500 text-center text-gray-900 bg-white"
                      />
                      <span className="text-sm text-yellow-600">
                        (Missed cut penalty: {currentPar + 8} per round)
                      </span>
                    </div>
                    <div className="mt-3 p-2 sm:p-3 bg-yellow-100 border border-yellow-200 rounded">
                      <p className="text-xs text-yellow-800">
                        <strong>✓ Auto-saves:</strong> Par changes are automatically saved to the database.
                      </p>
                    </div>
                  </div>

                  {/* API Integration Section */}
                  <div className="bg-purple-50 p-3 sm:p-4 rounded-lg">
                    <h3 className="font-semibold mb-2 text-purple-800 text-sm sm:text-base">SlashGolf API Integration</h3>
                    <p className="text-xs sm:text-sm text-purple-600 mb-3">
                      Configure RapidAPI settings to automatically fetch live scores for this tournament.
                    </p>
                    <div className="flex items-center gap-4 mb-3">
                      <label className="text-sm font-medium text-purple-800">
                        Tournament API ID:
                      </label>
                      <input
                        type="text"
                        value={tournamentApiId}
                        onChange={(e) => {
                          setTournamentApiId(e.target.value);
                          if (typeof window !== 'undefined') {
                            localStorage.setItem('slashgolf_tournament_id', e.target.value);
                          }
                        }}
                        placeholder="e.g. us-open-2025"
                        className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 text-center text-gray-900 bg-white"
                      />
                      <button
                        onClick={() => setShowApiConfig(true)}
                        className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
                      >
                        Config API
                      </button>
                    </div>
                    <div className="text-xs text-gray-600 mb-2">
                      <strong>Format:</strong> tournament-year<br/>
                      <strong>Examples:</strong> masters-2025, pga-championship-2025, us-open-2025, british-open-2025
                    </div>
                    <div className="mt-3 p-2 sm:p-3 bg-purple-100 border border-purple-200 rounded">
                      <p className="text-xs text-purple-800">
                        <strong>API Status:</strong> {(apiKey && tournamentApiId) ? '🔑 Ready to fetch live scores' : '❌ RapidAPI key or Tournament ID missing'}
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

              {/* Players Tab - Different view for Admin vs Player */}
              {activeTab === 'players' && (
                <div className="space-y-4 sm:space-y-6">
                  {isAdminMode ? (
                    <>
                      {/* Admin View - Add New Player */}
                      <div className="bg-green-50 p-3 sm:p-4 rounded-lg">
                        <h3 className="font-semibold mb-3 sm:mb-4 text-green-800 text-sm sm:text-base">Add New Player</h3>
                        <div className="mb-3 sm:mb-4">
                          <input
                            type="text"
                            placeholder="Player Name"
                            value={newPlayer.name}
                            onChange={(e) => setNewPlayer({ ...newPlayer, name: e.target.value })}
                            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-green-500 text-base min-h-[44px] text-gray-900 bg-white placeholder-gray-500"
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

                      {/* Admin View - Current Players */}
                      <div className="space-y-3">
                        <h3 className="font-semibold text-gray-800">Current Players ({players.length})</h3>
                        {players.map(player => {
                          // Calculate player's current performance
                          const playerScores = Object.values(player.picks).map(golferName => {
                            const score = currentScores[golferName];
                            if (!score) return { name: golferName, toPar: null, status: 'No score' };
                            
                            if (!score.madeCut) {
                              const rounds = [...score.rounds];
                              const penaltyScore = currentPar + 8;
                              rounds[2] = penaltyScore;
                              rounds[3] = penaltyScore;
                              const cutScore = rounds.reduce((sum: number, round) => sum + (round || 0), 0);
                              return {
                                name: golferName,
                                toPar: cutScore - (currentPar * 4),
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
                          const totalScore = bestFour.reduce((sum: number, golfer) => sum + golfer.toPar!, 0);

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
                                <button
                                  onClick={() => deletePlayer(player.id)}
                                  className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded"
                                >
                                  <Trash2 size={16} />
                                </button>
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
                    </>
                  ) : (
                    /* Player View - Leaderboard Style */
                    <>
                      {/* Score Update Timestamp for Players */}
                      <div className="bg-blue-50 p-3 sm:p-4 rounded-lg mb-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-blue-800">
                            Scores last checked:
                          </span>
                          <span className="text-sm text-blue-600">
                            {lastFetchTime 
                              ? new Date(lastFetchTime).toLocaleString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: 'numeric',
                                  minute: '2-digit',
                                  hour12: true
                                })
                              : 'Never updated'
                            }
                          </span>
                        </div>
                      </div>

                      <div className="bg-white rounded-lg shadow-sm border">
                      {leaderboardResults.length > 0 ? (
                        <div className="divide-y divide-gray-200">
                          {leaderboardResults.map((result, index) => {
                            const isCurrentPlayerFirst = index === 0;
                            
                            return (
                              <div
                                key={result.id}
                                className={`p-4 ${isCurrentPlayerFirst ? 'bg-yellow-50 border-l-4 border-yellow-400' : ''}`}
                              >
                                {/* Player Header */}
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-2">
                                      <Star
                                        className={`w-5 h-5 ${isCurrentPlayerFirst ? 'text-yellow-500 fill-current' : 'text-gray-300'}`}
                                      />
                                      <span className="text-lg font-bold text-gray-900">
                                        {index + 1}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-lg font-semibold text-gray-900">
                                        {result.name}
                                      </span>
                                      <Info className="w-4 h-4 text-gray-400" />
                                    </div>
                                  </div>
                                  <div className={`text-xl font-bold ${
                                    result.totalScore < 0 ? 'text-red-600' : 
                                    result.totalScore > 0 ? 'text-green-600' : 'text-gray-600'
                                  }`}>
                                    {result.totalScore > 0 ? '+' : ''}{result.totalScore}
                                  </div>
                                </div>

                                {/* Golfers List */}
                                <div className="space-y-2">
                                  {result.golferScores.map((golfer: any) => {
                                    const isInBestFour = result.bestFour.some((bg: any) => bg.name === golfer.name);
                                    const isMissedCut = !golfer.madeCut;
                                    
                                    return (
                                      <div
                                        key={golfer.name}
                                        className={`flex items-center justify-between py-2 px-3 rounded ${
                                          isInBestFour ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'
                                        }`}
                                      >
                                        <div className="flex items-center gap-3">
                                          <span className={`text-sm font-medium ${
                                            isMissedCut ? 'line-through text-gray-500' : 'text-gray-900'
                                          }`}>
                                            {golfer.name}
                                          </span>
                                          {isMissedCut && (
                                            <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">
                                              CUT
                                            </span>
                                          )}
                                        </div>

                                        <div className="flex items-center gap-4">
                                          {/* Total Score */}
                                          <span className={`font-bold ${
                                            golfer.toPar < 0 ? 'text-red-600' : 
                                            golfer.toPar > 0 ? 'text-green-600' : 'text-gray-600'
                                          }`}>
                                            {golfer.toPar > 0 ? '+' : ''}{golfer.toPar}
                                          </span>

                                          {/* Round Scores */}
                                          <div className="flex items-center gap-1 text-sm">
                                            <span className="text-gray-500">
                                              {golfer.completedRounds >= 4 ? 'F' : `R${golfer.completedRounds || 0}`}
                                            </span>
                                            {golfer.rounds && golfer.rounds.map((round: number | null, roundIndex: number) => (
                                              <span
                                                key={roundIndex}
                                                className={`ml-1 ${
                                                  round === null ? 'text-gray-400' : 
                                                  isMissedCut && roundIndex >= 2 ? 'text-red-600 font-medium' : 'text-gray-700'
                                                }`}
                                              >
                                                {round || '-'}
                                              </span>
                                            ))}
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
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          <p>No players have been added yet</p>
                          <p className="text-sm mt-2">Ask an admin to add players to see the leaderboard</p>
                        </div>
                      )}
                    </div>
                    </>
                  )}
                </div>
              )}

              {/* Scorecard Tab */}
              {activeTab === 'scorecard' && (
                <div className="space-y-4 sm:space-y-6">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                    <h3 className="font-semibold text-gray-800">Tournament Scorecard</h3>
                    <div className="flex flex-wrap gap-2">
                      {/* API Controls - Admin Only */}
                      {isAdminMode && (
                        <>
                          <button
                            onClick={() => fetchLiveScores()}
                            disabled={apiStatus === 'loading'}
                            className="flex items-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 text-sm sm:text-base min-h-[44px]"
                          >
                            {apiStatus === 'loading' ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                <span className="hidden sm:inline">Fetching...</span>
                                <span className="sm:hidden">Loading</span>
                              </>
                            ) : (
                              <>
                                <span>🔄</span>
                                <span className="hidden sm:inline">Fetch Live Scores</span>
                                <span className="sm:hidden">Fetch</span>
                              </>
                            )}
                          </button>
                          
                          <button
                            onClick={async () => {
                              if (!apiKey) {
                                setShowApiConfig(true);
                                return;
                              }
                              const schedule = await fetchTournamentSchedule('2025');
                              if (schedule?.schedule) {
                                console.log('Available tournaments for 2025:');
                                schedule.schedule.forEach((t: any) => 
                                  console.log(`${t.name} → ID: ${t.tournId}`)
                                );
                                alert(`Check console for available tournaments. Found ${schedule.schedule.length} tournaments.`);
                              }
                            }}
                            className="flex items-center gap-2 px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm sm:text-base min-h-[44px]"
                          >
                            <span>📅</span>
                            <span className="hidden sm:inline">Show Schedule</span>
                            <span className="sm:hidden">Schedule</span>
                          </button>
                          
                          <button
                            onClick={() => setShowApiConfig(true)}
                            className="flex items-center gap-2 px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm sm:text-base min-h-[44px]"
                          >
                            <span>⚙️</span>
                            <span className="hidden sm:inline">API Config</span>
                            <span className="sm:hidden">Config</span>
                          </button>
                        </>
                      )}

                      {/* Admin Edit Controls */}
                      {isAdminMode && (
                        <>
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
                        </>
                      )}
                    </div>
                  </div>

                  {/* API Status Bar */}
                  <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-700">API Status:</span>
                        <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                          apiStatus === 'success' ? 'bg-green-100 text-green-700' :
                          apiStatus === 'error' ? 'bg-red-100 text-red-700' :
                          apiStatus === 'loading' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {apiStatus === 'success' ? '✓ Connected' :
                           apiStatus === 'error' ? '✗ Error' :
                           apiStatus === 'loading' ? '⏳ Loading' :
                           (apiKey && tournamentApiId) ? '🔑 Ready' : '❌ Not Configured'}
                        </span>
                      </div>
                      <div className="text-xs text-gray-600">
                        {lastFetchTime ? `Last updated: ${new Date(lastFetchTime).toLocaleString()}` : 'Never updated'}
                      </div>
                    </div>
                    
                    {apiError && (
                      <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                        <strong>Error:</strong> {apiError}
                      </div>
                    )}
                    
                    {apiStatus === 'success' && !apiError && (
                      <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-sm text-green-700">
                        <strong>Success:</strong> Live scores updated successfully!
                      </div>
                    )}
                  </div>

                  {/* Scorecard Table */}
                  <div className="bg-white rounded-lg shadow overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full bg-white text-gray-900">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10">
                              Golfer
                            </th>
                            <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                              To Par
                            </th>
                            <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Thru
                            </th>
                            <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Current
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
                              Made Cut
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {golfers.map(golfer => {
                            const score = currentScores[golfer.name];
                            const isEditing = editingScores[golfer.name];
                            const editing = isEditing || { 
                              rounds: [null, null, null, null], 
                              madeCut: true, 
                              thru: score?.thru, 
                              currentRound: score?.currentRound 
                            };
                            const isSelected = getSelectedGolfers().includes(golfer.name);
                            
                            // Use editing data if available, otherwise use current scores
                            const displayData = isEditing ? {
                              rounds: editing.rounds.map(r => r === '' || r === null ? null : parseInt(r as string)),
                              madeCut: editing.madeCut,
                              toPar: 0, // Will calculate below
                              thru: score?.thru || null,
                              currentRound: score?.currentRound || null
                            } : score;

                            // Calculate to par for editing mode
                            if (isEditing && displayData) {
                              const validRounds = displayData.rounds.filter(r => r !== null);
                              const total = validRounds.reduce((sum: number, round) => sum + (round || 0), 0);
                              const completedRounds = validRounds.length;
                              displayData.toPar = completedRounds > 0 ? total - (currentPar * completedRounds) : 0;
                            }

                            return (
                              <tr key={golfer.name} className={`${
                                isSelected ? 'bg-blue-50' : ''
                              } ${!displayData ? 'opacity-60' : ''}`}>
                                <td className="px-3 py-4 whitespace-nowrap font-medium text-sm sticky left-0 bg-white z-10">
                                  <div className="flex items-center gap-2">
                                    <div className="truncate max-w-32">{golfer.name}</div>
                                    {isSelected && (
                                      <span className="inline-block w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></span>
                                    )}
                                  </div>
                                </td>
                                
                                {/* To Par */}
                                <td className="px-2 py-4 whitespace-nowrap text-center">
                                  {displayData ? (
                                    <span className={`font-bold ${
                                      displayData.toPar < 0 ? 'text-red-600' : 
                                      displayData.toPar > 0 ? 'text-green-600' : 'text-gray-600'
                                    }`}>
                                      {displayData.toPar > 0 ? '+' : ''}{displayData.toPar}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400">-</span>
                                  )}
                                </td>

                                {/* Thru */}
                                <td className="px-2 py-4 whitespace-nowrap text-center text-sm">
                                  {displayData?.thru ? `${displayData.thru}/18` : '-'}
                                </td>

                                {/* Current Round */}
                                <td className="px-2 py-4 whitespace-nowrap text-center text-sm">
                                  {displayData?.currentRound || '-'}
                                </td>

                                {/* Round Scores */}
                                {[0, 1, 2, 3].map(roundIndex => {
                                  const roundScore = isEditing ? editing.rounds[roundIndex] : displayData?.rounds[roundIndex];
                                  const isMissedCutRound = !displayData?.madeCut && roundIndex >= 2;
                                  
                                  return (
                                    <td key={roundIndex} className={`px-2 py-4 whitespace-nowrap text-center ${
                                      isMissedCutRound ? 'bg-red-50 border-red-200' : ''
                                    }`}>
                                      {isEditing && isAdminMode ? (
                                        <input
                                          type="number"
                                          value={roundScore === null ? '' : roundScore}
                                          onChange={(e) => {
                                            const newRounds = [...editing.rounds];
                                            newRounds[roundIndex] = e.target.value === '' ? null : e.target.value;
                                            updateGolferScore(golfer.name, 'rounds', newRounds);
                                          }}
                                          className={`w-12 sm:w-16 px-1 sm:px-2 py-1 border rounded text-center focus:ring-2 focus:ring-blue-500 text-sm text-gray-900 bg-white ${
                                            isMissedCutRound ? 'bg-red-50 border-red-300' : ''
                                          }`}
                                          min="60"
                                          max="90"
                                          placeholder="-"
                                          disabled={!editing.madeCut && roundIndex >= 2}
                                        />
                                      ) : (
                                        <span className={`text-sm ${isMissedCutRound ? 'text-red-700 font-medium' : ''}`}>
                                          {roundScore || '-'}
                                          {isMissedCutRound && roundScore && (
                                            <div className="text-xs text-red-600">(MC)</div>
                                          )}
                                        </span>
                                      )}
                                    </td>
                                  );
                                })}

                                {/* Made Cut */}
                                <td className="px-2 py-4 whitespace-nowrap text-center">
                                  {isEditing && isAdminMode ? (
                                    <input
                                      type="checkbox"
                                      checked={editing.madeCut}
                                      onChange={(e) => {
                                        updateGolferScore(golfer.name, 'madeCut', e.target.checked);
                                        if (!e.target.checked) {
                                          const newRounds = [...editing.rounds];
                                          newRounds[2] = currentPar + 8;
                                          newRounds[3] = currentPar + 8;
                                          updateGolferScore(golfer.name, 'rounds', newRounds);
                                        }
                                      }}
                                      className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                    />
                                  ) : (
                                    <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                                      displayData?.madeCut !== false 
                                        ? 'bg-green-100 text-green-700' 
                                        : 'bg-red-100 text-red-700'
                                    }`}>
                                      {displayData?.madeCut !== false ? 'Made' : 'Missed'}
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

                  {golfers.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <p>No golfers in this tournament</p>
                      {isAdminMode && (
                        <p className="text-sm mt-2">Use the "Setup" tab to add golfers to this tournament</p>
                      )}
                    </div>
                  )}

                  {/* Legend */}
                  <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
                    <h4 className="font-medium text-gray-800 mb-2 text-sm">Legend:</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs text-gray-600">
                      <div className="flex items-center gap-2">
                        <span className="inline-block w-2 h-2 bg-blue-500 rounded-full"></span>
                        <span>Selected by players</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="inline-block px-2 py-1 bg-red-50 border border-red-200 rounded text-red-700">R3/R4</span>
                        <span>Missed cut rounds</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-red-600 font-medium">-5</span>
                        <span>Under par</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-green-600 font-medium">+3</span>
                        <span>Over par</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600">12/18</span>
                        <span>Holes completed</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600">72</span>
                        <span>Current round score</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Leaderboard Tab */}
              {activeTab === 'leaderboard' && (
                <div className="space-y-4 sm:space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="font-semibold text-gray-800">Tournament Leaderboard</h3>
                  </div>

                  {leaderboardResults.length > 0 && players.length > 0 && (
                    <div className="bg-white rounded-lg shadow overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full bg-white text-gray-900">
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
                                  {player.lowestIndividualScore !== null ? (
                                    <span className={`font-medium ${
                                      player.lowestIndividualScore < 0 ? 'text-red-600' : 
                                      player.lowestIndividualScore > 0 ? 'text-green-600' : 'text-gray-600'
                                    }`}>
                                      {player.lowestIndividualScore > 0 ? '+' : ''}{player.lowestIndividualScore}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400">-</span>
                                  )}
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
                      <p className="text-sm mt-2">Use the "Scorecard" tab to fetch live scores or enter results manually</p>
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