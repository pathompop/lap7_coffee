const express = require('express');

const router = express.Router();

function parseMemberNo(value) {
  const normalized = String(value).trim().replace(/^M/i, '');
  if (!/^\d+$/.test(normalized)) return null;

  const memberNo = BigInt(normalized);
  if (memberNo < 1n || memberNo > 18446744073709551615n) return null;
  return memberNo.toString();
}

function parseAmount(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const raw = String(value).trim();

  // DECIMAL(10,2): up to 8 digits before the decimal point and 2 after.
  if (!/^\d{1,8}(?:\.\d{1,2})?$/.test(raw)) return null;

  const [whole, fraction = ''] = raw.split('.');
  const satang = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0') || '0');
  if (satang <= 0n) return null;

  return {
    amount: `${whole}.${fraction.padEnd(2, '0')}`,
    points: Number(satang / 1000n),
  };
}

function tierFor(points) {
  if (points >= 10000) return 'Platinum';
  if (points >= 5000) return 'Gold';
  if (points >= 1000) return 'Silver';
  return 'Member';
}

// POST /api/purchases — body: { member_no, amount }
router.post('/', async (req, res) => {
  const memberNo = parseMemberNo(req.body?.member_no);
  if (!memberNo) return res.status(400).json({ error: 'กรุณาระบุเลขสมาชิกให้ถูกต้อง' });

  const requestedItems = Array.isArray(req.body?.items) ? req.body.items : null;
  let purchase = requestedItems && requestedItems.length ? null : parseAmount(req.body?.amount);
  if (!purchase && !(requestedItems && requestedItems.length)) {
    return res.status(400).json({ error: 'ยอดซื้อต้องเป็นตัวเลขมากกว่า 0 และมีทศนิยมไม่เกิน 2 ตำแหน่ง' });
  }

  let connection;
  let transactionStarted = false;

  try {
    connection = await req.db.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    // Lock the member row so concurrent purchases for this member are serialized.
    const [members] = await connection.execute(
      'SELECT member_no FROM members WHERE member_no = ? FOR UPDATE',
      [memberNo],
    );
    if (members.length === 0) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(404).json({ error: 'ไม่พบสมาชิก กรุณาสมัครสมาชิกก่อนบันทึกยอดซื้อ' });
    }

    let items = [];
    if (requestedItems && requestedItems.length) {
      const quantities = new Map();
      for (const item of requestedItems) {
        const coffeeId = String(item?.coffee_id || '');
        const quantity = Number(item?.quantity);
        if (!/^\d+$/.test(coffeeId) || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 4294967295) {
          await connection.rollback();
          transactionStarted = false;
          return res.status(400).json({ error: 'รายการกาแฟหรือจำนวนไม่ถูกต้อง' });
        }
        quantities.set(coffeeId, (quantities.get(coffeeId) || 0) + quantity);
      }
      const ids = [...quantities.keys()];
      const placeholders = ids.map(() => '?').join(',');
      const [coffees] = await connection.execute(
        `SELECT coffee_id, name, price FROM coffees WHERE is_active = 1 AND coffee_id IN (${placeholders}) FOR UPDATE`,
        ids,
      );
      if (coffees.length !== ids.length) {
        await connection.rollback();
        transactionStarted = false;
        return res.status(400).json({ error: 'มีเมนูกาแฟที่ไม่พบหรือหยุดขายแล้ว' });
      }
      let totalSatang = 0n;
      items = coffees.map((coffee) => {
        const quantity = quantities.get(String(coffee.coffee_id));
        const [whole, fraction = ''] = String(coffee.price).split('.');
        const unitSatang = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
        totalSatang += unitSatang * BigInt(quantity);
        return { coffee_id: String(coffee.coffee_id), name: coffee.name, quantity, unit_price: String(coffee.price) };
      });
      purchase = { amount: `${totalSatang / 100n}.${String(totalSatang % 100n).padStart(2, '0')}`, points: Number(totalSatang / 1000n) };
    }

    const [insertResult] = await connection.execute(
      'INSERT INTO purchases (member_no, amount, points_earned) VALUES (?, ?, ?)',
      [memberNo, purchase.amount, purchase.points],
    );

    for (const item of items) {
      await connection.execute(
        'INSERT INTO purchase_items (purchase_id, coffee_id, quantity, unit_price) VALUES (?, ?, ?, ?)',
        [insertResult.insertId, item.coffee_id, item.quantity, item.unit_price],
      );
    }

    const [totals] = await connection.execute(
      `SELECT COALESCE(SUM(points_earned), 0) AS total_points
       FROM purchases
       WHERE member_no = ? AND status = 'active'`,
      [memberNo],
    );
    const totalPoints = Number(totals[0].total_points);
    await connection.commit();
    transactionStarted = false;

    return res.status(201).json({
      message: 'บันทึกยอดซื้อและแต้มสำเร็จ',
      data: {
        purchase_id: String(insertResult.insertId),
        member_no: memberNo,
        member_code: `M${memberNo.padStart(6, '0')}`,
        amount: purchase.amount,
        points_earned: purchase.points,
        total_points: totalPoints,
        tier: tierFor(totalPoints),
        status: 'active',
        items,
      },
    });
  } catch (error) {
    if (connection && transactionStarted) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('Unable to roll back purchase transaction:', rollbackError.message);
      }
    }
    console.error('Unable to record purchase:', error.message);
    return res.status(500).json({ error: 'ไม่สามารถบันทึกยอดซื้อได้' });
  } finally {
    if (connection) connection.release();
  }
});

