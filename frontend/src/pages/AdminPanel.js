import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import VideoCard from "../components/VideoCard";

export default function AdminPanel() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [videos, setVideos] = useState([]);
  const [approvedVideos, setApprovedVideos] = useState([]);
  const [users, setUsers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [newCatName, setNewCatName] = useState("");
  const [newCatParent, setNewCatParent] = useState("");
  // UI state for right panel
  const [activeTab, setActiveTab] = useState("moderation");
  const [panelWidth, setPanelWidth] = useState(420);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef(null);

  // Restore persisted UI state (active tab and panel width)
  useEffect(() => {
    try {
      const savedTab = localStorage.getItem("adminActiveTab");
      if (savedTab) setActiveTab(savedTab);
      const savedWidth = localStorage.getItem("adminPanelWidth");
      if (savedWidth) {
        const w = parseInt(savedWidth, 10);
        if (!isNaN(w)) {
          const clamped = Math.min(Math.max(280, w), 800);
          setPanelWidth(clamped);
        }
      }
    } catch (_) {}
  }, []);

  const authHeader = () => {
    const t = localStorage.getItem("authToken");
    return t ? { Authorization: "Bearer " + t } : {};
  };

  useEffect(() => {
    if (!user || user.role !== "admin") {
      nav("/");
      return;
    }
    // Pending videos for moderation
    fetch("/api/admin/videos", { headers: authHeader() })
      .then((r) => r.json())
      .then((list) => setVideos(list))
      .catch(() => {});
    // Approved videos for management
    fetch("/api/videos")
      .then((r) => r.json())
      .then(setApprovedVideos)
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
  const delVideo = (v, from) => {
    if (!window.confirm("Удалить видео?")) return;
    fetch("/api/admin/videos/" + v.id, {
      method: "DELETE",
      headers: authHeader(),
    }).then((r) => {
      if (r.ok) {
        if (from === "approved") setApprovedVideos(approvedVideos.filter((x) => x.id !== v.id));
        else setVideos(videos.filter((x) => x.id !== v.id));
      }
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

  // Resize logic for left panel
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e) => {
      const minW = 280;
      const maxW = 800;
      const rect = containerRef.current ? containerRef.current.getBoundingClientRect() : { left: 0 };
      const newW = Math.min(Math.max(minW, e.clientX - rect.left), maxW);
      setPanelWidth(newW);
    };
    const onUp = () => setDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging]);

  // Persist active tab and panel width
  useEffect(() => {
    try { localStorage.setItem("adminActiveTab", activeTab); } catch (_) {}
  }, [activeTab]);
  useEffect(() => {
    try { localStorage.setItem("adminPanelWidth", String(panelWidth)); } catch (_) {}
  }, [panelWidth]);

  if (!user || user.role !== "admin") return null;

  const renderModeration = () => (
    <div>
      <div style={{ fontWeight: 600, marginBottom: 10 }}>Модерация видео</div>
      <div className="feed">
        {videos.map((v) => (
          <div key={v.id} style={{ position: "relative" }}>
            <VideoCard video={v} />
            {!v.is_approved && (
              <button onClick={() => approve(v)} style={{ position: "absolute", top: 6, right: 6 }}>
                Одобрить
              </button>
            )}
            <button
              onClick={() => delVideo(v, "pending")}
              style={{ position: "absolute", bottom: 6, right: 6, background: "#e88" }}
            >
              Удалить
            </button>
          </div>
        ))}
        {videos.length === 0 && <div style={{ color: "#999" }}>Нет видео на модерации</div>}
      </div>
    </div>
  );

  const renderVideos = () => (
    <div>
      <div style={{ fontWeight: 600, marginBottom: 10 }}>Управление видео</div>
      <div className="feed">
        {approvedVideos.map((v) => (
          <div key={v.id} style={{ position: "relative" }}>
            <VideoCard video={v} />
            <button
              onClick={() => delVideo(v, "approved")}
              style={{ position: "absolute", bottom: 6, right: 6, background: "#e88" }}
            >
              Удалить
            </button>
          </div>
        ))}
        {approvedVideos.length === 0 && <div style={{ color: "#999" }}>Пока нет опубликованных видео</div>}
      </div>
    </div>
  );

  const renderUsers = () => (
    <div>
      <div style={{ fontWeight: 600, marginBottom: 10 }}>Управление пользователями</div>
      <table border="1" cellPadding="6" style={{ borderCollapse: "collapse", width: "100%" }}>
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
                <select value={u.role} onChange={(e) => changeRole(u.id, e.target.value)}>
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

  const renderCategories = () => (
    <div>
      <div style={{ fontWeight: 600, marginBottom: 10 }}>Управление категориями</div>
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
    </div>
  );

  const panelContent = () => {
    if (activeTab === "moderation") return renderModeration();
    if (activeTab === "videos") return renderVideos();
    if (activeTab === "users") return renderUsers();
    if (activeTab === "categories") return renderCategories();
    return null;
  };

  return (
    <div ref={containerRef} style={{ maxWidth: 1200, margin: "20px auto", display: "flex", gap: 0, minHeight: "70vh" }}>
      {!panelCollapsed && (
        <div style={{ width: panelWidth, borderRight: "1px solid #ddd", position: "relative", background: "#fff", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", borderBottom: "1px solid #eee", padding: 8 }}>
            <div style={{ fontWeight: 600 }}>Навигация</div>
            <button onClick={() => setPanelCollapsed(true)} style={{ marginLeft: "auto" }}>⮞ Свернуть</button>
          </div>
          <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
            <button onClick={() => setActiveTab("moderation")} style={{ textAlign: "left", padding: "8px 10px", background: activeTab === "moderation" ? "#eef" : "#f6f7fb" }}>Модерация</button>
            <button onClick={() => setActiveTab("videos")} style={{ textAlign: "left", padding: "8px 10px", background: activeTab === "videos" ? "#eef" : "#f6f7fb" }}>Видео</button>
            <button onClick={() => setActiveTab("users")} style={{ textAlign: "left", padding: "8px 10px", background: activeTab === "users" ? "#eef" : "#f6f7fb" }}>Пользователи</button>
            <button onClick={() => setActiveTab("categories")} style={{ textAlign: "left", padding: "8px 10px", background: activeTab === "categories" ? "#eef" : "#f6f7fb" }}>Категории</button>
          </div>
          <div
            onMouseDown={() => setDragging(true)}
            style={{ position: "absolute", top: 0, right: -3, width: 6, height: "100%", cursor: "col-resize", background: dragging ? "rgba(0,0,0,0.05)" : "transparent" }}
            title="Потяните, чтобы изменить ширину"
          />
        </div>
      )}
      {panelCollapsed && (
        <div style={{ width: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <button onClick={() => setPanelCollapsed(false)} title="Развернуть панель">⮜</button>
        </div>
      )}

      <div style={{ flex: 1, paddingLeft: 10 }}>
        <h2>Админ-панель</h2>
        <div style={{ color: "#666" }}>Выберите раздел в левой панели.</div>
        <div style={{ marginTop: 12 }}>{panelContent()}</div>
      </div>
    </div>
  );
}
