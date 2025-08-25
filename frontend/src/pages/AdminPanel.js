import React, { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import VideoCard from "../components/VideoCard";

export default function AdminPanel() {
  const { user, token } = useAuth();
  const nav = useNavigate();
  const [videos, setVideos] = useState([]);
  const [users, setUsers] = useState([]);

  const authHeader = () => (token ? { Authorization: "Bearer " + token } : {});

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

  if (!user || user.role !== "admin") return null;

  return (
    <div style={{ maxWidth: 1100, margin: "20px auto" }}>
      <h2>Админ-панель</h2>
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
