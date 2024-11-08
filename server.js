const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// Добавляем поддержку JSON
app.use(express.json());
app.use(express.static('.'));

// Простое хранилище данных (в реальном проекте используйте базу данных)
const userProgress = new Map();

// API для получения прогресса
app.get('/api/progress', (req, res) => {
    const userId = req.query.userId;
    const progress = userProgress.get(userId) || {
        level: 1,
        energy: 5,
        boosters: {
            hammer: 2,
            swap: 2,
            rainbow: 1
        }
    };
    res.json(progress);
});

// API для сохранения прогресса
app.post('/api/progress', (req, res) => {
    const { userId, level, score, energy, boosters } = req.body;
    userProgress.set(userId, { level, score, energy, boosters });
    res.json({ success: true });
});

// API для таблицы лидеров
app.get('/api/leaderboard', (req, res) => {
    const leaderboard = Array.from(userProgress.entries())
        .map(([userId, data]) => ({
            userId,
            score: data.score || 0
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
    
    res.json(leaderboard);
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
}); 