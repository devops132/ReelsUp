import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import VideoCard from "../components/VideoCard";
import { IconShield, IconUser, IconUpload, IconDots } from "../components/Icons";

export default function AdminPanel() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [videos, setVideos] = useState([]);
  const [approvedVideos, setApprovedVideos] = useState([]);
  const [users, setUsers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoriesFlat, setCategoriesFlat] = useState([]);
  const [newCatName, setNewCatName] = useState("");
  const [newCatParent, setNewCatParent] = useState("");
  // tags moderation
  const [bannedTags, setBannedTags] = useState([]);
  const [tagSearch, setTagSearch] = useState("");
  const [newBanTag, setNewBanTag] = useState("");
  // category tree (lazy)
  const [treeChildren, setTreeChildren] = useState({}); // key: 'root' or id -> array of nodes
  const [expanded, setExpanded] = useState(new Set());
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const [movingId, setMovingId] = useState(null);
  const noDropIds = new Set(); // зарезервировано под будущие ограничения
  const [dragOverZone, setDragOverZone] = useState(null); // e.g., 'before-123' or 'end-root'
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

  // Auto-collapse panel on small screens and expand on large
  useEffect(() => {
    const apply = () => {
      const isSmall = window.innerWidth < 1024;
      setPanelCollapsed(isSmall);
    };
    try { apply(); } catch(_) {}
    window.addEventListener('resize', apply);
    return () => window.removeEventListener('resize', apply);
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
    // flat categories for select
    fetch("/api/admin/categories", { headers: authHeader() })
      .then((r) => r.json())
      .then((list) => { setCategoriesFlat(list); setCategories(list); })
      .catch(() => {});
    // banned tags
    fetch("/api/admin/tags/banned", { headers: authHeader() })
      .then(r=>r.json()).then(d=> setBannedTags(d.tags||[])).catch(()=>{});
    // load root children for tree
    loadCategoryChildren(null);
  }, [user, nav]);

  const loadCategoryChildren = async (parentId) => {
    const key = parentId == null ? 'root' : String(parentId);
    if (treeChildren[key]) return;
    try {
      const q = parentId == null ? '' : ('?parent_id=' + parentId);
      const res = await fetch('/api/admin/categories/children' + q, { headers: authHeader() });
      const arr = await res.json();
      setTreeChildren(prev => ({ ...prev, [key]: arr }));
    } catch (_) {}
  };

  const toggleExpand = (id) => {
    const key = String(id);
    const next = new Set(expanded);
    if (next.has(key)) next.delete(key); else next.add(key);
    setExpanded(next);
    loadCategoryChildren(id);
  };

  const [catSearch, setCatSearch] = useState("");
  const getCounts = async (id) => {
    try { const r = await fetch(`/api/admin/categories/${id}/counts`, { headers: authHeader() }); if (!r.ok) return null; return await r.json(); } catch { return null; }
  };

  const confirmDelete = async (id, name) => {
    const counts = await getCounts(id);
    const info = counts ? `\nДочерние (прямые): ${counts.children}\nПотомков всего: ${counts.descendants}\nВидео: ${counts.videos}` : '';
    return window.confirm(`Удалить категорию «${name}»?${info}`);
  };

  const confirmMove = async (nodeId, newParentId, nodeName, parentName) => {
    const counts = await getCounts(nodeId);
    const info = counts ? `\nПотомков переместится: ${counts.descendants}` : '';
    return window.confirm(`Переместить «${nodeName}» под «${parentName||'корень'}»?${info}`);
  };

  const moveCategory = async (nodeId, newParentId) => {
    try {
      setMovingId(nodeId);
      const r = await fetch(`/api/admin/categories/${nodeId}/move`, { method:'PUT', headers:{ 'Content-Type':'application/json', ...authHeader() }, body: JSON.stringify({ parent_id: newParentId }) });
      if (r.ok) { setTreeChildren({}); setExpanded(new Set()); loadCategoryChildren(null); }
      else { const txt = await r.text(); alert(txt||'Не удалось переместить'); }
    } catch { alert('Ошибка сети'); }
    finally { setMovingId(null); }
  };

  const reorderCategory = async (id, beforeId) => {
    try {
      setMovingId(id);
      const r = await fetch(`/api/admin/categories/${id}/reorder`, { method:'PUT', headers:{ 'Content-Type':'application/json', ...authHeader() }, body: JSON.stringify({ before_id: beforeId||null }) });
      if (r.ok) { setTreeChildren({}); setExpanded(new Set()); loadCategoryChildren(null); }
      else { const txt = await r.text(); alert(txt||'Не удалось переставить'); }
    } catch { alert('Ошибка сети'); }
    finally { setMovingId(null); }
  };

  const onDragStartItem = (id) => { setDraggingId(id); };
  const onDragOverItem = (e, id) => {
    const node = findCategoryByIdLocal(id);
    const isLeaf = node && (node.children_count === 0);
    const forbidden = noDropIds.has(String(id));
    if (!draggingId || draggingId === id || isLeaf || forbidden) return; // не разрешаем droppable
    e.preventDefault();
    setDragOverId(id);
  };
  const onDropItem = async (id, name) => {
    setDragOverId(null);
    setDragOverZone(null);
    if (!draggingId || draggingId === id) return;
    // moving draggingId under id
    const node = findCategoryByIdLocal(draggingId);
    const parent = findCategoryByIdLocal(id);
    const ok = await confirmMove(draggingId, id, node?.name||`#${draggingId}`, parent?.name||null);
    if (ok) await moveCategory(draggingId, id);
    setDraggingId(null);
  };
  const onDropToRoot = async () => {
    if (!draggingId) return;
    const node = findCategoryByIdLocal(draggingId);
    const ok = await confirmMove(draggingId, null, node?.name||`#${draggingId}`, null);
    if (ok) await moveCategory(draggingId, null);
    setDraggingId(null);
  };

  const onDragOverZone = (e, zoneKey) => {
    if (!draggingId || movingId) return;
    e.preventDefault();
    setDragOverZone(zoneKey);
  };
  const onDropBefore = async (targetId, parentId) => {
    const dragged = findCategoryByIdLocal(draggingId);
    const draggedParent = dragged ? (dragged.parent_id ?? null) : null;
    setDragOverZone(null);
    if (!dragged) return;
    // If different parent, move first, then reorder before target
    if (String(draggedParent||'root') !== String(parentId||'root')) {
      const parentName = parentId ? (findCategoryByIdLocal(parentId)?.name||null) : null;
      const ok = await confirmMove(draggingId, parentId||null, dragged.name, parentName);
      if (!ok) { setDraggingId(null); return; }
      await moveCategory(draggingId, parentId||null);
    }
    await reorderCategory(draggingId, targetId);
    setDraggingId(null);
  };
  const onDropAtEnd = async (parentId) => {
    const dragged = findCategoryByIdLocal(draggingId);
    const draggedParent = dragged ? (dragged.parent_id ?? null) : null;
    setDragOverZone(null);
    if (!dragged) return;
    if (String(draggedParent||'root') !== String(parentId||'root')) {
      const parentName = parentId ? (findCategoryByIdLocal(parentId)?.name||null) : null;
      const ok = await confirmMove(draggingId, parentId||null, dragged.name, parentName);
      if (!ok) { setDraggingId(null); return; }
      await moveCategory(draggingId, parentId||null);
    }
    await reorderCategory(draggingId, null);
    setDraggingId(null);
  };

  const findCategoryByIdLocal = (id) => {
    // search in loaded buckets
    for (const [k, arr] of Object.entries(treeChildren)) {
      const hit = (arr||[]).find(x => String(x.id) === String(id));
      if (hit) return hit;
    }
    const hitFlat = (categoriesFlat||[]).find(x=> String(x.id) === String(id));
    return hitFlat || null;
  };
  const highlight = (name) => {
    const q = catSearch.trim().toLowerCase();
    if (!q) return name;
    const idx = name.toLowerCase().indexOf(q);
    if (idx === -1) return name;
    return (<span>{name.slice(0,idx)}<mark>{name.slice(idx, idx+q.length)}</mark>{name.slice(idx+q.length)}</span>);
  };

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
          .then((list) => { setCategoriesFlat(list); setCategories(list); setTreeChildren({}); setExpanded(new Set()); loadCategoryChildren(null); });
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
      <div className="users-table-wrap">
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
    </div>
  );

  const catMap = useMemo(() => {
    const m = {};
    (categoriesFlat || []).forEach(c => { m[String(c.id)] = c; });
    return m;
  }, [categoriesFlat]);
  const getBreadcrumb = (id) => {
    const names = [];
    let cur = catMap[String(id)];
    const guard = new Set();
    while (cur && !guard.has(String(cur.id))) {
      guard.add(String(cur.id));
      names.unshift(cur.name);
      if (!cur.parent_id) break;
      cur = catMap[String(cur.parent_id)];
    }
    return names.join(' › ');
  };

  const renderCategories = () => (
    <div>
      <div style={{ fontWeight: 600, marginBottom: 10 }}>Управление категориями</div>
      <div className="cats-grid">
        <div>
          <div style={{ border: "1px solid #ddd", borderRadius: 6 }}>
            <div style={{ padding: 8, fontWeight: 600, borderBottom: "1px solid #eee" }}>Список категорий</div>
            <div>
              <div style={{ padding:8, borderBottom:'1px solid #eee' }}>
                <input placeholder="Поиск по категориям" value={catSearch} onChange={e=>setCatSearch(e.target.value)} style={{ width:'100%' }} />
              </div>
              {/* Root level */}
              <div onDragOver={(e)=>onDragOverZone(e,'end-root')} onDrop={()=>onDropAtEnd(null)} style={{ height:8, background: dragOverZone==='end-root' ? 'rgba(79,140,255,.2)' : 'transparent' }} />
              {(treeChildren['root'] || []).filter(c => !catSearch || c.name.toLowerCase().includes(catSearch.trim().toLowerCase())).map((c) => (
                <div key={c.id} draggable={!movingId} onDragStart={()=>!movingId&&onDragStartItem(c.id)} onDragOver={(e)=>onDragOverItem(e,c.id)} onDrop={()=>onDropItem(c.id, c.name)} style={{ padding: "6px 10px", borderBottom: "1px solid #f3f3f3", display: "flex", alignItems: "center", background: dragOverId===String(c.id)?'rgba(79,140,255,.12)':'transparent', opacity: movingId && movingId!==c.id ? .7 : 1 }}>
                  <div onDragOver={(e)=>onDragOverZone(e,`before-${c.id}`)} onDrop={()=>onDropBefore(c.id, null)} style={{ width:6, height:24, marginRight:6, background: dragOverZone===`before-${c.id}` ? 'rgba(79,140,255,.4)':'transparent' }} />
                  <button onClick={() => toggleExpand(c.id)} disabled={!!movingId} style={{ marginRight: 6, background: 'transparent', border:'none', cursor: movingId?'not-allowed':'pointer', opacity: movingId?.toString()? .6:1 }}>{expanded.has(String(c.id)) ? '▾' : '▸'}</button>
                  <span style={{ display:'inline-flex', alignItems:'center', gap:8 }}>
                    {highlight(c.name)}
                    {movingId===c.id && <span style={{ width:14, height:14, border:'2px solid #fff', borderTopColor:'transparent', borderRadius:'50%', display:'inline-block', animation:'spin 0.8s linear infinite' }} />}
                  </span>
                  <span style={{ marginLeft:'auto', color:'#999', fontSize:12 }}>{c.children_count > 0 ? `${c.children_count} подкат.` : 'лист'}</span>
                  <button disabled={!!movingId} onClick={async()=>{ const n = prompt('Новое имя категории', c.name); if (!n) return; await fetch('/api/admin/categories/'+c.id, { method:'PUT', headers:{ 'Content-Type':'application/json', ...authHeader() }, body: JSON.stringify({ name:n }) }); setTreeChildren({}); setExpanded(new Set()); loadCategoryChildren(null); }} style={{ marginLeft:8, opacity: movingId?.toString()? .6:1 }}>✎</button>
                  <button disabled={!!movingId} onClick={async()=>{ if (!(await confirmDelete(c.id, c.name))) return; await fetch('/api/admin/categories/'+c.id, { method:'DELETE', headers: authHeader() }); setTreeChildren({}); setExpanded(new Set()); loadCategoryChildren(null); }} style={{ marginLeft:6, background:'#e88', opacity: movingId?.toString()? .6:1 }}>✕</button>
                </div>
              ))}
              <div onDragOver={(e)=>onDragOverZone(e,'end-root')} onDrop={()=>onDropAtEnd(null)} style={{ height:10, background: dragOverZone==='end-root' ? 'rgba(79,140,255,.2)' : 'transparent' }} />
              {/* Expanded children */}
              {Object.entries(treeChildren).filter(([k])=>k!=='root').map(([pid, arr]) => (
                expanded.has(pid) ? arr.map(child => (
                  <div key={child.id} draggable={!movingId} onDragStart={()=>!movingId&&onDragStartItem(child.id)} onDragOver={(e)=>onDragOverItem(e,child.id)} onDrop={()=>onDropItem(child.id, child.name)} style={{ padding: "6px 10px", paddingLeft: 24, borderBottom: "1px solid " + (dragOverZone===`end-${pid}`?'rgba(79,140,255,.2)':'#f3f3f3'), display: "flex", alignItems: "center", background: dragOverId===String(child.id)?'rgba(79,140,255,.12)':'transparent', opacity: movingId && movingId!==child.id ? .7 : 1 }}>
                    <div onDragOver={(e)=>onDragOverZone(e,`before-${child.id}`)} onDrop={()=>onDropBefore(child.id, pid)} style={{ width:6, height:24, marginRight:6, background: dragOverZone===`before-${child.id}` ? 'rgba(79,140,255,.4)':'transparent' }} />
                    <button onClick={() => toggleExpand(child.id)} disabled={!!movingId} style={{ marginRight: 6, background: 'transparent', border:'none', cursor: movingId?'not-allowed':'pointer', opacity: movingId?.toString()? .6:1 }}>{expanded.has(String(child.id)) ? '▾' : '▸'}</button>
                    <span style={{ display:'inline-flex', alignItems:'center', gap:8 }}>
                      {highlight(child.name)}
                      {movingId===child.id && <span style={{ width:14, height:14, border:'2px solid #fff', borderTopColor:'transparent', borderRadius:'50%', display:'inline-block', animation:'spin 0.8s linear infinite' }} />}
                    </span>
                    <span style={{ marginLeft:'auto', color:'#999', fontSize:12 }}>{child.children_count > 0 ? `${child.children_count} подкат.` : 'лист'}</span>
                    <button disabled={!!movingId} onClick={async()=>{ const n = prompt('Новое имя категории', child.name); if (!n) return; await fetch('/api/admin/categories/'+child.id, { method:'PUT', headers:{ 'Content-Type':'application/json', ...authHeader() }, body: JSON.stringify({ name:n }) }); setTreeChildren({}); setExpanded(new Set()); loadCategoryChildren(null); }} style={{ marginLeft:8, opacity: movingId?.toString()? .6:1 }}>✎</button>
                    <button disabled={!!movingId} onClick={async()=>{ if (!(await confirmDelete(child.id, child.name))) return; await fetch('/api/admin/categories/'+child.id, { method:'DELETE', headers: authHeader() }); setTreeChildren({}); setExpanded(new Set()); loadCategoryChildren(null); }} style={{ marginLeft:6, background:'#e88', opacity: movingId?.toString()? .6:1 }}>✕</button>
                  </div>
                )) : null
              ))}
              {/* end zone for each expanded list */}
              {Object.entries(treeChildren).filter(([k])=>k!=='root').map(([pid]) => (
                expanded.has(pid) ? (
                  <div key={`end-${pid}`} onDragOver={(e)=>onDragOverZone(e,`end-${pid}`)} onDrop={()=>onDropAtEnd(pid)} style={{ height:10, background: dragOverZone===`end-${pid}` ? 'rgba(79,140,255,.2)' : 'transparent' }} />
                ) : null
              ))}
              {!treeChildren['root'] && <div style={{ padding: 10, color: "#999" }}>Загрузка...</div>}
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
                {categoriesFlat.map((c) => (
                  <option key={c.id} value={c.id} disabled={c.depth >= 5}>
                    {getBreadcrumb(c.id)}
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

  const renderTagsTab = () => {
    const filtered = bannedTags.filter(t => t.includes(tagSearch.trim().toLowerCase()));
    const ban = async () => {
      let t = newBanTag.trim(); if (!t) return;
      if (!t.startsWith('#')) t = '#' + t; t = t.toLowerCase();
      try {
        const r = await fetch('/api/admin/tags/ban', { method:'POST', headers:{ 'Content-Type':'application/json', ...authHeader() }, body: JSON.stringify({ tag: t }) });
        if (r.ok) { setBannedTags(Array.from(new Set([t, ...bannedTags])).sort()); setNewBanTag(''); }
      } catch {}
    };
    const unban = async (t) => {
      try { const r = await fetch('/api/admin/tags/ban/' + encodeURIComponent(t.replace(/^#/,'')), { method:'DELETE', headers: authHeader() }); if (r.ok) setBannedTags(bannedTags.filter(x=>x!==t)); } catch {}
    };
    return (
      <div>
        <div style={{ fontWeight:600, marginBottom:10 }}>Модерация тегов</div>
        <div style={{ display:'flex', gap:8, marginBottom:12 }}>
          <input placeholder="Поиск по бан‑тегам" value={tagSearch} onChange={e=>setTagSearch(e.target.value)} style={{ flex:1 }} />
          <input placeholder="#тег" value={newBanTag} onChange={e=>setNewBanTag(e.target.value)} style={{ width:180 }} />
          <button onClick={ban}>Забанить</button>
        </div>
        <div style={{ border:'1px solid #ddd', borderRadius:6 }}>
          <div style={{ padding:8, borderBottom:'1px solid #eee', fontWeight:600 }}>Запрещённые теги ({bannedTags.length})</div>
          <div style={{ maxHeight: 420, overflowY:'auto' }}>
            {filtered.map(t => (
              <div key={t} style={{ display:'flex', alignItems:'center', padding:'6px 10px', borderBottom:'1px solid #f5f5f5' }}>
                <span style={{ flex:1 }}>{t}</span>
                <button onClick={()=>unban(t)} style={{ background:'#e88' }}>Разблокировать</button>
              </div>
            ))}
            {filtered.length === 0 && <div style={{ padding:10, color:'#999' }}>Ничего не найдено</div>}
          </div>
        </div>
      </div>
    );
  };

  const panelContent = () => {
    if (activeTab === "moderation") return renderModeration();
    if (activeTab === "videos") return renderVideos();
    if (activeTab === "users") return renderUsers();
    if (activeTab === "categories") return renderCategories();
    if (activeTab === "tags") return renderTagsTab();
    return null;
  };

  return (
    <div ref={containerRef} className="admin" style={{ maxWidth: 1200, margin: "20px auto", display: "flex", gap: 0, minHeight: "70vh" }}>
      {!panelCollapsed && (
        <div style={{ width: panelWidth, borderRight: "1px solid var(--border-color)", position: "relative", background: "var(--surface-1)", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", borderBottom: "1px solid var(--border-color)", padding: 8 }}>
            <div style={{ fontWeight: 700 }}>Навигация</div>
            <button onClick={() => setPanelCollapsed(true)} style={{ marginLeft: "auto" }}>⮞ Свернуть</button>
          </div>
          <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
            <button onClick={() => setActiveTab("moderation")} style={{ textAlign: "left", padding: "10px 12px", borderRadius:8, background: activeTab === "moderation" ? "#243142" : "transparent", color:'var(--text-color)', display:'flex', alignItems:'center', gap:8 }}><IconShield /> Модерация</button>
            <button onClick={() => setActiveTab("videos")} style={{ textAlign: "left", padding: "10px 12px", borderRadius:8, background: activeTab === "videos" ? "#243142" : "transparent", color:'var(--text-color)', display:'flex', alignItems:'center', gap:8 }}><IconUpload /> Видео</button>
            <button onClick={() => setActiveTab("users")} style={{ textAlign: "left", padding: "10px 12px", borderRadius:8, background: activeTab === "users" ? "#243142" : "transparent", color:'var(--text-color)', display:'flex', alignItems:'center', gap:8 }}><IconUser /> Пользователи</button>
            <button onClick={() => setActiveTab("categories")} style={{ textAlign: "left", padding: "10px 12px", borderRadius:8, background: activeTab === "categories" ? "#243142" : "transparent", color:'var(--text-color)', display:'flex', alignItems:'center', gap:8 }}><IconDots /> Категории</button>
            <button onClick={() => setActiveTab("tags")} style={{ textAlign: "left", padding: "10px 12px", borderRadius:8, background: activeTab === "tags" ? "#243142" : "transparent", color:'var(--text-color)', display:'flex', alignItems:'center', gap:8 }}><IconDots /> Теги</button>
          </div>
          <div
            onMouseDown={() => setDragging(true)}
            style={{ position: "absolute", top: 0, right: -3, width: 6, height: "100%", cursor: "col-resize", background: dragging ? "rgba(255,255,255,0.06)" : "transparent" }}
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
