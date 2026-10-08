const searchInput = document.querySelector('#member-search');
const searchButton = document.querySelector('#search-button');
const memberList = document.querySelector('#member-list');
const selectedMemberText = document.querySelector('#selected-member');
const amountInput = document.querySelector('#amount');
const pointsPreview = document.querySelector('#points-preview');
const purchaseForm = document.querySelector('#purchase-form');
const saveButton = document.querySelector('#save-button');
const message = document.querySelector('#message');
const result = document.querySelector('#result');
const coffeeMenu = document.querySelector('#coffee-menu');
const cartItems = document.querySelector('#cart-items');
const cartTotal = document.querySelector('#cart-total');

let selectedMember = null;
const cart = new Map();

function setMessage(text) {
  message.textContent = text;
}

function pointsForAmount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.floor(amount / 10);
}

function selectMember(member) {
  selectedMember = member;
  selectedMemberText.textContent = `สมาชิกที่เลือก: ${member.member_code} — ${member.name} (${member.phone})`;
  amountInput.disabled = false;
  saveButton.disabled = false;
  document.querySelectorAll('.member-option').forEach((button) => {
    button.classList.toggle('selected', button.dataset.memberNo === String(member.member_no));
  });
  setMessage('');
}

function renderMembers(members) {
  memberList.replaceChildren();
  if (!members.length) {
    const empty = document.createElement('p');
    empty.textContent = 'ไม่พบข้อมูลสมาชิก';
    memberList.appendChild(empty);
    return;
  }

  for (const member of members) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'member-option';
    button.dataset.memberNo = member.member_no;
    const title = document.createElement('span');
    title.textContent = `${member.member_code} — ${member.name}`;
    const details = document.createElement('small');
    details.textContent = `เบอร์โทร: ${member.phone} · แต้มรวม: ${Number(member.total_points || 0).toLocaleString('th-TH')} แต้ม`;
    button.append(title, details);
    button.addEventListener('click', () => selectMember(member));
    memberList.appendChild(button);
  }
}

async function searchMembers() {
  memberList.textContent = 'กำลังค้นหา...';
  try {
    const query = searchInput.value.trim();
    const response = await fetch(`/api/members?search=${encodeURIComponent(query)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'ค้นหาสมาชิกไม่สำเร็จ');
    renderMembers(data.data || []);
  } catch (error) {
    memberList.textContent = error.message || 'ไม่สามารถค้นหาสมาชิกได้';
  }
}

function updateCart() {
  let total = 0;
  for (const item of cart.values()) total += Number(item.price) * item.quantity;
  amountInput.value = total ? total.toFixed(2) : '';
  cartTotal.textContent = `ยอดรวม: ${total.toFixed(2)} บาท`;
  renderCart();
  const points = pointsForAmount(amountInput.value);
  pointsPreview.textContent = points ? `รายการนี้จะได้รับ ${points} แต้ม` : 'กรอกยอดซื้อเพื่อดูแต้มที่จะได้รับ';
}

function renderCart() {
  cartItems.replaceChildren();
  for (const item of cart.values()) {
    const row = document.createElement('div');
    row.className = 'cart-row';
    const label = document.createElement('span');
    label.textContent = `${item.name} (${Number(item.price).toFixed(2)} บาท)`;
    const controls = document.createElement('div');
    controls.className = 'cart-controls';

    const decrease = document.createElement('button');
    decrease.type = 'button';
    decrease.textContent = '−';
    decrease.title = 'ลดจำนวน';
    decrease.addEventListener('click', () => {
      item.quantity -= 1;
      if (item.quantity <= 0) cart.delete(item.coffee_id);
      updateCart();
    });

    const quantity = document.createElement('input');
    quantity.className = 'quantity';
    quantity.type = 'number';
    quantity.min = '1';
    quantity.step = '1';
    quantity.value = item.quantity;
    quantity.setAttribute('aria-label', `จำนวน ${item.name}`);
    quantity.addEventListener('change', () => {
      const value = Number(quantity.value);
      if (!Number.isInteger(value) || value < 1) cart.delete(item.coffee_id);
      else item.quantity = value;
      updateCart();
    });

    const increase = document.createElement('button');
    increase.type = 'button';
    increase.textContent = '+';
    increase.title = 'เพิ่มจำนวน';
    increase.addEventListener('click', () => {
      item.quantity += 1;
      updateCart();
    });
    controls.append(decrease, quantity, increase);
    row.append(label, controls);
    cartItems.appendChild(row);
  }
}

async function loadCoffees() {
  try {
    const response = await fetch('/api/coffees');
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'โหลดเมนูไม่สำเร็จ');
    coffeeMenu.replaceChildren();
    for (const coffee of data.data || []) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'member-option';
      button.textContent = `${coffee.name} — ${Number(coffee.price).toFixed(2)} บาท (เพิ่ม 1)`;
      button.addEventListener('click', () => {
        const current = cart.get(coffee.coffee_id) || { ...coffee, quantity: 0 };
        current.quantity += 1;
        cart.set(coffee.coffee_id, current);
        updateCart();
        button.textContent = `${coffee.name} — ${Number(coffee.price).toFixed(2)} บาท (เพิ่มอีก 1)`;
      });
      coffeeMenu.appendChild(button);
    }
  } catch (error) {
    coffeeMenu.textContent = error.message || 'ไม่สามารถโหลดเมนูได้';
  }
}

searchButton.addEventListener('click', searchMembers);
searchInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') searchMembers();
});

purchaseForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!selectedMember) return setMessage('กรุณาค้นหาและเลือกสมาชิกก่อน');
  const amount = Number(amountInput.value);
  if (!Number.isFinite(amount) || amount <= 0) return setMessage('กรุณากรอกยอดซื้อที่มากกว่า 0');
  if (!cart.size) return setMessage('กรุณาเลือกเมนูกาแฟอย่างน้อย 1 รายการ');

  saveButton.disabled = true;
  setMessage('กำลังบันทึกยอดซื้อ...');
  result.hidden = true;
  try {
    const response = await fetch('/api/purchases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        member_no: selectedMember.member_no,
        items: [...cart.values()].map((item) => ({ coffee_id: item.coffee_id, quantity: item.quantity })),
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'บันทึกยอดซื้อไม่สำเร็จ');
    document.querySelector('#result-member').textContent = `สมาชิก: ${data.data.member_code}`;
    document.querySelector('#result-points').textContent = `แต้มจากรายการนี้: ${data.data.points_earned} แต้ม · แต้มสะสมรวม: ${data.data.total_points} แต้ม`;
    document.querySelector('#result-tier').textContent = `ระดับสมาชิกปัจจุบัน: ${data.data.tier}`;
    result.hidden = false;
    setMessage('');
    amountInput.value = '';
    cart.clear();
    updateCart();
    pointsPreview.textContent = 'กรอกยอดซื้อเพื่อดูแต้มที่จะได้รับ';
  } catch (error) {
    setMessage(error.message || 'ไม่สามารถบันทึกยอดซื้อได้');
  } finally {
    saveButton.disabled = false;
  }
});

searchMembers();
loadCoffees();
