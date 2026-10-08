const express = require('express');

const router = express.Router();

const memberSummarySql = `
  SELECT
    m.member_no,
    m.name,
    m.phone,
    m.joined_at,
    m.updated_at,
    COALESCE(SUM(CASE WHEN p.status = 'active' THEN p.points_earned ELSE 0 END), 0) AS total_points,
    CASE
      WHEN COALESCE(SUM(CASE WHEN p.status = 'active' THEN p.points_earned ELSE 0 END), 0) >= 10000 THEN 'Platinum'
      WHEN COALESCE(SUM(CASE WHEN p.status = 'active' THEN p.points_earned ELSE 0 END), 0) >= 5000 THEN 'Gold'
      WHEN COALESCE(SUM(CASE WHEN p.status = 'active' THEN p.points_earned ELSE 0 END), 0) >= 1000 THEN 'Silver'
      ELSE 'Member'
    END AS tier
  FROM members m
  LEFT JOIN purchases p ON p.member_no = m.member_no
`;

function validateMemberInput(body) {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';

  if (!name || name.length > 150) {
    return { error: 'กรุณาระบุชื่อไม่เกิน 150 ตัวอักษร' };
  }

  const digitCount = (phone.match(/\d/g) || []).length;
  if (phone.length < 7 || phone.length > 30 || !/^[0-9+()\-\s]+$/.test(phone) || digitCount < 7) {
    return { error: 'กรุณาระบุเบอร์โทรศัพท์ให้ถูกต้อง (7–30 ตัวอักษร)' };
  }

  return { value: { name, phone } };
}

function parseMemberNo(value) {
  const normalized = String(value).trim().replace(/^M/i, '');
  if (!/^\d+$/.test(normalized)) return null;

  const memberNo = BigInt(normalized);
  if (memberNo < 1n || memberNo > 18446744073709551615n) return null;
  return memberNo.toString();
}

function mapMember(row) {
  const memberNo = String(row.member_no);
  return {
    member_no: memberNo,
    member_code: `M${memberNo.padStart(6, '0')}`,
    name: row.name,
    phone: row.phone,
    joined_at: row.joined_at,
    updated_at: row.updated_at,
    total_points: Number(row.total_points),
    tier: row.tier,
  };
}

// GET /api/members?search=...
router.get('/', async (req, res) => {
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

  try {
    let sql = `${memberSummarySql}`;
    const params = [];

    if (search) {
      const numberSearch = search.replace(/^M/i, '');
      sql += ' WHERE m.name LIKE ?';
      params.push(`%${search}%`);
      if (/^\d+$/.test(numberSearch)) {
        sql += ' OR CAST(m.member_no AS CHAR) LIKE ?';
        params.push(`%${numberSearch}%`);
      }
    }

    sql += ' GROUP BY m.member_no ORDER BY m.member_no DESC';
    const [rows] = await req.db.execute(sql, params);
    return res.json({ data: rows.map(mapMember) });
  } catch (error) {
    console.error('Unable to list members:', error.message);
    return res.status(500).json({ error: 'ไม่สามารถโหลดรายชื่อสมาชิกได้' });
  }
});

// POST /api/members
router.post('/', async (req, res) => {
  const validation = validateMemberInput(req.body || {});
  if (validation.error) return res.status(400).json({ error: validation.error });

  try {
    const [result] = await req.db.execute(
      'INSERT INTO members (name, phone) VALUES (?, ?)',
      [validation.value.name, validation.value.phone],
    );

    const memberNo = String(result.insertId);
    const [rows] = await req.db.execute(
      'SELECT joined_at FROM members WHERE member_no = ?',
      [memberNo],
    );
    return res.status(201).json({
      message: 'สมัครสมาชิกสำเร็จ',
      data: {
        member_no: memberNo,
        member_code: `M${memberNo.padStart(6, '0')}`,
        ...validation.value,
        joined_at: rows[0].joined_at,
        total_points: 0,
        tier: 'Member',
      },
    });
  } catch (error) {
    console.error('Unable to create member:', error.message);
    return res.status(500).json({ error: 'ไม่สามารถสมัครสมาชิกได้' });
  }
});

