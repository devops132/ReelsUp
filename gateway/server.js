import express from 'express';
import morgan from 'morgan';
import { createProxyMiddleware } from 'http-proxy-middleware';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const FRONTEND_STATIC_DIR = path.resolve(process.env.FRONTEND_STATIC_DIR || 'web');
const BACKEND_TARGET = process.env.BACKEND_TARGET;
const MINIO_TARGET = process.env.MINIO_TARGET;
const PUBLIC_BASE_PATH = process.env.PUBLIC_BASE_PATH || '';
const FRONTEND_UPSTREAM = process.env.FRONTEND_UPSTREAM || '';

if (!BACKEND_TARGET) console.warn('[WARN] BACKEND_TARGET is not set');
if (!MINIO_TARGET) console.warn('[WARN] MINIO_TARGET is not set');

let s3Client = null;
if (process.env.MINIO_ACCESS_KEY && process.env.MINIO_SECRET_KEY) {
  s3Client = new S3Client({
    region: process.env.MINIO_REGION || 'us-east-1',
    endpoint: MINIO_TARGET,
    forcePathStyle: String(process.env.MINIO_FORCE_PATH_STYLE || 'true') === 'true',
    tls: String(process.env.MINIO_USE_SSL || 'false') === 'true',
    credentials: { accessKeyId: process.env.MINIO_ACCESS_KEY, secretAccessKey: process.env.MINIO_SECRET_KEY },
  });
}

