const editForm = document.querySelector('#member-edit-form');
const editMessage = document.querySelector('#message');
const editButton = editForm.querySelector('button');
const memberCode = new URLSearchParams(window.location.search).get('member_no');

function showEditMessage(message) {
  editMessage.textContent = message;
}

function validateEditForm() {
  const name = editForm.name.value.trim();
  const phone = editForm.phone.value.trim();
  if (!name || name.length > 150) return 'กรุณาระบุชื่อไม่เกิน 150 ตัวอักษร';
  if (!/^[0-9+()\-\s]+$/.test(phone) || (phone.match(/\d/g) || []).length < 7 || phone.length > 30) {
    return 'กรุณาระบุเบอร์โทรศัพท์ให้ถูกต้อง';
  }
  return null;
}

async function loadMember() {
  if (!memberCode) return showEditMessage('ไม่พบเลขสมาชิกใน URL');
  showEditMessage('กำลังโหลดข้อมูล...');
  try {
    const response = await fetch(`/api/members/${encodeURIComponent(memberCode)}`);
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'โหลดข้อมูลไม่สำเร็จ');
    editForm['member-code'].value = result.data.member_code;
    editForm.name.value = result.data.name;
    editForm.phone.value = result.data.phone;
    showEditMessage('');
  } catch (error) {
    showEditMessage(error.message || 'ไม่สามารถโหลดข้อมูลสมาชิกได้');
    editButton.disabled = true;
  }
}

editForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const validationError = validateEditForm();
  if (validationError) return showEditMessage(validationError);
  if (!memberCode) return showEditMessage('ไม่พบเลขสมาชิกใน URL');

  editButton.disabled = true;
  showEditMessage('กำลังบันทึกข้อมูล...');
  try {
    const response = await fetch(`/api/members/${encodeURIComponent(memberCode)}/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editForm.name.value.trim(), phone: editForm.phone.value.trim() }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'แก้ไขข้อมูลไม่สำเร็จ');
    window.location.href = `/?member_updated=${encodeURIComponent(result.data.member_code)}`;
  } catch (error) {
    showEditMessage(error.message || 'ไม่สามารถแก้ไขข้อมูลสมาชิกได้');
    editButton.disabled = false;
  }
});

loadMember();
