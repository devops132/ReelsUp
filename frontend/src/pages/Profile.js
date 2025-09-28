import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { apiDelete, apiGet, apiPost, apiPut, apiUpload } from '../api';
import VideoCard from '../components/VideoCard';
import VideoUploadForm from '../components/VideoUploadForm';

const initialFormState = {
  title: '',
  description: '',
  stream_url: '',
  thumbnail_url: '',
  scheduled_at: '',
  startNow: false
};

function formatDateTime(value) {
  if (!value) return '';
  try {
    const date = new Date(value);
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  } catch (e) {
    return value;
  }
}

function toInputDateTime(value) {
  if (!value) return '';
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const offset = date.getTimezoneOffset();
    const local = new Date(date.getTime() - offset * 60000);
    return local.toISOString().slice(0, 16);
  } catch (e) {
    return '';
  }
}

export default function Profile() {
  const { user, refreshProfile, logout } = useAuth();
  const nav = useNavigate();
  const [videos, setVideos] = useState([]);
  const [streams, setStreams] = useState([]);
  const [streamsLoading, setStreamsLoading] = useState(true);
  const [streamError, setStreamError] = useState('');
  const [streamMessage, setStreamMessage] = useState('');
  const [form, setForm] = useState(initialFormState);
  const [savingStream, setSavingStream] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [editingId, setEditingId] = useState(null);

  const loadStreams = useCallback(() => {
    if (!user) return;
    setStreamsLoading(true);
    setStreamError('');
    apiGet('/api/user/livestreams?status=all')
      .then(data => setStreams(data))
      .catch(() => setStreamError('Не удалось загрузить список трансляций'))
      .finally(() => setStreamsLoading(false));
  }, [user]);

  useEffect(() => {
    if (!user) { nav('/login'); return; }
    apiGet('/api/user/videos').then(setVideos).catch(()=>{});
    loadStreams();
  }, [user, nav, loadStreams]);

  if (!user) return null;

  const handleInputChange = field => event => {
    const value = field === 'startNow' ? event.target.checked : event.target.value;
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setForm(initialFormState);
    setEditingId(null);
  };

  const handleCreateOrUpdateStream = async (event) => {
    event.preventDefault();
    if (savingStream) return;
    setStreamError('');
    setStreamMessage('');
    const title = form.title.trim();
    const streamURL = form.stream_url.trim();
    const thumb = form.thumbnail_url.trim();
    if (!title || !streamURL) {
      setStreamError('Введите название и ссылку на поток.');
      return;
    }
    let scheduledIso = null;
    if (form.scheduled_at) {
      const dt = new Date(form.scheduled_at);
      if (Number.isNaN(dt.getTime())) {
        setStreamError('Некорректная дата и время начала.');
        return;
      }
      scheduledIso = dt.toISOString();
    }
    const payload = {
      title,
      description: form.description,
      stream_url: streamURL,
      thumbnail_url: thumb
    };
    if (editingId) {
      if (form.scheduled_at !== '') {
        payload.scheduled_at = scheduledIso || '';
      }
    } else if (scheduledIso) {
      payload.scheduled_at = scheduledIso;
    }
    setSavingStream(true);
    try {
      if (editingId) {
        await apiPut(`/api/livestreams/${editingId}`, payload);
        setStreamMessage('Трансляция обновлена.');
      } else {
        await apiPost('/api/livestreams', {
          ...payload,
          status: form.startNow ? 'live' : 'scheduled',
          ...(scheduledIso ? { scheduled_at: scheduledIso } : {})
        });
        setStreamMessage(form.startNow ? 'Эфир создан и запущен.' : 'Трансляция запланирована.');
      }
      resetForm();
      loadStreams();
    } catch (err) {
      setStreamError('Не удалось сохранить трансляцию.');
    } finally {
      setSavingStream(false);
    }
  };

  const handleEditStream = (stream) => {
    setEditingId(stream.id);
    setStreamError('');
    setStreamMessage('');
    setForm({
      title: stream.title || '',
      description: stream.description || '',
      stream_url: stream.stream_url || '',
      thumbnail_url: stream.thumbnail_url || '',
      scheduled_at: toInputDateTime(stream.scheduled_at),
      startNow: false
    });
  };

  const handleStatusChange = async (streamId, nextStatus) => {
    setStreamError('');
    setStreamMessage('');
    setUpdatingId(`${streamId}:${nextStatus}`);
    try {
      await apiPut(`/api/livestreams/${streamId}/status`, { status: nextStatus });
      if (nextStatus === 'live') {
        setStreamMessage('Трансляция переведена в прямой эфир.');
      } else if (nextStatus === 'ended') {
        setStreamMessage('Трансляция завершена.');
      } else {
        setStreamMessage('Статус трансляции обновлен.');
      }
      loadStreams();
    } catch (err) {
      setStreamError('Не удалось изменить статус трансляции.');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeleteStream = async (streamId) => {
    if (!window.confirm('Удалить трансляцию?')) return;
    setStreamError('');
    setStreamMessage('');
    setUpdatingId(`delete:${streamId}`);
    try {
      await apiDelete(`/api/livestreams/${streamId}`);
      setStreamMessage('Трансляция удалена.');
      loadStreams();
    } catch (err) {
      setStreamError('Не удалось удалить трансляцию.');
    } finally {
      setUpdatingId(null);
    }
  };

  const statusLabel = { live: 'В эфире', scheduled: 'Запланирована', ended: 'Завершена' };

  const avatarUrl = useMemo(() => user?.avatar_url || '', [user]);

  // Modern settings panels state
  const [profileMsg, setProfileMsg] = useState('');
  const [profileErr, setProfileErr] = useState('');
  const [pwdMsg, setPwdMsg] = useState('');
  const [pwdErr, setPwdErr] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [pwdSaving, setPwdSaving] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: user?.name || '', email: user?.email || '', password_confirm: '' });
  const [pwdForm, setPwdForm] = useState({ current_password: '', new_password: '', new_password2: '' });

  useEffect(() => {
    setProfileForm({ name: user?.name || '', email: user?.email || '', password_confirm: '' });
  }, [user]);

  const handleUploadAvatar = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    try {
      await apiUpload('/api/user/avatar', fd);
      await refreshProfile();
    } catch {}
  };

  const presets = useMemo(() => {
    const items = [];
    for (let i = 1; i <= 20; i++) {
      const n = String(i).padStart(2, '0');
      items.push(`/avatars/animal${n}.svg`);
    }
    return items;
  }, []);

  const setPreset = async (path) => {
    try {
      await apiPost('/api/user/avatar/preset', { path });
      await refreshProfile();
    } catch {}
  };

  const [tab, setTab] = useState('upload'); // upload | myvideos | profile | streams

  return (
    <div className="page-with-sidebar">
      <aside className="left-sidebar">
        <nav className="left-nav">
          <button onClick={()=>setTab('upload')} className={"left-nav-item" + (tab==='upload' ? ' active' : '')} style={{ width:'100%', textAlign:'left' }}>Главная</button>
          <button onClick={()=>setTab('myvideos')} className={"left-nav-item" + (tab==='myvideos' ? ' active' : '')} style={{ width:'100%', textAlign:'left' }}>Мои видео</button>
          <button onClick={()=>setTab('profile')} className={"left-nav-item" + (tab==='profile' ? ' active' : '')} style={{ width:'100%', textAlign:'left' }}>Профиль</button>
          <button onClick={()=>setTab('streams')} className={"left-nav-item" + (tab==='streams' ? ' active' : '')} style={{ width:'100%', textAlign:'left' }}>Трансляции</button>
          <button onClick={()=>{ logout(); nav('/'); }} className="left-nav-item" style={{ width:'100%', textAlign:'left' }}>Выйти</button>
        </nav>
      </aside>
      <div className="page-content" style={{ padding:'0 16px' }}>
        <h2>Мой профиль</h2>

        {tab === 'upload' && (
          <section className="profile-section">
            <h3>Загрузка видео</h3>
            <VideoUploadForm />
          </section>
        )}

        {tab === 'myvideos' && (
          <section className="profile-section">
            <h3>Мои видео</h3>
            <div className="feed">
              {videos.map(v => <VideoCard key={v.id} video={v} />)}
              {videos.length === 0 && <p>Вы еще не загрузили видео.</p>}
            </div>
          </section>
        )}

        {tab === 'profile' && (
          <>
            <section className="profile-section" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
              <div className="live-form">
                <h3 style={{ marginTop:0 }}>Настройки аккаунта</h3>
                <p className="text-muted">Обновите имя и email. Для сохранения требуется текущий пароль.</p>
                {profileErr && <p className="live-error">{profileErr}</p>}
                {profileMsg && <p className="live-success">{profileMsg}</p>}
                <label>
                  Имя
                  <input value={profileForm.name} onChange={e=>setProfileForm(f=>({...f, name:e.target.value}))} placeholder="Ваше имя" />
                </label>
                <label>
                  Email
                  <input type="email" value={profileForm.email} onChange={e=>setProfileForm(f=>({...f, email:e.target.value}))} placeholder="you@example.com" />
                </label>
                <label>
                  Текущий пароль
                  <input type="password" value={profileForm.password_confirm} onChange={e=>setProfileForm(f=>({...f, password_confirm:e.target.value}))} placeholder="для подтверждения изменений" />
                </label>
                <div className="form-actions">
                  <button className="primary" disabled={profileSaving} onClick={async()=>{
                    setProfileErr(''); setProfileMsg(''); setProfileSaving(true);
                    try {
                      await apiPut('/api/user/profile', profileForm);
                      setProfileMsg('Профиль обновлен.');
                      await refreshProfile();
                      setProfileForm(f=>({...f, password_confirm:''}));
                    } catch (e) {
                      setProfileErr('Не удалось сохранить профиль');
                    } finally { setProfileSaving(false); }
                  }}>
                    {profileSaving ? 'Сохраняем…' : 'Сохранить изменения'}
                  </button>
                </div>
              </div>
              <div className="live-form">
                <h3 style={{ marginTop:0 }}>Смена пароля</h3>
                <p className="text-muted">Минимум 8 символов. После смены войдите заново на других устройствах.</p>
                {pwdErr && <p className="live-error">{pwdErr}</p>}
                {pwdMsg && <p className="live-success">{pwdMsg}</p>}
                <label>
                  Текущий пароль
                  <input type="password" value={pwdForm.current_password} onChange={e=>setPwdForm(f=>({...f, current_password:e.target.value}))} />
                </label>
                <label>
                  Новый пароль
                  <input type="password" value={pwdForm.new_password} onChange={e=>setPwdForm(f=>({...f, new_password:e.target.value}))} />
                </label>
                <label>
                  Повторите новый пароль
                  <input type="password" value={pwdForm.new_password2} onChange={e=>setPwdForm(f=>({...f, new_password2:e.target.value}))} />
                </label>
                <div className="form-actions">
                  <button className="primary" disabled={pwdSaving} onClick={async()=>{
                    setPwdErr(''); setPwdMsg('');
                    if (!pwdForm.new_password || pwdForm.new_password.length < 8) { setPwdErr('Пароль должен быть не менее 8 символов'); return; }
                    if (pwdForm.new_password !== pwdForm.new_password2) { setPwdErr('Пароли не совпадают'); return; }
                    setPwdSaving(true);
                    try {
                      await apiPut('/api/user/password', { current_password: pwdForm.current_password, new_password: pwdForm.new_password });
                      setPwdMsg('Пароль обновлен.');
                      setPwdForm({ current_password:'', new_password:'', new_password2:'' });
                    } catch (e) {
                      setPwdErr('Не удалось сменить пароль');
                    } finally { setPwdSaving(false); }
                  }}>
                    {pwdSaving ? 'Сохраняем…' : 'Обновить пароль'}
                  </button>
                </div>
              </div>
            </section>

            <section className="profile-section">
              <h3>Аватар</h3>
              <div style={{ display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
                <div style={{ width:80, height:80, borderRadius:'50%', overflow:'hidden', background:'#eee', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  {avatarUrl ? <img src={avatarUrl} alt="avatar" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : <span style={{ color:'#888' }}>Нет</span>}
                </div>
                <label className="ghost-button" style={{ cursor:'pointer' }}>
                  Загрузить фото
                  <input type="file" accept="image/*" onChange={handleUploadAvatar} style={{ display:'none' }} />
                </label>
              </div>
              <h4 style={{ marginTop:16 }}>Или выбрать из пресетов</h4>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(56px,1fr))', gap:8 }}>
                {presets.map(src => (
                  <button key={src} title="Выбрать аватар" onClick={() => setPreset(src)} style={{ padding:0, border:'1px solid var(--border-color)', borderRadius:8, overflow:'hidden', background:'#fff' }}>
                    <img src={src} alt="preset" style={{ width:'100%', height:56, objectFit:'cover' }} />
                  </button>
                ))}
              </div>
            </section>
          </>
        )}

        {tab === 'streams' && (
          <section className="profile-section">
            <h3>Мои прямые эфиры</h3>
            <p className="text-muted">Укажите ссылку на поток (HLS, YouTube, Vimeo и т.п.), чтобы поделиться прямой трансляцией на витрине.</p>
            {streamError && <p className="live-error">{streamError}</p>}
            {streamMessage && <p className="live-success">{streamMessage}</p>}
            <form onSubmit={handleCreateOrUpdateStream} className="live-form">
              <div className="form-grid">
                <label>
                  Название эфира*
                  <input value={form.title} onChange={handleInputChange('title')} placeholder="Например, Запуск новой коллекции" required />
                </label>
                <label>
                  Ссылка на поток*
                  <input value={form.stream_url} onChange={handleInputChange('stream_url')} placeholder="https://" required />
                </label>
                <label>
                  Превью (URL)
                  <input value={form.thumbnail_url} onChange={handleInputChange('thumbnail_url')} placeholder="https://" />
                </label>
                <label>
                  Запланированное время старта
                  <input type="datetime-local" value={form.scheduled_at} onChange={handleInputChange('scheduled_at')} disabled={form.startNow && !editingId} />
                </label>
              </div>
              <label className="checkbox-inline">
                <input type="checkbox" checked={form.startNow} onChange={handleInputChange('startNow')} disabled={Boolean(editingId)} />
                Начать эфир сразу после создания
              </label>
              <label>
                Описание
                <textarea rows={3} value={form.description} onChange={handleInputChange('description')} placeholder="Кратко расскажите о трансляции" />
              </label>
              <div className="form-actions">
                <button type="submit" className="primary" disabled={savingStream}>
                  {savingStream ? 'Сохраняем…' : (editingId ? 'Сохранить изменения' : 'Создать трансляцию')}
                </button>
                {editingId && (
                  <button type="button" className="ghost-button" onClick={resetForm} disabled={savingStream}>
                    Отмена
                  </button>
                )}
              </div>
            </form>

            <div className="live-manage-header">
              <h4>Управление эфирами</h4>
              <button type="button" className="ghost-button" onClick={loadStreams} disabled={streamsLoading}>
                Обновить список
              </button>
            </div>
            <div className="live-manage">
              {streamsLoading && <p>Загружаем трансляции…</p>}
              {!streamsLoading && streams.length === 0 && <p>У вас пока нет трансляций.</p>}
              {!streamsLoading && streams.map(stream => (
                <div key={stream.id} className={`live-manage-item${editingId === stream.id ? ' editing' : ''}`}>
                  <div className="live-manage-info">
                    <h4>{stream.title}</h4>
                    <div className="live-manage-meta">
                      <span className={`status-badge status-${stream.status}`}>{statusLabel[stream.status] || stream.status}</span>
                      {stream.status === 'scheduled' && stream.scheduled_at && (
                        <span>Старт: {formatDateTime(stream.scheduled_at)}</span>
                      )}
                      {stream.status === 'live' && stream.started_at && (
                        <span>В эфире с {formatDateTime(stream.started_at)}</span>
                      )}
                      {stream.status === 'ended' && stream.ended_at && (
                        <span>Завершено: {formatDateTime(stream.ended_at)}</span>
                      )}
                    </div>
                    <a href={stream.stream_url} target="_blank" rel="noopener noreferrer" className="ghost-link">Открыть трансляцию</a>
                    {stream.description && <p className="live-manage-description">{stream.description}</p>}
                  </div>
                  <div className="live-manage-actions">
                    {stream.status !== 'live' && (
                      <button type="button" onClick={() => handleStatusChange(stream.id, 'live')} disabled={updatingId === `${stream.id}:live`}>
                        {updatingId === `${stream.id}:live` ? 'Запускаем…' : 'Начать эфир'}
                      </button>
                    )}
                    {stream.status === 'live' && (
                      <button type="button" onClick={() => handleStatusChange(stream.id, 'ended')} disabled={updatingId === `${stream.id}:ended`}>
                        {updatingId === `${stream.id}:ended` ? 'Завершаем…' : 'Завершить'}
                      </button>
                    )}
                    {stream.status !== 'scheduled' && (
                      <button type="button" onClick={() => handleStatusChange(stream.id, 'scheduled')} disabled={updatingId === `${stream.id}:scheduled`}>
                        {updatingId === `${stream.id}:scheduled` ? 'Обновляем…' : 'Отметить как запланированную'}
                      </button>
                    )}
                    <button type="button" onClick={() => handleEditStream(stream)} disabled={Boolean(updatingId && updatingId.startsWith('delete:'))}>
                      Редактировать
                    </button>
                    <button type="button" className="danger-button" onClick={() => handleDeleteStream(stream.id)} disabled={updatingId === `delete:${stream.id}`}>
                      {updatingId === `delete:${stream.id}` ? 'Удаляем…' : 'Удалить'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