function parsePurchaseId(value) {
  const raw = String(value).trim();
  if (!/^\d+$/.test(raw)) return null;
  const purchaseId = BigInt(raw);
  if (purchaseId < 1n || purchaseId > 18446744073709551615n) return null;
  return purchaseId.toString();
}

// POST /api/purchases/:purchaseId/cancel
router.post('/:purchaseId/cancel', async (req, res) => {
  const purchaseId = parsePurchaseId(req.params.purchaseId);
  if (!purchaseId) return res.status(400).json({ error: 'เลขที่รายการซื้อไม่ถูกต้อง' });

  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
  if (reason.length > 255) {
    return res.status(400).json({ error: 'เหตุผลยกเลิกต้องไม่เกิน 255 ตัวอักษร' });
  }

  let connection;
  let transactionStarted = false;

  try {
    connection = await req.db.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    // Find the owning member, then lock that member to serialize point changes.
    const [purchaseRefs] = await connection.execute(
      'SELECT member_no FROM purchases WHERE purchase_id = ?',
      [purchaseId],
    );
    if (purchaseRefs.length === 0) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(404).json({ error: 'ไม่พบรายการซื้อ' });
    }
    const memberNo = String(purchaseRefs[0].member_no);

    await connection.execute(
      'SELECT member_no FROM members WHERE member_no = ? FOR UPDATE',
      [memberNo],
    );
    const [purchases] = await connection.execute(
      `SELECT purchase_id, member_no, amount, points_earned, status, purchased_at
       FROM purchases WHERE purchase_id = ? FOR UPDATE`,
      [purchaseId],
    );

    if (purchases.length === 0) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(404).json({ error: 'ไม่พบรายการซื้อ' });
    }
    if (purchases[0].status === 'cancelled') {
      await connection.rollback();
      transactionStarted = false;
      return res.status(409).json({ error: 'รายการนี้ถูกยกเลิกไปแล้ว' });
    }

    await connection.execute(
      `UPDATE purchases
       SET status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP, cancel_reason = ?
       WHERE purchase_id = ? AND status = 'active'`,
      [reason || null, purchaseId],
    );

    const [totals] = await connection.execute(
      `SELECT COALESCE(SUM(points_earned), 0) AS total_points
       FROM purchases
       WHERE member_no = ? AND status = 'active'`,
      [memberNo],
    );
    const totalPoints = Number(totals[0].total_points);
    await connection.commit();
    transactionStarted = false;

    return res.json({
      message: 'ยกเลิกรายการสำเร็จ',
      data: {
        purchase_id: purchaseId,
        member_no: memberNo,
        member_code: `M${memberNo.padStart(6, '0')}`,
        amount: String(purchases[0].amount),
        points_removed: Number(purchases[0].points_earned),
        status: 'cancelled',
        total_points: totalPoints,
        tier: tierFor(totalPoints),
      },
    });
  } catch (error) {
    if (connection && transactionStarted) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('Unable to roll back cancellation transaction:', rollbackError.message);
      }
    }
    console.error('Unable to cancel purchase:', error.message);
    return res.status(500).json({ error: 'ไม่สามารถยกเลิกรายการได้' });
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;
