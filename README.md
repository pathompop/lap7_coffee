# Coffee Shop Membership

ระบบสมาชิกและแต้มสะสมสำหรับร้านกาแฟ ใช้ Node.js, Express และ MySQL

## รันในเครื่อง

```bash
npm ci
copy .env.example .env
npm start
```

เปิด `http://localhost:3000/`

## ตั้งค่าฐานข้อมูล

สร้างตารางด้วยไฟล์ `database/schema.sql` หากฐานข้อมูลมี schema รุ่นเก่าตามระบบเดิม ให้ตรวจสอบข้อมูลและใช้ `database/migrate_legacy.sql` ก่อน

ตัวแปรที่ต้องตั้งใน `.env` หรือ Render:

```text
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=lap6
DB_PASSWORD=your_mysql_password
DB_NAME=lap_6
```

## Deploy บน Render

1. Push โปรเจกต์ขึ้น GitHub โดยไม่ commit `.env` หรือ `node_modules`.
2. ใน Render เลือก **New > Web Service** แล้วเชื่อม repository นี้ หรือใช้ `render.yaml` ด้วย Blueprint.
3. Render จะใช้ `npm ci` เป็น Build Command และ `npm start` เป็น Start Command.
4. ตั้งค่า `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` และ `DB_NAME` ใน Environment ของ Render.
5. ใช้ MySQL จากผู้ให้บริการภายนอกที่ Render เข้าถึงได้ แล้วนำ schema ไปสร้างในฐานข้อมูลนั้นก่อน deploy.

Render ไม่ได้สร้าง MySQL ให้ใน Web Service เดียวกัน จึงต้องเตรียมฐานข้อมูล MySQL แยกต่างหาก
