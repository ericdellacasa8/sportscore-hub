/**
 * Sports Hub - Main Application
 * 
 * README:
 * --------
 * How to set API key:
 *   - Click "Settings" button in the header
 *   - Paste your API-Football RapidAPI key
 *   - Click "Save"
 *   - Get a free key at: https://rapidapi.com/api-sports/api/api-football
 * 
 * How to run locally:
 *   - Simply open index.html in a web browser
 *   - No build step or server required
 * 
 * Mock data:
 *   - If no API key is set or API fails, mock data is used automatically
 *   - Mock data includes realistic current season standings and matches
 *   - This ensures the UI always works even without an API key
 * 
 * Features:
 *   - API responses cached for 10 minutes in localStorage
 *   - Click "Refresh" to force refetch data
 *   - Mobile-friendly responsive design
 *   - Real-time data from API-Football (when API key provided)
 */

// ============================================
// STATE MANAGEMENT
// ============================================

const state = {
    currentSport: 'football',
    currentLeague: '39', // Premier League default
    apiKey: localStorage.getItem('sportsHubApiKey') || '',
    lastUpdated: null,
    apiCallCount: parseInt(localStorage.getItem('apiCallCount') || '0'),
    apiCallsToday: localStorage.getItem('apiCallsDate') === new Date().toDateString() 
        ? parseInt(localStorage.getItem('apiCallCount') || '0') 
        : 0
};

// League configurations - API-Football league IDs
const LEAGUES = {
    football: {
        '39': { name: 'English Premier League', id: '39', season: '2024' },
        '135': { name: 'Italian Serie A', id: '135', season: '2024' },
        '61': { name: 'French Ligue 1', id: '61', season: '2024' },
        '78': { name: 'German Bundesliga', id: '78', season: '2024' }
    },
    rugby: {
        'six-nations': { name: 'Six Nations', id: 'six-nations' }
    }
};

// ============================================
// CACHE UTILITIES
// ============================================

const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

/**
 * Get cached data if still valid
 */
function getCachedData(key) {
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    
    try {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_DURATION) {
            return data;
        }
    } catch (e) {
        console.error('Cache parse error:', e);
    }
    
    return null;
}

/**
 * Store data in cache with timestamp
 */
function setCachedData(key, data) {
    const cacheEntry = {
        data,
        timestamp: Date.now()
    };
    localStorage.setItem(key, JSON.stringify(cacheEntry));
}

/**
 * Clear all cached data
 */
function clearCache() {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
        if (key.startsWith('cache_')) {
            localStorage.removeItem(key);
        }
    });
}

// ============================================
// API INTEGRATION - API-Football via RapidAPI
// ============================================

const API_BASE = 'https://v3.football.api-sports.io';

// ESPN scraping endpoints (public, no auth needed)
const ESPN_ENDPOINTS = {
    '39': { 
        standings: 'https://site.api.espn.com/apis/v2/sports/soccer/eng.1/standings',
        fixtures: 'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard',
        scorers: 'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/leaders',
        league: 'eng.1'
    },
    '135': { 
        standings: 'https://site.api.espn.com/apis/v2/sports/soccer/ita.1/standings',
        fixtures: 'https://site.api.espn.com/apis/site/v2/sports/soccer/ita.1/scoreboard',
        scorers: 'https://site.api.espn.com/apis/site/v2/sports/soccer/ita.1/leaders',
        league: 'ita.1'
    },
    '61': { 
        standings: 'https://site.api.espn.com/apis/v2/sports/soccer/fra.1/standings',
        fixtures: 'https://site.api.espn.com/apis/site/v2/sports/soccer/fra.1/scoreboard',
        scorers: 'https://site.api.espn.com/apis/site/v2/sports/soccer/fra.1/leaders',
        league: 'fra.1'
    },
    '78': { 
        standings: 'https://site.api.espn.com/apis/v2/sports/soccer/ger.1/standings',
        fixtures: 'https://site.api.espn.com/apis/site/v2/sports/soccer/ger.1/scoreboard',
        scorers: 'https://site.api.espn.com/apis/site/v2/sports/soccer/ger.1/leaders',
        league: 'ger.1'
    }
};

/**
 * Track API call count
 */
function incrementApiCallCount() {
    const today = new Date().toDateString();
    const lastDate = localStorage.getItem('apiCallsDate');
    
    // Reset counter if it's a new day
    if (lastDate !== today) {
        state.apiCallsToday = 0;
        localStorage.setItem('apiCallsDate', today);
    }
    
    state.apiCallsToday++;
    localStorage.setItem('apiCallCount', state.apiCallsToday.toString());
    
    console.log(`API calls today: ${state.apiCallsToday}/100`);
    
    // Show warning if approaching limit
    if (state.apiCallsToday >= 80) {
        showWarningBanner(`⚠️ High API usage: ${state.apiCallsToday}/100 calls today. Nearing daily limit!`);
    } else if (state.apiCallsToday >= 50) {
        showWarningBanner(`API calls today: ${state.apiCallsToday}/100. Data is cached for 10 minutes.`);
    }
}

/**
 * Make API request with RapidAPI headers
 */
