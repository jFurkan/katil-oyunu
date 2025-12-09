require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { pool, initDatabase } = require('./database');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '260678';

// Static files
app.use(express.static('public'));

// Root endpoint - Railway health check
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check
app.get('/api/health', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({ status: 'ok' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// Keep alive - Railway might check this
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// Favicon
app.get('/favicon.ico', (req, res) => {
    res.status(204).end();
});

// Socket.IO
io.on('connection', async (socket) => {
    console.log('User connected:', socket.id);

    // İlk bağlantıda teams listesini gönder
    try {
        const teamsResult = await pool.query('SELECT * FROM teams ORDER BY created_at');
        socket.emit('teams-update', teamsResult.rows);
    } catch (err) {
        console.error('Initial teams fetch error:', err);
        socket.emit('teams-update', []);
    }

    // Get all teams
    socket.on('get-teams', async (callback) => {
        try {
            const result = await pool.query('SELECT * FROM teams ORDER BY created_at');
            callback(result.rows);
        } catch (err) {
            console.error('Get teams error:', err);
            callback([]);
        }
    });

    // Create team
    socket.on('create-team', async (data, callback) => {
        try {
            const { name, password, color } = data;

            if (!name || !password) {
                return callback({ success: false, error: 'İsim ve şifre gerekli!' });
            }

            // Check if team exists
            const check = await pool.query('SELECT id FROM teams WHERE name = $1', [name]);
            if (check.rows.length > 0) {
                return callback({ success: false, error: 'Bu takım adı zaten kullanılıyor!' });
            }

            const teamId = 'team_' + Date.now();
            await pool.query(
                'INSERT INTO teams (id, name, password, score, avatar, color) VALUES ($1, $2, $3, 0, $4, $5)',
                [teamId, name, password, '🕵️', color || '#3b82f6']
            );

            const teamResult = await pool.query('SELECT * FROM teams WHERE id = $1', [teamId]);
            const team = teamResult.rows[0];
            team.clues = [];
            team.badges = [];

            callback({ success: true, team });

            const allTeams = await pool.query('SELECT * FROM teams ORDER BY created_at');
            io.emit('teams-update', allTeams.rows);

            console.log('Team created:', name);
        } catch (err) {
            console.error('Create team error:', err);
            callback({ success: false, error: 'Takım oluşturulamadı!' });
        }
    });

    // Join team
    socket.on('join-team', async (data, callback) => {
        try {
            const { teamId, password } = data;

            const result = await pool.query('SELECT * FROM teams WHERE id = $1', [teamId]);
            const team = result.rows[0];

            if (!team) {
                return callback({ success: false, error: 'Takım bulunamadı!' });
            }

            if (team.password !== password) {
                return callback({ success: false, error: 'Yanlış şifre!' });
            }

            const cluesResult = await pool.query('SELECT text, time FROM clues WHERE team_id = $1 ORDER BY created_at', [teamId]);
            team.clues = cluesResult.rows;
            team.badges = [];

            socket.join(teamId);
            callback({ success: true, team });
            console.log('User joined team:', team.name);
        } catch (err) {
            console.error('Join team error:', err);
            callback({ success: false, error: 'Takıma giriş yapılamadı!' });
        }
    });

    // Add clue
    socket.on('add-clue', async (data, callback) => {
        try {
            const { teamId, text, time } = data;

            await pool.query(
                'INSERT INTO clues (team_id, text, time) VALUES ($1, $2, $3)',
                [teamId, text, time]
            );

            const cluesResult = await pool.query('SELECT text, time FROM clues WHERE team_id = $1 ORDER BY created_at', [teamId]);

            callback({ success: true });
            io.to(teamId).emit('clue-added', { text, time });

            const allTeams = await pool.query('SELECT * FROM teams ORDER BY created_at');
            io.emit('teams-update', allTeams.rows);

            console.log('Clue added to team:', teamId);
        } catch (err) {
            console.error('Add clue error:', err);
            callback({ success: false, error: 'İpucu eklenemedi!' });
        }
    });

    // Update score
    socket.on('update-score', async (data, callback) => {
        try {
            const { teamId, amount } = data;

            await pool.query('UPDATE teams SET score = score + $1 WHERE id = $2', [amount, teamId]);

            const teamResult = await pool.query('SELECT * FROM teams WHERE id = $1', [teamId]);
            const team = teamResult.rows[0];

            callback({ success: true });
            io.emit('score-changed', { teamId, teamName: team.name, amount, newScore: team.score });

            const allTeams = await pool.query('SELECT * FROM teams ORDER BY created_at');
            io.emit('teams-update', allTeams.rows);

            console.log('Score updated:', team.name, amount);
        } catch (err) {
            console.error('Update score error:', err);
            callback({ success: false, error: 'Puan güncellenemedi!' });
        }
    });

    // Admin login
    socket.on('admin-login', (password, callback) => {
        if (password === ADMIN_PASSWORD) {
            callback({ success: true });
            console.log('Admin logged in:', socket.id);
        } else {
            callback({ success: false, error: 'Yanlış şifre!' });
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

// Start server
async function start() {
    try {
        await initDatabase();
        server.listen(PORT, '0.0.0.0', () => {
            console.log(`Server running on port ${PORT}`);
        });
    } catch (err) {
        console.error('Server start error:', err);
        process.exit(1);
    }
}

start();
