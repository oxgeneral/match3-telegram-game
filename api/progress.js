export default function handler(req, res) {
  if (req.method === 'GET') {
    // Обработка GET запроса
    const { userId } = req.query;
    if (!userId) {
      res.status(400).json({ error: 'userId не предоставлен' });
      return;
    }
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
  } else if (req.method === 'POST') {
    // Обработка POST запроса
    const { userId, level, score, energy, boosters } = req.body;
    if (!userId) {
      res.status(400).json({ error: 'userId не предоставлен' });
      return;
    }
    userProgress.set(userId, { level, score, energy, boosters });
    res.json({ success: true });
  } else {
    res.status(405).json({ error: 'Метод не разрешен' });
  }
} 