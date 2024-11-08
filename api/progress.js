export default function handler(req, res) {
  if (req.method === 'GET') {
    // Обработка GET запроса
    const { userId } = req.query;
    // Здесь должна быть логика получения прогресса из БД
    res.json({
      level: 1,
      energy: 5,
      boosters: {
        hammer: 2,
        swap: 2,
        rainbow: 1
      }
    });
  } else if (req.method === 'POST') {
    // Обработка POST запроса
    const { userId, level, score, energy, boosters } = req.body;
    // Здесь должна быть логика сохранения в БД
    res.json({ success: true });
  }
} 