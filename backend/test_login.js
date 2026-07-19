import 'dotenv/config';
async function testLogin() {
  const res = await fetch('http://localhost:3001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'Admin@example.com', password: 'Admin@123' })
  });
  const data = await res.json();
  console.log("Status:", res.status);
  console.log("Data:", data);
}
testLogin();
