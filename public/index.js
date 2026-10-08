const form = document.querySelector('#search-form');
const input = document.querySelector('#search-input');
const status = document.querySelector('#status');
const body = document.querySelector('#members-body');
const redirectParams = new URLSearchParams(window.location.search);
let redirectMessage = '';

if (redirectParams.has('member_created')) {
  redirectMessage = `สมัครสมาชิก ${redirectParams.get('member_created')} สำเร็จ`;
} else if (redirectParams.has('member_updated')) {
  redirectMessage = `แก้ไขสมาชิก ${redirectParams.get('member_updated')} สำเร็จ`;
}

function setStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle('error', isError);
}

function addCell(row, value) {
  const cell = document.createElement('td');
  cell.textContent = value;
  row.appendChild(cell);
}

function renderMembers(members) {
  body.replaceChildren();
  if (members.length === 0) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 5;
    cell.className = 'empty';
    cell.textContent = 'ไม่พบข้อมูลสมาชิก';
    row.appendChild(cell);
    body.appendChild(row);
    return;
  }

  for (const member of members) {
    const row = document.createElement('tr');
    row.style.cursor = 'pointer';
    row.title = 'ดูรายละเอียดสมาชิก';
    row.addEventListener('click', () => {
      window.location.href = `/member_detail.html?member_no=${encodeURIComponent(member.member_no)}`;
    });
    addCell(row, member.member_code || `M${String(member.member_no).padStart(6, '0')}`);
    addCell(row, member.name);
    addCell(row, member.phone);
    addCell(row, Number(member.total_points || 0).toLocaleString('th-TH'));
    const tierCell = document.createElement('td');
    const tier = document.createElement('span');
    tier.className = 'tier';
    tier.textContent = member.tier;
    tierCell.appendChild(tier);
    row.appendChild(tierCell);
    body.appendChild(row);
  }
}

async function loadMembers(search = '') {
  setStatus('กำลังโหลดข้อมูล...');
  const query = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';

  try {
    const response = await fetch(`/api/members${query}`);
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'โหลดข้อมูลไม่สำเร็จ');
    renderMembers(result.data || []);
    setStatus(redirectMessage || (result.data?.length ? `พบสมาชิก ${result.data.length} คน` : 'ไม่พบข้อมูลสมาชิก'));
    redirectMessage = '';
  } catch (error) {
    body.replaceChildren();
    setStatus(error.message || 'ไม่สามารถเชื่อมต่อระบบได้', true);
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  loadMembers(input.value);
});

loadMembers();
