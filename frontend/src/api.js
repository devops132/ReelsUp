
function authHeader() {
  const token = localStorage.getItem('authToken');
  return token ? { 'Authorization': 'Bearer ' + token } : {};
}

export async function apiGet(path) {
  const res = await fetch(path, { headers: { ...authHeader() } });
  if (!res.ok) throw new Error('GET ' + path + ' -> ' + res.status);
  return res.json();
}

export async function apiPost(path, data) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('POST ' + path + ' -> ' + res.status);
  return res.json();
}

export async function apiPut(path, data) {
  const res = await fetch(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('PUT ' + path + ' -> ' + res.status);
  return res.json();
}

export async function apiDelete(path) {
  const res = await fetch(path, { method: 'DELETE', headers: { ...authHeader() } });
  if (!res.ok) throw new Error('DELETE ' + path + ' -> ' + res.status);
  return res.json();
}

export async function apiUpload(path, formData) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { ...authHeader() },
    body: formData
  });
  if (!res.ok) throw new Error('UPLOAD ' + path + ' -> ' + res.status);
  return res.json();
}