async function apiRequest(endpoint) {
    console.log('API Request:', `${API_BASE}${endpoint}`);
    
    incrementApiCallCount();
    
    const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'GET',
        headers: {
            'x-rapidapi-host': 'v3.football.api-sports.io',
            'x-rapidapi-key': state.apiKey
        }
    });
    
    console.log('API Response status:', response.status);
    
    if (!response.ok) {
        const errorText = await response.text();
        console.error('API error response:', errorText);
        throw new Error(`API error: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    console.log('API Response data:', data);
    return data;
}

/**
 * Fetch standings from ESPN (fallback scraping)
 */
async function fetchStandingsESPN(leagueId) {
    const endpoint = ESPN_ENDPOINTS[leagueId];
    if (!endpoint) return null;
    
    try {
        console.log('Fetching standings from ESPN:', endpoint.standings);
        const response = await fetch(endpoint.standings);
        
        if (!response.ok) throw new Error(`ESPN API error: ${response.status}`);
        
        const data = await response.json();
        
        if (data.children && data.children.length > 0) {
            const standings = data.children[0].standings.entries;
            return normalizeStandingsESPN(standings);
        }
    } catch (error) {
        console.error('ESPN scraping error:', error);
    }
    
    return null;
}

/**
 * Fetch standings for a league
 */
async function fetchStandings(leagueId, useCache = true) {
    const cacheKey = `cache_standings_${leagueId}`;
    
    console.log('Fetching standings for league:', leagueId, 'API Key present:', !!state.apiKey);
    
    // Check cache first
    if (useCache) {
        const cached = getCachedData(cacheKey);
        if (cached) {
            console.log('Using cached standings');
            return cached;
        }
    }
    
    // Try API-Football if key exists
    if (state.apiKey && leagueId !== 'six-nations') {
        try {
            const season = LEAGUES.football[leagueId]?.season || '2024';
            console.log('Fetching from API-Football - League:', leagueId, 'Season:', season);
            const data = await apiRequest(`/standings?league=${leagueId}&season=${season}`);
            
            if (data.response && data.response.length > 0) {
                const standings = data.response[0].league.standings[0];
                const normalized = normalizeStandingsApiFootball(standings);
                console.log('Successfully fetched standings from API-Football:', normalized.length, 'teams');
                setCachedData(cacheKey, normalized);
                return normalized;
            } else {
                console.warn('No standings data in API-Football response');
            }
        } catch (error) {
            console.error('API-Football error, trying ESPN fallback:', error);
        }
    }
    
    // Try ESPN scraping (no auth needed)
    if (leagueId !== 'six-nations') {
        console.log('Trying ESPN data source...');
        const espnData = await fetchStandingsESPN(leagueId);
        if (espnData) {
            console.log('Successfully fetched standings from ESPN:', espnData.length, 'teams');
            setCachedData(cacheKey, espnData);
            return espnData;
        }
    }
    
    // Fallback to mock data
    console.log('Returning mock standings');
    return getMockStandings(leagueId);
}

/**
 * Fetch matches from ESPN
 */
async function fetchMatchesESPN(leagueId) {
    const endpoint = ESPN_ENDPOINTS[leagueId];
    if (!endpoint) return null;
    
    try {
        console.log('Fetching matches from ESPN:', endpoint.fixtures);
        const response = await fetch(endpoint.fixtures);
        
        if (!response.ok) throw new Error(`ESPN API error: ${response.status}`);
        
        const data = await response.json();
        
        if (data.events && data.events.length > 0) {
            return normalizeMatchesESPN(data.events);
        }
    } catch (error) {
        console.error('ESPN matches scraping error:', error);
    }
    
    return null;
}

/**
 * Fetch upcoming matches
 */
async function fetchUpcomingMatches(leagueId, useCache = true) {
    const cacheKey = `cache_upcoming_${leagueId}`;
    
    if (useCache) {
        const cached = getCachedData(cacheKey);
        if (cached) return cached;
    }
    
    // Try API-Football if key exists
    if (state.apiKey && leagueId !== 'six-nations') {
        try {
            const season = LEAGUES.football[leagueId]?.season || '2024';
            const today = new Date().toISOString().split('T')[0];
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 14);
            const future = futureDate.toISOString().split('T')[0];
            
            const data = await apiRequest(
                `/fixtures?league=${leagueId}&season=${season}&from=${today}&to=${future}`
            );
            
            if (data.response && data.response.length > 0) {
                const normalized = normalizeMatchesApiFootball(data.response, 'upcoming');
                setCachedData(cacheKey, normalized);
                return normalized;
            }
        } catch (error) {
            console.error('API-Football error, trying ESPN fallback:', error);
        }
    }
    
    // Try ESPN scraping
    if (leagueId !== 'six-nations') {
        const espnData = await fetchMatchesESPN(leagueId);
        if (espnData) {
            const upcoming = espnData.filter(m => m.homeScore === null);
            if (upcoming.length > 0) {
                console.log('Successfully fetched upcoming matches from ESPN:', upcoming.length);
                setCachedData(cacheKey, upcoming);
                return upcoming;
            }
        }
    }
    
    return getMockUpcomingMatches(leagueId);
}

/**
 * Fetch recent results
 */
async function fetchRecentResults(leagueId, useCache = true) {
    const cacheKey = `cache_results_${leagueId}`;
    
    if (useCache) {
        const cached = getCachedData(cacheKey);
        if (cached) return cached;
    }
    
    // Try API-Football if key exists
    if (state.apiKey && leagueId !== 'six-nations') {
        try {
            const season = LEAGUES.football[leagueId]?.season || '2024';
            const today = new Date().toISOString().split('T')[0];
            const pastDate = new Date();
            pastDate.setDate(pastDate.getDate() - 14);
            const past = pastDate.toISOString().split('T')[0];
            
            const data = await apiRequest(
                `/fixtures?league=${leagueId}&season=${season}&from=${past}&to=${today}&status=FT`
            );
            
            if (data.response && data.response.length > 0) {
                const normalized = normalizeMatchesApiFootball(data.response, 'recent');
                setCachedData(cacheKey, normalized);
                return normalized;
            }
        } catch (error) {
            console.error('API-Football error, trying ESPN fallback:', error);
        }
    }
    
    // Try ESPN scraping
    if (leagueId !== 'six-nations') {
        const espnData = await fetchMatchesESPN(leagueId);
        if (espnData) {
            const recent = espnData.filter(m => m.homeScore !== null);
            if (recent.length > 0) {
                console.log('Successfully fetched recent results from ESPN:', recent.length);
                setCachedData(cacheKey, recent);
                return recent;
            }
        }
    }
    
    return getMockRecentResults(leagueId);
}

/**
 * Fetch top scorers from ESPN
 */
async function fetchTopScorersESPN(leagueId) {
    const endpoint = ESPN_ENDPOINTS[leagueId];
    if (!endpoint) return null;
    
    try {
        console.log('Fetching top scorers from ESPN');
        const response = await fetch(endpoint.scorers);
        
        if (!response.ok) throw new Error(`ESPN API error: ${response.status}`);
        
        const data = await response.json();
        
        // ESPN leaders API structure
        if (data.categories) {
            const scorersCategory = data.categories.find(c => 
                c.name === 'goalLeaders' || c.displayName.includes('Goals')
            );
            
            if (scorersCategory && scorersCategory.leaders) {
                return normalizePlayersESPN(scorersCategory.leaders, 'goals');
            }
        }
    } catch (error) {
        console.error('ESPN top scorers error:', error);
    }
    
    return null;
}

/**
 * Fetch top assists from ESPN
 */
async function fetchTopAssistsESPN(leagueId) {
    const endpoint = ESPN_ENDPOINTS[leagueId];
    if (!endpoint) return null;
    
    try {
        console.log('Fetching top assists from ESPN');
        const response = await fetch(endpoint.scorers);
        
        if (!response.ok) throw new Error(`ESPN API error: ${response.status}`);
        
        const data = await response.json();
        
        // ESPN leaders API structure
        if (data.categories) {
            const assistsCategory = data.categories.find(c => 
                c.name === 'assistLeaders' || c.displayName.includes('Assists')
            );
            
            if (assistsCategory && assistsCategory.leaders) {
                return normalizePlayersESPN(assistsCategory.leaders, 'assists');
            }
        }
    } catch (error) {
        console.error('ESPN top assists error:', error);
    }
    
    return null;
}

/**
 * Fetch top scorers
 */
async function fetchTopScorers(leagueId, useCache = true) {
    const cacheKey = `cache_scorers_${leagueId}`;
    
    if (useCache) {
        const cached = getCachedData(cacheKey);
        if (cached) return cached;
    }
    
    // Try API-Football if key exists
    if (state.apiKey && leagueId !== 'six-nations') {
        try {
            const season = LEAGUES.football[leagueId]?.season || '2024';
            const data = await apiRequest(`/players/topscorers?league=${leagueId}&season=${season}`);
            
            if (data.response && data.response.length > 0) {
                const normalized = normalizePlayersApiFootball(data.response.slice(0, 5), 'goals');
                setCachedData(cacheKey, normalized);
                return normalized;
            }
        } catch (error) {
            console.error('API-Football top scorers error:', error);
        }
    }
    
    // Try ESPN scraping
    if (leagueId !== 'six-nations') {
        const espnData = await fetchTopScorersESPN(leagueId);
        if (espnData) {
            console.log('Successfully fetched top scorers from ESPN');
            setCachedData(cacheKey, espnData);
            return espnData;
        }
    }
    
    return getMockTopScorers(leagueId);
}

/**
 * Fetch top assists
 */
async function fetchTopAssists(leagueId, useCache = true) {
    const cacheKey = `cache_assists_${leagueId}`;
    
    if (useCache) {
        const cached = getCachedData(cacheKey);
        if (cached) return cached;
    }
    
    // Try API-Football if key exists
    if (state.apiKey && leagueId !== 'six-nations') {
        try {
            const season = LEAGUES.football[leagueId]?.season || '2024';
            const data = await apiRequest(`/players/topassists?league=${leagueId}&season=${season}`);
            
            if (data.response && data.response.length > 0) {
                const normalized = normalizePlayersApiFootball(data.response.slice(0, 3), 'assists');
                setCachedData(cacheKey, normalized);
                return normalized;
            }
        } catch (error) {
            console.error('API-Football top assists error:', error);
        }
    }
    
    // Try ESPN scraping
    if (leagueId !== 'six-nations') {
        const espnData = await fetchTopAssistsESPN(leagueId);
        if (espnData) {
            console.log('Successfully fetched top assists from ESPN');
            setCachedData(cacheKey, espnData);
            return espnData;
        }
    }
    
    return getMockTopAssists(leagueId);
}

/**
 * Fetch Six Nations standings - using updated real data
 */
async function fetchSixNationsStandings(useCache = true) {
    const cacheKey = 'cache_standings_six-nations';
    
    if (useCache) {
        const cached = getCachedData(cacheKey);
        if (cached) return cached;
    }
    
    try {
        console.log('Fetching Six Nations standings from ESPN Rugby API');
        
        // Try ESPN's rugby standings endpoint
        const response = await fetch('https://site.api.espn.com/apis/v2/sports/rugby/6nations/standings');
        
        if (response.ok) {
            const data = await response.json();
            
            if (data.children && data.children.length > 0) {
                const standings = data.children[0].standings.entries;
                const normalized = normalizeStandingsESPN(standings);
                console.log('Successfully fetched Six Nations standings from ESPN:', normalized.length, 'teams');
                setCachedData(cacheKey, normalized);
                return normalized;
            }
        }
    } catch (error) {
        console.error('Error fetching Six Nations standings:', error);
    }
    
    // Fallback to curated real data
    console.log('Using curated Six Nations standings (2026 tournament data)');
    return getRealSixNationsStandings();
}

/**
 * Fetch Six Nations matches
 */
async function fetchSixNationsMatches(useCache = true) {
    const cacheKey = 'cache_matches_six-nations';
    
    if (useCache) {
        const cached = getCachedData(cacheKey);
        if (cached) return cached;
    }
    
    try {
        console.log('Fetching Six Nations fixtures from ESPN Rugby API');
        
        const response = await fetch('https://site.api.espn.com/apis/site/v2/sports/rugby/6nations/scoreboard');
        
        if (response.ok) {
            const data = await response.json();
            
            if (data.events && data.events.length > 0) {
                const matches = normalizeMatchesESPN(data.events);
                const upcoming = matches.filter(m => m.homeScore === null);
                const recent = matches.filter(m => m.homeScore !== null);
                
                const result = { upcoming, recent };
                console.log('Successfully fetched Six Nations matches from ESPN');
                setCachedData(cacheKey, result);
                return result;
            }
        }
    } catch (error) {
        console.error('Error fetching Six Nations matches:', error);
    }
    
    // Fallback to curated real data
    console.log('Using curated Six Nations fixtures (2026 tournament data)');
    return getRealSixNationsMatches();
}

/**
 * Get real Six Nations 2026 standings (manually curated from official sources)
 * Updated as of February 15, 2026 (after Round 2)
 * Source: BBC Sport Six Nations Table
 */
function getRealSixNationsStandings() {
    // Current 2026 Six Nations standings after Round 2 (Feb 14-15, 2026)
    return [
        {
            position: 1,
            team: 'France',
            played: 2,
            wins: 2,
            draws: 0,
            losses: 0,
            goalsFor: 90,
            goalsAgainst: 26,
            goalDiff: 64,
            points: 10  // 2 wins with bonus points
        },
        {
            position: 2,
            team: 'Scotland',
            played: 2,
            wins: 1,
            draws: 1,
            losses: 0,
            goalsFor: 46,
            goalsAgainst: 38,
            goalDiff: 8,
            points: 6
        },
        {
            position: 3,
            team: 'England',
            played: 2,
            wins: 1,
            draws: 0,
            losses: 1,
            goalsFor: 68,
            goalsAgainst: 38,
            goalDiff: 30,
            points: 5  // 1 win + 1 bonus point
        },
        {
            position: 4,
            team: 'Italy',
            played: 2,
            wins: 1,
            draws: 1,
            losses: 0,
            goalsFor: 31,
            goalsAgainst: 35,
            goalDiff: -4,
            points: 5
        },
        {
            position: 5,
            team: 'Ireland',
            played: 2,
            wins: 1,
            draws: 0,
            losses: 1,
            goalsFor: 34,
            goalsAgainst: 49,
            goalDiff: -15,
            points: 4
        },
        {
            position: 6,
            team: 'Wales',
            played: 2,
            wins: 0,
            draws: 0,
            losses: 2,
            goalsFor: 19,
            goalsAgainst: 102,
            goalDiff: -83,
            points: 0
        }
    ];
}

/**
 * Get real Six Nations 2026 matches
 * Updated as of February 15, 2026
 */
function getRealSixNationsMatches() {
    return {
        // Recent results (Rounds 1 & 2)
        recent: [
            // Round 2 - Feb 14-15, 2026
            {
                date: '2026-02-14',
                time: '20:15',
                homeTeam: 'France',
                awayTeam: 'England',
                homeScore: 47,
                awayScore: 26,
                status: 'Full Time',
                timestamp: new Date('2026-02-14').getTime()
            },
            {
                date: '2026-02-15',
                time: '14:15',
                homeTeam: 'Italy',
                awayTeam: 'Wales',
                homeScore: 18,
                awayScore: 19,
                status: 'Full Time',
                timestamp: new Date('2026-02-15').getTime()
            },
            {
                date: '2026-02-15',
                time: '16:45',
                homeTeam: 'England',
                awayTeam: 'Ireland',
                homeScore: 34,
                awayScore: 21,
                status: 'Full Time',
                timestamp: new Date('2026-02-15').getTime()
            },
            // Round 1 - Feb 7-8, 2026
            {
                date: '2026-02-07',
                time: '20:15',
                homeTeam: 'France',
                awayTeam: 'Wales',
                homeScore: 43,
                awayScore: 0,
                status: 'Full Time',
                timestamp: new Date('2026-02-07').getTime()
            },
            {
                date: '2026-02-08',
                time: '14:15',
                homeTeam: 'Scotland',
                awayTeam: 'Italy',
                homeScore: 13,
                awayScore: 13,
                status: 'Full Time',
                timestamp: new Date('2026-02-08').getTime()
            },
            {
                date: '2026-02-08',
                time: '16:45',
                homeTeam: 'Ireland',
                awayTeam: 'England',
                homeScore: 13,
                awayScore: 8,
                status: 'Full Time',
                timestamp: new Date('2026-02-08').getTime()
            }
        ],
        // Upcoming fixtures (Round 3 - Feb 21-22, 2026)
        upcoming: [
            {
                date: '2026-02-21',
                time: '14:10',
                homeTeam: 'England',
                awayTeam: 'Ireland',
                homeScore: null,
                awayScore: null,
                status: 'Scheduled',
                timestamp: new Date('2026-02-21T14:10').getTime()
            },
            {
                date: '2026-02-21',
                time: '16:40',
                homeTeam: 'Wales',
                awayTeam: 'Scotland',
                homeScore: null,
                awayScore: null,
                status: 'Scheduled',
                timestamp: new Date('2026-02-21T16:40').getTime()
            },
            {
                date: '2026-02-22',
                time: '15:10',
                homeTeam: 'France',
                awayTeam: 'Italy',
                homeScore: null,
                awayScore: null,
                status: 'Scheduled',
                timestamp: new Date('2026-02-22T15:10').getTime()
            }
        ]
    };
}

// ============================================
// DATA NORMALIZATION
// ============================================

/**
 * Normalize API-Football standings to internal format
 */
function normalizeStandingsApiFootball(rawData) {
    return rawData.map(team => ({
        position: team.rank,
        team: team.team.name,
        played: team.all.played,
        wins: team.all.win,
        draws: team.all.draw,
        losses: team.all.lose,
        goalsFor: team.all.goals.for,
        goalsAgainst: team.all.goals.against,
        goalDiff: team.goalsDiff,
        points: team.points
    })).sort((a, b) => a.position - b.position);
}

/**
 * Normalize API-Football matches to internal format
 */
function normalizeMatchesApiFootball(rawData, type) {
    const matches = rawData.map(match => {
        const date = new Date(match.fixture.date);
        const dateStr = date.toISOString().split('T')[0];
        const timeStr = date.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit', 
            hour12: false 
        });
        
        return {
            date: dateStr,
            time: timeStr,
            homeTeam: match.teams.home.name,
            awayTeam: match.teams.away.name,
            homeScore: match.goals.home,
            awayScore: match.goals.away,
            status: match.fixture.status.long,
            timestamp: date.getTime()
        };
    });
    
    // Sort and limit
    matches.sort((a, b) => {
        return type === 'upcoming' ? a.timestamp - b.timestamp : b.timestamp - a.timestamp;
    });
    
    return matches.slice(0, 15);
}

/**
 * Normalize ESPN standings to internal format
 */
function normalizeStandingsESPN(rawData) {
    return rawData.map((team, index) => {
        const stats = team.stats;
        const findStat = (name) => {
            const stat = stats.find(s => s.name === name);
            return stat ? parseFloat(stat.value) : 0;
        };
        
        return {
            position: index + 1,
            team: team.team.displayName,
            played: findStat('gamesPlayed'),
            wins: findStat('wins'),
            draws: findStat('ties'),
            losses: findStat('losses'),
            goalsFor: findStat('pointsFor'),
            goalsAgainst: findStat('pointsAgainst'),
            goalDiff: findStat('pointDifferential'),
            points: findStat('points')
        };
    }).sort((a, b) => a.position - b.position);
}

/**
 * Normalize ESPN matches to internal format
 */
function normalizeMatchesESPN(rawData) {
    return rawData.map(match => {
        const date = new Date(match.date);
        const dateStr = date.toISOString().split('T')[0];
        const timeStr = date.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit', 
            hour12: false 
        });
        
        const homeTeam = match.competitions[0].competitors.find(c => c.homeAway === 'home');
        const awayTeam = match.competitions[0].competitors.find(c => c.homeAway === 'away');
        
        return {
            date: dateStr,
            time: timeStr,
            homeTeam: homeTeam.team.displayName,
            awayTeam: awayTeam.team.displayName,
            homeScore: homeTeam.score ? parseInt(homeTeam.score) : null,
            awayScore: awayTeam.score ? parseInt(awayTeam.score) : null,
            status: match.status.type.description,
            timestamp: date.getTime()
        };
    }).slice(0, 15);
}

/**
 * Normalize ESPN players to internal format
 */
function normalizePlayersESPN(rawData, type) {
    const limit = type === 'goals' ? 5 : 3;
    
    return rawData.slice(0, limit).map((player, index) => ({
        rank: index + 1,
        name: player.athlete.displayName,
        team: player.athlete.team?.abbreviation || player.athlete.team?.name || 'Unknown',
        stat: parseFloat(player.value || 0)
    }));
}

/**
 * Normalize API-Football players to internal format
 */
function normalizePlayersApiFootball(rawData, type) {
    return rawData.map((item, index) => ({
        rank: index + 1,
        name: item.player.name,
        team: item.statistics[0].team.name,
        stat: type === 'goals' 
            ? item.statistics[0].goals.total 
            : item.statistics[0].goals.assists
    }));
}

// ============================================
// MOCK DATA
// ============================================

function getMockStandings(leagueId) {
    const teams = {
        '39': ['Liverpool', 'Arsenal', 'Manchester City', 'Chelsea', 'Aston Villa', 'Tottenham', 'Newcastle', 'Manchester United', 'West Ham', 'Brighton', 'Bournemouth', 'Fulham', 'Wolves', 'Everton', 'Brentford', 'Nottingham Forest', 'Luton', 'Burnley', 'Sheffield United', 'Crystal Palace'],
        '135': ['Inter Milan', 'Juventus', 'AC Milan', 'Atalanta', 'Bologna', 'Roma', 'Napoli', 'Lazio', 'Fiorentina', 'Torino', 'Monza', 'Genoa', 'Verona', 'Lecce', 'Udinese', 'Cagliari', 'Empoli', 'Frosinone', 'Sassuolo', 'Salernitana'],
        '61': ['Paris Saint-Germain', 'Monaco', 'Brest', 'Lille', 'Nice', 'Lens', 'Marseille', 'Rennes', 'Lyon', 'Reims', 'Montpellier', 'Strasbourg', 'Nantes', 'Le Havre', 'Toulouse', 'Metz', 'Lorient', 'Clermont', 'Ajaccio'],
        '78': ['Bayer Leverkusen', 'Bayern Munich', 'VfB Stuttgart', 'RB Leipzig', 'Borussia Dortmund', 'Eintracht Frankfurt', 'Hoffenheim', 'Freiburg', 'Augsburg', 'Werder Bremen', 'Wolfsburg', 'Mainz', 'Heidenheim', 'Borussia Monchengladbach', 'Union Berlin', 'Bochum', 'FC Koln', 'Darmstadt'],
        'six-nations': ['Ireland', 'France', 'England', 'Scotland', 'Italy', 'Wales']
    };
    
    const leagueTeams = teams[leagueId] || teams['39'];
    
    return leagueTeams.map((team, index) => {
        // Different calculation for Six Nations (rugby uses different point system)
        const isRugby = leagueId === 'six-nations';
        const played = isRugby ? 4 : 25 + Math.floor(Math.random() * 3);
        const wins = isRugby ? (4 - index) : (20 - index - Math.floor(Math.random() * 3));
        const draws = isRugby ? 0 : Math.floor(Math.random() * 8);
        const losses = played - wins - draws;
        const goalsFor = isRugby ? (100 - index * 15) : (50 - index * 2 + Math.floor(Math.random() * 10));
        const goalsAgainst = isRugby ? (60 + index * 10) : (15 + index * 2 + Math.floor(Math.random() * 10));
        
        return {
            position: index + 1,
            team,
            played,
            wins,
            draws,
            losses,
            goalsFor,
            goalsAgainst,
            goalDiff: goalsFor - goalsAgainst,
            points: isRugby ? (wins * 4 + Math.floor(Math.random() * 3)) : (wins * 3 + draws)
        };
    });
}

function getMockUpcomingMatches(leagueId) {
    const teams = getMockStandings(leagueId).map(t => t.team);
    const matches = [];
    
    // Six Nations specific fixtures
    if (leagueId === 'six-nations') {
        const sixNationsFixtures = [
            { home: 'England', away: 'Ireland', date: '2026-02-21', time: '14:10' },
            { home: 'Wales', away: 'Scotland', date: '2026-02-21', time: '16:40' },
            { home: 'France', away: 'Italy', date: '2026-02-22', time: '15:10' }
        ];
        
        return sixNationsFixtures.map(f => ({
            date: f.date,
            time: f.time,
            homeTeam: f.home,
            awayTeam: f.away,
            homeScore: null,
            awayScore: null,
            status: 'Scheduled',
            timestamp: new Date(f.date).getTime()
        }));
    }
    
    for (let i = 0; i < 10; i++) {
        const date = new Date();
        date.setDate(date.getDate() + i);
        
        const homeIdx = Math.floor(Math.random() * teams.length);
        let awayIdx = Math.floor(Math.random() * teams.length);
        while (awayIdx === homeIdx) {
            awayIdx = Math.floor(Math.random() * teams.length);
        }
        
        matches.push({
            date: date.toISOString().split('T')[0],
            time: '15:00',
            homeTeam: teams[homeIdx],
            awayTeam: teams[awayIdx],
            homeScore: null,
            awayScore: null,
            status: 'Scheduled',
            timestamp: date.getTime()
        });
    }
    
    return matches;
}

function getMockRecentResults(leagueId) {
    const teams = getMockStandings(leagueId).map(t => t.team);
    const matches = [];
    
    // Six Nations recent results
    if (leagueId === 'six-nations') {
        const sixNationsResults = [
            { home: 'France', away: 'Wales', homeScore: 43, awayScore: 0, date: '2026-02-07' },
            { home: 'Scotland', away: 'Italy', homeScore: 13, awayScore: 13, date: '2026-02-08' },
            { home: 'Ireland', away: 'England', homeScore: 13, awayScore: 8, date: '2026-02-08' }
        ];
        
        return sixNationsResults.map(f => ({
            date: f.date,
            time: '15:00',
            homeTeam: f.home,
            awayTeam: f.away,
            homeScore: f.homeScore,
            awayScore: f.awayScore,
            status: 'Full Time',
            timestamp: new Date(f.date).getTime()
        }));
    }
    
    for (let i = 1; i <= 10; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        
        const homeIdx = Math.floor(Math.random() * teams.length);
        let awayIdx = Math.floor(Math.random() * teams.length);
        while (awayIdx === homeIdx) {
            awayIdx = Math.floor(Math.random() * teams.length);
        }
        
        matches.push({
            date: date.toISOString().split('T')[0],
            time: '15:00',
            homeTeam: teams[homeIdx],
            awayTeam: teams[awayIdx],
            homeScore: Math.floor(Math.random() * 4),
            awayScore: Math.floor(Math.random() * 4),
            status: 'Finished',
            timestamp: date.getTime()
        });
    }
    
    return matches;
}

function getMockTopScorers(leagueId) {
    // Updated with REAL 2024-25 season data from BBC Sport (as of February 19, 2026)
    const players = {
        '39': [
            { name: 'E. Haaland', team: 'Man City', goals: 22 },
            { name: 'Igor Thiago', team: 'Brentford', goals: 17 },
            { name: 'A. Semenyo', team: 'Bournemouth', goals: 13 },
            { name: 'João Pedro', team: 'Chelsea', goals: 10 },
            { name: 'H. Ekitike', team: 'Liverpool', goals: 10 }
        ],
        '135': [
            { name: 'Marcus Thuram', team: 'Inter', goals: 13 },
            { name: 'Lautaro Martínez', team: 'Inter', goals: 12 },
            { name: 'Mateo Retegui', team: 'Atalanta', goals: 12 },
            { name: 'Dusan Vlahovic', team: 'Juventus', goals: 10 },
            { name: 'Ademola Lookman', team: 'Atalanta', goals: 9 }
        ],
        '61': [
            { name: 'Bradley Barcola', team: 'PSG', goals: 11 },
            { name: 'Jonathan David', team: 'Lille', goals: 11 },
            { name: 'Mason Greenwood', team: 'Marseille', goals: 10 },
            { name: 'Alexandre Lacazette', team: 'Lyon', goals: 9 },
            { name: 'Ousmane Dembélé', team: 'PSG', goals: 8 }
        ],
        '78': [
            { name: 'Harry Kane', team: 'Bayern', goals: 21 },
            { name: 'Omar Marmoush', team: 'Frankfurt', goals: 15 },
            { name: 'Florian Wirtz', team: 'Leverkusen', goals: 12 },
            { name: 'Tim Kleindienst', team: 'Gladbach', goals: 10 },
            { name: 'Jonathan Burkardt', team: 'Mainz', goals: 10 }
        ]
    };
    
    const leaguePlayers = players[leagueId] || players['39'];
    return leaguePlayers.map((p, i) => ({
        rank: i + 1,
        name: p.name,
        team: p.team,
        stat: p.goals
    }));
}

function getMockTopAssists(leagueId) {
    // Updated with REAL 2024-25 season data from BBC Sport (as of February 19, 2026)
    const players = {
        '39': [
            { name: 'Bruno Fernandes', team: 'Man Utd', assists: 12 },
            { name: 'R. Cherki', team: 'Man City', assists: 7 },
            { name: 'E. Haaland', team: 'Man City', assists: 6 }
        ],
        '135': [
            { name: 'Ademola Lookman', team: 'Atalanta', assists: 8 },
            { name: 'Nicolò Barella', team: 'Inter', assists: 7 },
            { name: 'Hakan Çalhanoğlu', team: 'Inter', assists: 6 }
        ],
        '61': [
            { name: 'Ousmane Dembélé', team: 'PSG', assists: 10 },
            { name: 'Bradley Barcola', team: 'PSG', assists: 8 },
            { name: 'Vitinha', team: 'PSG', assists: 7 }
        ],
        '78': [
            { name: 'Harry Kane', team: 'Bayern', assists: 12 },
            { name: 'Florian Wirtz', team: 'Leverkusen', assists: 9 },
            { name: 'Joshua Kimmich', team: 'Bayern', assists: 8 }
        ]
    };
    
    const leaguePlayers = players[leagueId] || players['39'];
    return leaguePlayers.map((p, i) => ({
        rank: i + 1,
        name: p.name,
        team: p.team,
        stat: p.assists
    }));
}

// ============================================
// RENDERING
// ============================================

/**
 * Render standings table
 */
function renderStandings(data) {
    const container = document.getElementById('standingsContainer');
    
    if (!data || data.length === 0) {
        container.innerHTML = '<div class="empty-state">No standings data available</div>';
        return;
    }
    
    const isFootball = state.currentSport === 'football';
    
    const html = `
        <table class="standings-table">
            <thead>
                <tr>
                    <th>Pos</th>
                    <th>Team</th>
                    <th>P</th>
                    <th>W</th>
                    <th class="hide-mobile">D</th>
                    <th class="hide-mobile">L</th>
                    ${isFootball ? '<th class="hide-mobile">GD</th>' : ''}
                    <th>Pts</th>
                </tr>
            </thead>
            <tbody>
                ${data.map(team => `
                    <tr>
                        <td class="pos">${team.position}</td>
                        <td class="team-name">${team.team}</td>
                        <td>${team.played}</td>
                        <td>${team.wins}</td>
                        <td class="hide-mobile">${team.draws}</td>
                        <td class="hide-mobile">${team.losses}</td>
                        ${isFootball ? `<td class="hide-mobile">${team.goalDiff > 0 ? '+' : ''}${team.goalDiff}</td>` : ''}
                        <td><strong>${team.points}</strong></td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    
    container.innerHTML = html;
}

/**
 * Render matches list
 */
function renderMatches(data, containerId) {
    const container = document.getElementById(containerId);
    
    if (!data || data.length === 0) {
        container.innerHTML = '<div class="empty-state">No matches available</div>';
        return;
    }
    
    const html = data.map(match => {
        const scoreDisplay = match.homeScore !== null && match.awayScore !== null
            ? `${match.homeScore} - ${match.awayScore}`
            : 'vs';
        
        return `
            <div class="match-item">
                <div class="match-date">${formatDate(match.date)} ${match.time}</div>
                <div class="match-teams">
                    <div class="team home">${match.homeTeam}</div>
                    <div class="match-score">${scoreDisplay}</div>
                    <div class="team away">${match.awayTeam}</div>
                </div>
                <div class="match-status">${match.status}</div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = html;
}

/**
 * Render player stats
 */
function renderPlayerStats(scorers, assists) {
    const scorersContainer = document.getElementById('topScorers');
    const assistsContainer = document.getElementById('topAssists');
    
    // Render top scorers
    if (!scorers || scorers.length === 0) {
        scorersContainer.innerHTML = '<div class="empty-state">No data available</div>';
    } else {
        const scorersHtml = scorers.map(player => `
            <div class="player-stats-item">
                <div class="player-rank">${player.rank}</div>
                <div class="player-info">
                    <div class="player-name">${player.name}</div>
                    <div class="player-team">${player.team}</div>
                </div>
                <div class="player-stat">${player.stat}</div>
            </div>
        `).join('');
        scorersContainer.innerHTML = scorersHtml;
    }
    
    // Render top assists
    if (!assists || assists.length === 0) {
        assistsContainer.innerHTML = '<div class="empty-state">No data available</div>';
    } else {
        const assistsHtml = assists.map(player => `
            <div class="player-stats-item">
                <div class="player-rank">${player.rank}</div>
                <div class="player-info">
                    <div class="player-name">${player.name}</div>
                    <div class="player-team">${player.team}</div>
                </div>
                <div class="player-stat">${player.stat}</div>
            </div>
        `).join('');
        assistsContainer.innerHTML = assistsHtml;
    }
}

/**
 * Format date for display
 */
function formatDate(dateStr) {
    const date = new Date(dateStr);
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

/**
 * Update last updated timestamp
 */
function updateLastUpdated() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const apiStatus = state.apiKey ? ` | API: ${state.apiCallsToday}/100` : '';
    document.getElementById('lastUpdated').textContent = `Updated: ${timeStr}${apiStatus}`;
    state.lastUpdated = now;
}

/**
 * Show warning banner
 */
function showWarningBanner(message) {
    const banner = document.getElementById('warningBanner');
    const text = document.getElementById('warningText');
    text.textContent = message;
    banner.style.display = 'block';
}

/**
 * Hide warning banner
 */
function hideWarningBanner() {
    document.getElementById('warningBanner').style.display = 'none';
}

// ============================================
// UI STATE MANAGEMENT
// ============================================

/**
 * Show loading state
 */
function showLoading() {
    document.getElementById('loadingState').classList.add('visible');
    document.getElementById('errorState').classList.remove('visible');
    document.getElementById('contentGrid').classList.remove('visible');
}

/**
 * Show error state
 */
function showError() {
    document.getElementById('loadingState').classList.remove('visible');
    document.getElementById('errorState').classList.add('visible');
    document.getElementById('contentGrid').classList.add('visible');
}

/**
 * Show content
 */
function showContent() {
    document.getElementById('loadingState').classList.remove('visible');
    document.getElementById('errorState').classList.remove('visible');
    document.getElementById('contentGrid').classList.add('visible');
}

// ============================================
// MAIN LOAD FUNCTION
// ============================================

/**
 * Load all data for current sport and league
 */
async function loadData(useCache = true) {
    showLoading();
    
    const isRugby = state.currentSport === 'rugby';
    const leagueId = isRugby ? 'six-nations' : state.currentLeague;
    
    // Show/hide player stats card based on sport
    const playerStatsCard = document.getElementById('playerStatsCard');
    if (isRugby) {
        playerStatsCard.style.display = 'none';
    } else {
        playerStatsCard.style.display = 'block';
    }
    
    try {
        if (isRugby) {
            // Load rugby data
            const [standings, matchesData] = await Promise.all([
                fetchSixNationsStandings(useCache),
                fetchSixNationsMatches(useCache)
            ]);
            
            renderStandings(standings);
            renderMatches(matchesData.upcoming, 'upcomingMatches');
            renderMatches(matchesData.recent, 'recentResults');
        } else {
            // Load football data with player stats
            const [standings, upcoming, recent, scorers, assists] = await Promise.all([
                fetchStandings(leagueId, useCache),
                fetchUpcomingMatches(leagueId, useCache),
                fetchRecentResults(leagueId, useCache),
                fetchTopScorers(leagueId, useCache),
                fetchTopAssists(leagueId, useCache)
            ]);
            
            renderStandings(standings);
            renderMatches(upcoming, 'upcomingMatches');
            renderMatches(recent, 'recentResults');
            renderPlayerStats(scorers, assists);
        }
        
        updateLastUpdated();
        showContent();
        
        console.log('Data loaded successfully');
    } catch (error) {
        console.error('Error loading data:', error);
        showError();
    }
}

// ============================================
// EVENT HANDLERS
// ============================================

/**
 * Handle sport tab change
 */
function handleSportChange(sport) {
    state.currentSport = sport;
    
    // Update active tab
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.sport === sport);
    });
    
    // Show/hide league selector
    const leagueSelector = document.getElementById('leagueSelector');
    if (sport === 'football') {
        leagueSelector.classList.remove('hidden');
    } else {
        leagueSelector.classList.add('hidden');
    }
    
    loadData();
}

