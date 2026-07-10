async function test() {
  const loginRes = await fetch("http://localhost:3000/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin1", password: "password123" }), // Assuming seed data has this
  });
  const loginData = await loginRes.json();
  const token = loginData.access_token;

  if (!token) {
    console.error("Login failed", loginData);
    return;
  }

  const res = await fetch("http://localhost:3000/api/v1/explorations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      camp_id: 1,
      name: "Exploration Test",
      destination_description: "Test zone",
      departure_date: "2026-06-15T00:00:00.000Z",
      estimated_days: 3,
      grace_days: 0,
      persons: [{ person_id: 1, is_leader: true }],
      resources: [],
    }),
  });

  const text = await res.text();
  console.log("Response:", res.status, text);
}

void test();
