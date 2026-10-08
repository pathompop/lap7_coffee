const params = new URLSearchParams(window.location.search);
const memberNo = params.get('member_no');
const message = document.querySelector('#message');
const memberCard = document.querySelector('#member-card');
const purchasesBody = document.querySelector('#purchases-body');

function showMessage(text) {
  message.textContent = text;
}

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('th-TH');
}

function renderMember(member) {
  document.querySelector('#member-name').textContent = member.name;
  document.querySelector('#member-contact').textContent = `เบอร์โทร: ${member.phone}`;
  document.querySelector('#member-code').textContent = member.member_code;
  document.querySelector('#member-points').textContent = `${Number(member.total_points || 0).toLocaleString('th-TH')} แต้ม`;
  document.querySelector('#member-tier').textContent = member.tier;
  document.querySelector('#edit-link').href = `/member_edit.html?member_no=${encodeURIComponent(member.member_no)}`;
  memberCard.hidden = false;
}

function renderPurchases(purchases) {
  purchasesBody.replaceChildren();
  if (!purchases.length) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 6;
    cell.textContent = 'ยังไม่มีประวัติการซื้อ';
    cell.style.textAlign = 'center';
    row.appendChild(cell);
    purchasesBody.appendChild(row);
    return;
  }

  for (const purchase of purchases) {
    const row = document.createElement('tr');
    if (purchase.status === 'cancelled') row.className = 'cancelled';
    const dateCell = document.createElement('td');
    dateCell.textContent = formatDate(purchase.purchased_at);
    row.appendChild(dateCell);

    const itemCell = document.createElement('td');
    if (purchase.items?.length) {
      purchase.items.forEach((item, index) => {
        if (index) itemCell.appendChild(document.createElement('br'));
        const line = document.createElement('span');
        line.textContent = `${item.name} × ${item.quantity} (${item.unit_price} บาท/ชิ้น)`;
        itemCell.appendChild(line);
      });
    } else {
      itemCell.textContent = 'รายการเดิม';
    }
    row.appendChild(itemCell);
    const values = [`${purchase.amount} บาท`, `${purchase.points_earned} แต้ม`];
    values.forEach((value) => {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.appendChild(cell);
    });

    const statusCell = document.createElement('td');
    const status = document.createElement('span');
    status.className = `status ${purchase.status}`;
    status.textContent = purchase.status === 'active' ? 'ใช้งานอยู่' : 'ยกเลิกแล้ว';
    statusCell.appendChild(status);
    row.appendChild(statusCell);

    const actionCell = document.createElement('td');
    if (purchase.status === 'active') {
      const cancelButton = document.createElement('button');
      cancelButton.type = 'button';
      cancelButton.textContent = 'ยกเลิก';
      cancelButton.addEventListener('click', () => cancelPurchase(purchase, cancelButton));
      actionCell.appendChild(cancelButton);
    } else {
      actionCell.textContent = '-';
    }
    row.appendChild(actionCell);
    purchasesBody.appendChild(row);
  }
}

async function cancelPurchase(purchase, button) {
  const confirmed = window.confirm(`ยืนยันยกเลิกรายการยอด ${purchase.amount} บาท และ ${purchase.points_earned} แต้มใช่หรือไม่?`);
  if (!confirmed) return;
  button.disabled = true;
  showMessage('กำลังยกเลิกรายการ...');
  try {
    const response = await fetch(`/api/purchases/${encodeURIComponent(purchase.purchase_id)}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'ยกเลิกรายการไม่สำเร็จ');
    await loadPage();
    showMessage(`ยกเลิกรายการสำเร็จ แต้มสะสมคงเหลือ ${data.data.total_points} แต้ม ระดับ ${data.data.tier}`);
  } catch (error) {
    showMessage(error.message || 'ไม่สามารถยกเลิกรายการได้');
    button.disabled = false;
  }
}

async function loadPage() {
  if (!memberNo) return showMessage('ไม่พบเลขสมาชิกใน URL');
  showMessage('กำลังโหลดข้อมูล...');
  try {
    const [memberResponse, purchasesResponse] = await Promise.all([
      fetch(`/api/members/${encodeURIComponent(memberNo)}`),
      fetch(`/api/members/${encodeURIComponent(memberNo)}/purchases`),
    ]);
    const memberData = await memberResponse.json();
    const purchasesData = await purchasesResponse.json();
    if (!memberResponse.ok) throw new Error(memberData.error || 'โหลดข้อมูลสมาชิกไม่สำเร็จ');
    if (!purchasesResponse.ok) throw new Error(purchasesData.error || 'โหลดประวัติการซื้อไม่สำเร็จ');
    renderMember(memberData.data);
    renderPurchases(purchasesData.data || []);
    showMessage('');
  } catch (error) {
    showMessage(error.message || 'ไม่สามารถโหลดข้อมูลได้');
  }
}

loadPage();
