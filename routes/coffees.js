const express = require('express');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const [rows] = await req.db.execute(
      'SELECT coffee_id, name, price FROM coffees WHERE is_active = 1 ORDER BY coffee_id',
    );
    return res.json({ data: rows.map((row) => ({ ...row, coffee_id: String(row.coffee_id), price: String(row.price) })) });
  } catch (error) {
    console.error('Unable to load coffees:', error.message);
    return res.status(500).json({ error: 'ไม่สามารถโหลดเมนูกาแฟได้' });
  }
});

module.exports = router;