// GET /api/members/:memberNo
router.get('/:memberNo', async (req, res) => {
  const memberNo = parseMemberNo(req.params.memberNo);
  if (!memberNo) return res.status(400).json({ error: 'เลขสมาชิกไม่ถูกต้อง' });

  try {
    const [rows] = await req.db.execute(
      `${memberSummarySql} WHERE m.member_no = ? GROUP BY m.member_no`,
      [memberNo],
    );
    if (rows.length === 0) return res.status(404).json({ error: 'ไม่พบสมาชิก' });
    return res.json({ data: mapMember(rows[0]) });
  } catch (error) {
    console.error('Unable to load member:', error.message);
    return res.status(500).json({ error: 'ไม่สามารถโหลดข้อมูลสมาชิกได้' });
  }
});

// GET /api/members/:memberNo/purchases
router.get('/:memberNo/purchases', async (req, res) => {
  const memberNo = parseMemberNo(req.params.memberNo);
  if (!memberNo) return res.status(400).json({ error: 'เลขสมาชิกไม่ถูกต้อง' });

  try {
    const [members] = await req.db.execute(
      'SELECT member_no FROM members WHERE member_no = ?',
      [memberNo],
    );
    if (members.length === 0) return res.status(404).json({ error: 'ไม่พบสมาชิก' });

    const [purchases] = await req.db.execute(
      `SELECT purchase_id, member_no, amount, points_earned, status,
              purchased_at, cancelled_at, cancel_reason
       FROM purchases
       WHERE member_no = ?
       ORDER BY purchased_at DESC, purchase_id DESC`,
      [memberNo],
    );
    const [items] = await req.db.execute(
      `SELECT pi.purchase_id, pi.coffee_id, c.name, pi.quantity, pi.unit_price
       FROM purchase_items pi
       INNER JOIN coffees c ON c.coffee_id = pi.coffee_id
       INNER JOIN purchases p ON p.purchase_id = pi.purchase_id
       WHERE p.member_no = ?
       ORDER BY pi.purchase_item_id`,
      [memberNo],
    );
    const itemsByPurchase = new Map();
    for (const item of items) {
      const key = String(item.purchase_id);
      if (!itemsByPurchase.has(key)) itemsByPurchase.set(key, []);
      itemsByPurchase.get(key).push({
        coffee_id: String(item.coffee_id),
        name: item.name,
        quantity: Number(item.quantity),
        unit_price: String(item.unit_price),
      });
    }
    return res.json({
      data: purchases.map((purchase) => ({
        ...purchase,
        purchase_id: String(purchase.purchase_id),
        member_no: String(purchase.member_no),
        amount: String(purchase.amount),
        items: itemsByPurchase.get(String(purchase.purchase_id)) || [],
      })),
    });
  } catch (error) {
    console.error('Unable to load purchase history:', error.message);
    return res.status(500).json({ error: 'ไม่สามารถโหลดประวัติการซื้อได้' });
  }
});

// POST /api/members/:memberNo/update — only name and phone can be changed.
router.post('/:memberNo/update', async (req, res) => {
  const memberNo = parseMemberNo(req.params.memberNo);
  if (!memberNo) return res.status(400).json({ error: 'เลขสมาชิกไม่ถูกต้อง' });

  const validation = validateMemberInput(req.body || {});
  if (validation.error) return res.status(400).json({ error: validation.error });

  try {
    const [result] = await req.db.execute(
      'UPDATE members SET name = ?, phone = ? WHERE member_no = ?',
      [validation.value.name, validation.value.phone, memberNo],
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'ไม่พบสมาชิก' });

    const [rows] = await req.db.execute(
      `${memberSummarySql} WHERE m.member_no = ? GROUP BY m.member_no`,
      [memberNo],
    );
    return res.json({ message: 'แก้ไขข้อมูลสมาชิกสำเร็จ', data: mapMember(rows[0]) });
  } catch (error) {
    console.error('Unable to update member:', error.message);
    return res.status(500).json({ error: 'ไม่สามารถแก้ไขข้อมูลสมาชิกได้' });
  }
});

module.exports = router;
