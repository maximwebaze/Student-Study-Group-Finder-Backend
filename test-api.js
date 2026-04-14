const BASE = 'http://localhost:5000/api';
let token = '';
let groupId = 0;
let sessionId = 0;
let postId = 0;

// ── Helpers ──────────────────────────────────────────────────
function ok(label, res) {
  const icon = res ? '✅' : '❌';
  console.log(`  ${icon}  ${label}`);
}

async function post(url, body, auth = false) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth && token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(BASE + url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  return { res, data: await res.json() };
}

async function get(url) {
  const res = await fetch(BASE + url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return { res, data: await res.json() };
}

async function del(url) {
  const res = await fetch(BASE + url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  return { res, data: await res.json() };
}

// ── Run tests ─────────────────────────────────────────────────
async function run() {
  console.log('\n🧪  StudySync API Smoke Tests\n');

  // 1. Health check
  console.log('── Health ─────────────────────────────────────────────');
  const health = await fetch(BASE + '/health').then((r) => r.json());
  ok('GET /health', health.status === 'ok');

  // 2. Register
  console.log('\n── Auth ───────────────────────────────────────────────');
  const testEmail = `test_${Date.now()}@ucu.ac.ug`;
  const { res: regRes, data: regData } = await post('/auth/register', {
    name: 'Test User',
    email: testEmail,
    password: 'testpass',
    program: 'BSc IT',
    year_of_study: 1,
  });
  ok('POST /auth/register', regRes.status === 201);

  // 3. Login
  const { res: loginRes, data: loginData } = await post('/auth/login', {
    email: testEmail,
    password: 'testpass',
  });
  ok('POST /auth/login', loginRes.ok && loginData.token);
  token = loginData.token;

  // 4. Get profile
  const { res: meRes } = await get('/auth/me');
  ok('GET  /auth/me', meRes.ok);

  // 5. Create group
  console.log('\n── Groups ─────────────────────────────────────────────');
  const { res: createRes, data: createData } = await post(
    '/groups',
    {
      name: 'Test Group',
      course_name: 'Test Course',
      course_code: 'TST101',
      description: 'A test group',
    },
    true,
  );
  ok('POST /groups (create)', createRes.status === 201);
  groupId = createData.groupId;

  // 6. List groups
  const { res: listRes } = await get('/groups');
  ok('GET  /groups (list)', listRes.ok);

  // 7. Search groups
  const { res: searchRes } = await get('/groups?search=Test');
  ok('GET  /groups?search= (search)', searchRes.ok);

  // 8. Get single group
  const { res: singleRes } = await get(`/groups/${groupId}`);
  ok(`GET  /groups/${groupId} (detail)`, singleRes.ok);

  // 9. My groups
  const { res: myRes } = await get('/groups/my/groups');
  ok('GET  /groups/my/groups', myRes.ok);

  // 10. Schedule session
  console.log('\n── Sessions ───────────────────────────────────────────');
  const { res: sessRes, data: sessData } = await post(
    '/sessions',
    {
      group_id: groupId,
      title: 'Test Session',
      session_date: '2026-12-01',
      session_time: '14:00',
      location: 'Library',
      description: 'Test',
    },
    true,
  );
  ok('POST /sessions (create)', sessRes.status === 201);
  sessionId = sessData.sessionId;

  // 11. List group sessions
  const { res: listSessRes } = await get(`/sessions/group/${groupId}`);
  ok(`GET  /sessions/group/${groupId}`, listSessRes.ok);

  // 12. Upcoming sessions
  const { res: upRes } = await get('/sessions/upcoming');
  ok('GET  /sessions/upcoming', upRes.ok);

  // 13. Post a message
  console.log('\n── Posts ──────────────────────────────────────────────');
  const { res: postRes, data: postData } = await post(
    '/posts',
    {
      group_id: groupId,
      content: 'Hello from the test suite!',
    },
    true,
  );
  ok('POST /posts (create)', postRes.status === 201);
  postId = postData.postId;

  // 14. List group posts
  const { res: listPostRes } = await get(`/posts/group/${groupId}`);
  ok(`GET  /posts/group/${groupId}`, listPostRes.ok);

  // 15. Delete post
  const { res: delPostRes } = await del(`/posts/${postId}`);
  ok('DELETE /posts/:id', delPostRes.ok);

  // 16. Delete session
  const { res: delSessRes } = await del(`/sessions/${sessionId}`);
  ok('DELETE /sessions/:id', delSessRes.ok);

  // 17. Delete group
  const { res: delGroupRes } = await del(`/groups/${groupId}`);
  ok('DELETE /groups/:id', delGroupRes.ok);

  // 18. Admin endpoints (login as admin first)
  console.log('\n── Admin ──────────────────────────────────────────────');
  const { data: adminLogin } = await post('/auth/login', {
    email: 'admin@ucu.ac.ug',
    password: 'admin123',
  });
  if (adminLogin.token) {
    token = adminLogin.token;
    ok('Admin login', true);
    const { res: statsRes } = await get('/admin/stats');
    ok('GET  /admin/stats', statsRes.ok);
    const { res: usersRes } = await get('/admin/users');
    ok('GET  /admin/users', usersRes.ok);
    const { res: groupsRes } = await get('/admin/groups');
    ok('GET  /admin/groups', groupsRes.ok);
  } else {
    ok('Admin login (run schema.sql first)', false);
  }

  console.log('\n🏁  Tests complete\n');
}

run().catch((err) => {
  console.error('❌  Test runner failed:', err.message);
  console.error('    Make sure the backend is running: npm run dev');
  process.exit(1);
});
