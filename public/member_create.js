const createForm = document.querySelector('#member-create-form');
const createMessage = document.querySelector('#message');
const createButton = createForm.querySelector('button');

function showCreateMessage(message) {
  createMessage.textContent = message;
}

function validateMemberForm(form) {
  const name = form.name.value.trim();
  const phone = form.phone.value.trim();
  if (!name || name.length > 150) return 'กรุณาระบุชื่อไม่เกิน 150 ตัวอักษร';
  if (!/^[0-9+()\-\s]+$/.test(phone) || (phone.match(/\d/g) || []).length < 7 || phone.length > 30) {
    return 'กรุณาระบุเบอร์โทรศัพท์ให้ถูกต้อง';
  }
  return null;
}

createForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const validationError = validateMemberForm(createForm);
  if (validationError) return showCreateMessage(validationError);

  createButton.disabled = true;
  showCreateMessage('กำลังบันทึกข้อมูล...');
  try {
    const response = await fetch('/api/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: createForm.name.value.trim(), phone: createForm.phone.value.trim() }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'สมัครสมาชิกไม่สำเร็จ');
    window.location.href = `/?member_created=${encodeURIComponent(result.data.member_code)}`;
  } catch (error) {
    showCreateMessage(error.message || 'ไม่สามารถสมัครสมาชิกได้');
    createButton.disabled = false;
  }
});