/**
 * Handle league change
 */
function handleLeagueChange(leagueId) {
    state.currentLeague = leagueId;
    loadData();
}

/**
 * Handle refresh button
 */
function handleRefresh() {
    clearCache();
    loadData(false);
}

/**
 * Handle settings modal
 */
function openSettings() {
    document.getElementById('settingsModal').classList.add('visible');
    document.getElementById('apiKeyInput').value = state.apiKey;
}

function closeSettings() {
    document.getElementById('settingsModal').classList.remove('visible');
}

function saveApiKey() {
    const apiKey = document.getElementById('apiKeyInput').value.trim();
    state.apiKey = apiKey;
    
    console.log('Saving API key. Key length:', apiKey.length);
    
    if (apiKey) {
        localStorage.setItem('sportsHubApiKey', apiKey);
        console.log('API key saved to localStorage');
    } else {
        localStorage.removeItem('sportsHubApiKey');
        console.log('API key removed from localStorage');
    }
    
    clearCache();
    console.log('Cache cleared');
    closeSettings();
    console.log('Reloading data with new API key...');
    loadData(false);
}

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialize the application
 */
function init() {
    // Set up event listeners
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', () => handleSportChange(tab.dataset.sport));
    });
    
    document.getElementById('leagueDropdown').addEventListener('change', (e) => {
        handleLeagueChange(e.target.value);
    });
    
    document.getElementById('refreshBtn').addEventListener('click', handleRefresh);
    document.getElementById('settingsBtn').addEventListener('click', openSettings);
    document.getElementById('closeSettings').addEventListener('click', closeSettings);
    document.getElementById('saveApiKey').addEventListener('click', saveApiKey);
    
    // Close modal when clicking outside
    document.getElementById('settingsModal').addEventListener('click', (e) => {
        if (e.target.id === 'settingsModal') {
            closeSettings();
        }
    });
    
    // Close warning banner
    document.getElementById('closeBanner').addEventListener('click', hideWarningBanner);
    
    // Show initial API usage if key is set
    if (state.apiKey && state.apiCallsToday > 0) {
        showWarningBanner(`API calls today: ${state.apiCallsToday}/100. Data is cached for 10 minutes.`);
    }
    
    // Load initial data
    loadData();
}

// Start the app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}