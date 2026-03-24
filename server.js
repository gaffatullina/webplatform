const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const app = express();
const db = new sqlite3.Database('./politaktiv.db');

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public'))); // Папка для твоего HTML

// --- Инициализация БД ---
db.serialize(() => {
    // Таблица мероприятий
    db.run(`CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        dateISO TEXT,
        dir TEXT,
        description TEXT,
        complexity INTEGER,
        pts INTEGER,
        organizerId INTEGER
    )`);

    db.get("SELECT COUNT(*) as count FROM events", (err, row) => {
    if (row && row.count === 0) {
        console.log("База пуста. Генерирую фейковые данные...");
        
        const dirs = ['IT', 'SOCIAL', 'MEDIA'];
        const titles = {
            IT: ['Код-лаборатория', 'Техносаммит', 'AI-интенсив', 'Платформа идей'],
            SOCIAL: ['Форум инициатив', 'Школа проектирования', 'Тренинг', 'Волонтерство'],
            MEDIA: ['Медиа-студия', 'Дебаты', 'Сторителлинг', 'Контент-лаборатория']
        };

        const stmt = db.prepare(`INSERT INTO events (title, dateISO, dir, description, complexity, pts, organizerId) VALUES (?, ?, ?, ?, ?, ?, ?)`);
        
        for (let i = 0; i < 55; i++) {
            const dir = dirs[i % 3];
            const title = titles[dir][i % 4];
            const date = new Date();
            date.setDate(date.getDate() + (Math.floor(Math.random() * 50) - 20)); // Разброс дат
            
            stmt.run(
                title + " " + (i + 1),
                date.toISOString().slice(0, 10),
                dir,
                "Автоматически созданное описание для " + title,
                Math.floor(Math.random() * 5) + 1,
                60 + Math.floor(Math.random() * 50),
                "org" + (i % 5)
            );
        }
        stmt.finalize();
        console.log("55 мероприятий успешно добавлены в базу!");
    }
});

    // Таблица участников
    db.run(`CREATE TABLE IF NOT EXISTS participants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fullName TEXT,
        city TEXT,
        age INTEGER
    )`);

    // Таблица заявок на участие (Participations)
    db.run(`CREATE TABLE IF NOT EXISTS participations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        eventId INTEGER,
        participantId INTEGER,
        status TEXT DEFAULT 'requested',
        requestedAt TEXT
    )`);
});

// --- API Эндпоинты ---

// Получить все мероприятия
app.get('/api/events', (req, res) => {
    db.all("SELECT * FROM events ORDER BY dateISO DESC", [], (err, rows) => {
        if (err) res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Создать мероприятие (для Админа/Орга)
app.post('/api/events', (req, res) => {
    const { title, dateISO, dir, description, complexity, pts, organizerId } = req.body;
    db.run(`INSERT INTO events (title, dateISO, dir, description, complexity, pts, organizerId) 
            VALUES (?, ?, ?, ?, ?, ?, ?)`, 
            [title, dateISO, dir, description, complexity, pts, organizerId], 
            function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID });
    });
});

// Подать заявку на участие
app.post('/api/participate', (req, res) => {
    const { eventId, participantId } = req.body;
    const now = new Date().toISOString().slice(0,10);
    db.run(`INSERT INTO participations (eventId, participantId, requestedAt) VALUES (?, ?, ?)`,
        [eventId, participantId, now], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, id: this.lastID });
        });
});

// Получить рейтинг (Leaderboard)
app.get('/api/leaderboard', (req, res) => {
    const query = `
        SELECT p.fullName, p.city, SUM(e.pts * e.complexity) as totalPts, COUNT(pt.id) as evCount
        FROM participants p
        LEFT JOIN participations pt ON p.id = pt.participantId
        LEFT JOIN events e ON pt.eventId = e.id
        WHERE pt.status = 'confirmed'
        GROUP BY p.id
        ORDER BY totalPts DESC
    `;
    db.all(query, [], (err, rows) => {
        res.json(rows);
    });
});

// Запуск сервера
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Сервер запущен: http://localhost:${PORT}`);
});