app.use(morgan('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

function rewriteJsonBody(bodyStr) {
  try {
    const obj = JSON.parse(bodyStr);
    const back = BACKEND_TARGET?.replace(/\/$/,'') || '';
    const minio = MINIO_TARGET?.replace(/\/$/,'') || '';
    function rw(v){
      if (typeof v==='string'){
        if (back && v.startsWith(back)) return v.replace(back,'/api');
        if (minio && v.startsWith(minio)) {
          try {
            const u = new URL(v);
            const parts = u.pathname.replace(/^\//,'').split('/');
            if (parts.length>=2) return `/files/${parts.shift()}/${parts.join('/')}`;
          } catch {}
          return `/proxy-file?u=${encodeURIComponent(v)}`;
        }
        if (/\.s3[.-][^/]+\//.test(v)) return `/proxy-file?u=${encodeURIComponent(v)}`;
      } else if (Array.isArray(v)) return v.map(rw);
      else if (v && typeof v==='object') { for (const k of Object.keys(v)) v[k]=rw(v[k]); return v; }
      return v;
    }
    return JSON.stringify(rw(obj));
  } catch { return bodyStr; }
}

if (BACKEND_TARGET) {
  app.use(`${PUBLIC_BASE_PATH}/api`, createProxyMiddleware({
    target: BACKEND_TARGET,
    changeOrigin: true,
    selfHandleResponse: true,
    onProxyReq: (proxyReq, req) => {
      console.log(`[API PROXY] ${req.method} ${req.originalUrl} -> ${BACKEND_TARGET}${req.url}`);
    },
    onError: (err, req, res) => {
      console.error('[API PROXY ERROR]', req.method, req.originalUrl, err.message);
      res.status(502).end('Bad gateway');
    },
    onProxyRes: async (proxyRes, req, res) => {
      const ct = proxyRes.headers['content-type'] || '';
      const chunks = [];
      proxyRes.on('data', c => chunks.push(c));
      proxyRes.on('end', () => {
        const buf = Buffer.concat(chunks);
        let body = buf.toString('utf-8');
        if (ct.includes('application/json')) {
          body = rewriteJsonBody(body);
          res.setHeader('content-type', 'application/json; charset=utf-8');
        } else {
          if (process.env.BACKEND_TARGET) body = body.split(BACKEND_TARGET).join('/api');
          if (process.env.MINIO_TARGET) body = body.split(MINIO_TARGET).join('/proxy-file?u=' + encodeURIComponent(process.env.MINIO_TARGET));
          if (ct) res.setHeader('content-type', ct);
        }
        for (const [k,v] of Object.entries(proxyRes.headers)) {
          if (k.toLowerCase()==='content-length' || k.toLowerCase()==='content-type') continue;
          res.setHeader(k, v);
        }
        res.statusCode = proxyRes.statusCode || 200;
        res.end(body);
        console.log(`[API PROXY RES] ${req.method} ${req.originalUrl} <- ${proxyRes.statusCode}`);
      });
    },
    pathRewrite: pathStr => pathStr.replace(new RegExp(`^${PUBLIC_BASE_PATH}/api`), ''),
  }));
}

app.get(`${PUBLIC_BASE_PATH}/files/:bucket/*`, async (req, res) => {
  const { bucket } = req.params;
  const key = req.params[0];
  if (!bucket || !key) return res.status(400).send('Invalid file path');
  if (s3Client) {
    try {
      const data = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: key, Range: req.headers.range }));
      if (data.ContentType) res.setHeader('Content-Type', data.ContentType);
      if (data.ContentLength) res.setHeader('Content-Length', data.ContentLength);
      if (data.ETag) res.setHeader('ETag', data.ETag);
      if (data.LastModified) res.setHeader('Last-Modified', new Date(data.LastModified).toUTCString());
      if (req.headers.range) res.status(206);
      data.Body.pipe(res); return;
    } catch (e) { console.error('S3 stream error', e); }
  }
  const target = MINIO_TARGET?.replace(/\/$/,'');
  if (target) {
    try {
      const r = await fetch(`${target}/${bucket}/${key}`, { headers: { range: req.headers.range || undefined } });
      res.status(r.status);
      for (const [k,v] of r.headers) { if (k.toLowerCase()==='content-length') continue; res.setHeader(k, v); }
      r.body.pipe(res); return;
    } catch (e) { console.error('HTTP proxy error', e); }
  }
  res.status(500).send('MINIO is not configured');
});

app.get(`${PUBLIC_BASE_PATH}/proxy-file`, async (req, res) => {
  const u = req.query.u; if (!u) return res.status(400).send('Missing u');
  const url = decodeURIComponent(u);
  try {
    const r = await fetch(url, { headers: { range: req.headers.range || undefined } });
    res.status(r.status);
    for (const [k,v] of r.headers) { if (k.toLowerCase()==='content-length') continue; res.setHeader(k, v); }
    r.body.pipe(res);
  } catch (e) { console.error('proxy-file error', e); res.status(502).send('Bad gateway'); }
});

if (FRONTEND_UPSTREAM) {
  app.use((req, res, next) => {
    if (req.path.startsWith(`${PUBLIC_BASE_PATH}/api`) || req.path.startsWith(`${PUBLIC_BASE_PATH}/files`) || req.path.startsWith(`${PUBLIC_BASE_PATH}/proxy-file`)) return next();
    return createProxyMiddleware({ target: FRONTEND_UPSTREAM, changeOrigin: true })(req, res, next);
  });
}

if (!fs.existsSync(FRONTEND_STATIC_DIR)) console.warn(`[WARN] Static dir "${FRONTEND_STATIC_DIR}" not found.`);
app.use(PUBLIC_BASE_PATH || '/', express.static(FRONTEND_STATIC_DIR, { index: ['index.html'] }));

app.get('*', (req, res, next) => {
  if (req.path.startsWith(`${PUBLIC_BASE_PATH}/api`) || req.path.startsWith(`${PUBLIC_BASE_PATH}/files`) || req.path.startsWith(`${PUBLIC_BASE_PATH}/proxy-file`)) return next();
  const indexPath = path.join(FRONTEND_STATIC_DIR, 'index.html');
  if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
  res.status(404).send('Not found');
});

app.listen(PORT, () => console.log(`Gateway on http://0.0.0.0:${PORT}${PUBLIC_BASE_PATH}`));
