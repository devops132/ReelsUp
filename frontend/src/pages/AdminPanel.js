import React, { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import VideoCard from "../components/VideoCard";

export default function AdminPanel() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [videos, setVideos] = useState([]);
  const [users, setUsers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [newCatName, setNewCatName] = useState("");
  const [newCatParent, setNewCatParent] = useState("");

  const authHeader = () => {
    const t = localStorage.getItem("authToken");
    return t ? { Authorization: "Bearer " + t } : {};
  };

  useEffect(() => {
    if (!user || user.role !== "admin") {
      nav("/");
      return;
    }
    fetch("/api/admin/videos", { headers: authHeader() })
      .then((r) => r.json())
      .then(setVideos)
      .catch(() => {});
    fetch("/api/admin/users", { headers: authHeader() })
      .then((r) => r.json())
      .then(setUsers)
      .catch(() => {});
    fetch("/api/admin/categories", { headers: authHeader() })
      .then((r) => r.json())
      .then(setCategories)
      .catch(() => {});
  }, [user, nav]);

  const approve = (v) => {
    fetch("/api/admin/videos/" + v.id + "/approve", {
      method: "PUT",
      headers: authHeader(),
    }).then((r) => {
      if (r.ok) setVideos(videos.filter((x) => x.id !== v.id));
    });
  };
  const delVideo = (v) => {
    if (!window.confirm("Удалить видео?")) return;
    fetch("/api/admin/videos/" + v.id, {
      method: "DELETE",
      headers: authHeader(),
    }).then((r) => {
      if (r.ok) setVideos(videos.filter((x) => x.id !== v.id));
    });
  };
  const changeRole = (uid, role) => {
    fetch("/api/admin/users/" + uid + "/role", {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeader() },
      body: JSON.stringify({ role }),
    })
      .then((r) => r.json())
      .then((u) => setUsers(users.map((x) => (x.id === uid ? u : x))));
  };

  const createCategory = (e) => {
    e.preventDefault();
    const payload = { name: newCatName.trim() };
    if (newCatParent) payload.parent_id = parseInt(newCatParent, 10);
    if (!payload.name) return;
    fetch("/api/admin/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader() },
      body: JSON.stringify(payload),
    })
      .then(async (r) => {
        if (!r.ok) {
          const text = await r.text();
          throw new Error(text || "Ошибка сохранения");
        }
        return r.json();
      })
      .then(() => {
        setNewCatName("");
        setNewCatParent("");
        return fetch("/api/admin/categories", { headers: authHeader() })
          .then((r) => r.json())
          .then(setCategories);
      })
      .catch((e) => alert(e.message));
  };

  if (!user || user.role !== "admin") return null;

  return (
    <div style={{ maxWidth: 1100, margin: "20px auto" }}>
      <h2>Админ-панель</h2>
      <h3>Категории</h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div>
          <div style={{ border: "1px solid #ddd", borderRadius: 6 }}>
            <div style={{ padding: 8, fontWeight: 600, borderBottom: "1px solid #eee" }}>Список категорий</div>
            <div>
              {categories.map((c) => (
                <div key={c.id} style={{ padding: "6px 10px", borderBottom: "1px solid #f3f3f3", display: "flex", alignItems: "center" }}>
                  <span style={{ display: "inline-block", paddingLeft: (c.depth - 1) * 16 }}>
                    {Array.from({ length: c.depth - 1 }).map((_, i) => (
                      <span key={i} style={{ marginRight: 4 }}>—</span>
                    ))}
                    {c.name}
                  </span>
                  {c.parent_id ? (
                    <span style={{ marginLeft: "auto", color: "#999", fontSize: 12 }}>parent #{c.parent_id}</span>
                  ) : (
                    <span style={{ marginLeft: "auto", color: "#999", fontSize: 12 }}>root</span>
                  )}
                </div>
              ))}
              {categories.length === 0 && (
                <div style={{ padding: 10, color: "#999" }}>Категорий пока нет</div>
              )}
            </div>
          </div>
        </div>
        <div>
          <form onSubmit={createCategory} style={{ border: "1px solid #ddd", borderRadius: 6, padding: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 10 }}>Добавить категорию</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
              <input
                placeholder="Название категории"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
              />
              <select value={newCatParent} onChange={(e) => setNewCatParent(e.target.value)}>
                <option value="">(корневая)</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id} disabled={c.depth >= 5}>
                    {Array.from({ length: c.depth - 1 }).map(() => "— ").join("")}
                    {c.name}
                  </option>
                ))}
              </select>
              <button type="submit">Создать</button>
              <div style={{ color: "#999", fontSize: 12 }}>Максимум 5 уровней вложенности</div>
            </div>
          </form>
        </div>
      </div>
      <h3>Видео</h3>
      <div className="feed">
        {videos.map((v) => (
          <div key={v.id} style={{ position: "relative" }}>
            <VideoCard video={v} />
            {!v.is_approved && (
              <button
                onClick={() => approve(v)}
                style={{ position: "absolute", top: 6, right: 6 }}
              >
                Одобрить
              </button>
            )}
            <button
              onClick={() => delVideo(v)}
              style={{
                position: "absolute",
                bottom: 6,
                right: 6,
                background: "#e88",
              }}
            >
              Удалить
            </button>
          </div>
        ))}
      </div>

      <h3>Пользователи</h3>
      <table
        border="1"
        cellPadding="6"
        style={{ borderCollapse: "collapse", width: "100%" }}
      >
        <thead>
          <tr>
            <th>ID</th>
            <th>Email</th>
            <th>Имя</th>
            <th>Роль</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.id}</td>
              <td>{u.email}</td>
              <td>{u.name || "-"}</td>
              <td>
                <select
                  value={u.role}
                  onChange={(e) => changeRole(u.id, e.target.value)}
                >
                  <option value="user">user</option>
                  <option value="business">business</option>
                  <option value="admin">admin</option>
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
