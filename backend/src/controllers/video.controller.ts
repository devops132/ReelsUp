import { Request, Response } from "express";
import fs from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import s3 from "../config/s3.js";
import { pool } from "../config/db.js";

// загрузка видео
export async function uploadVideo(req: Request, res: Response) {
  try {
    console.log("[%s] POST /videos", new Date().toISOString());
    if (!req.file) {
      res.status(400).json({ error: "No video file uploaded" });
      return; // 👈 добавлено для TS
    }

    // после проверки явно приводим к типу
    const file = req.file as Express.Multer.File;

    const userId = (req as any).user.id;
    const { title, description } = req.body;

    const bucket = process.env.S3_BUCKET!;
    const key = `videos/${Date.now()}_${file.originalname}`;

    // заливаем видео в MinIO
    await s3
      .upload({
        Bucket: bucket,
        Key: key,
        Body: fs.createReadStream(file.path),
        ContentType: file.mimetype,
      })
      .promise();

    // генерируем превью (jpg)
    const thumbKey = `thumbnails/${Date.now()}_${path.parse(file.originalname).name}.jpg`;
    const thumbPath = `/tmp/${Date.now()}_thumb.jpg`;

    await new Promise<void>((resolve, reject) => {
      ffmpeg(file.path)
        .on("end", () => resolve())
        .on("error", (err: Error) => reject(err))
        .screenshots({
          count: 1,
          folder: path.dirname(thumbPath),
          filename: path.basename(thumbPath),
          size: "320x240",
        });
    });

    // заливаем превью в MinIO
    await s3
      .upload({
        Bucket: bucket,
        Key: thumbKey,
        Body: fs.createReadStream(thumbPath),
        ContentType: "image/jpeg",
      })
      .promise();

    // удаляем временные файлы
    fs.unlinkSync(file.path);
    fs.unlinkSync(thumbPath);

    // сохраняем только ключи в БД
    const result = await pool.query(
      "INSERT INTO videos(user_id, title, description, s3_key, thumbnail_key, status) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",
      [userId, title, description, key, thumbKey, "pending"]
    );

    console.log("[%s] Uploaded video id=%s", new Date().toISOString(), result.rows[0].id);
    res.json(result.rows[0]);
  } catch (e) {
    console.error("Upload error:", e);
    res.status(500).json({ error: "Upload failed" });
  }
}

// список видео
export async function listVideos(req: Request, res: Response) {
  try {
    console.log("[%s] GET /videos", new Date().toISOString());
    const bucket = process.env.S3_BUCKET!;
    console.log("Fetching approved videos from DB");
    const videos = (
      await pool.query("SELECT * FROM videos WHERE status='approved' ORDER BY created_at DESC")
    ).rows;
    console.log("DB returned %d videos", videos.length);

    // для каждого видео генерируем Signed URL
    const withUrls = videos.map((v: any) => ({
      ...v,
      video_url: s3.getSignedUrl("getObject", {
        Bucket: bucket,
        Key: v.s3_key,
        Expires: 3600, // 1 час
      }),
      thumbnail_url: v.thumbnail_key
        ? s3.getSignedUrl("getObject", {
            Bucket: bucket,
            Key: v.thumbnail_key,
            Expires: 3600,
          })
        : null,
    }));

    console.log("Responding with %d videos", withUrls.length);
    res.json(withUrls);
  } catch (e) {
    console.error("List error:", e);
    res.status(500).json({ error: "Failed to fetch videos" });
  }
}

// получение одного видео
export async function getVideo(req: Request, res: Response) {
  try {
    const { id } = req.params;
    console.log("[%s] GET /videos/%s", new Date().toISOString(), id);
    const bucket = process.env.S3_BUCKET!;

    const result = await pool.query("SELECT * FROM videos WHERE id=$1", [id]);
    if (result.rows.length === 0) {
      console.warn("[%s] Missing video id=%s", new Date().toISOString(), id);
      return res.status(404).json({ error: "Video not found" });
    }

    const v = result.rows[0];
    const signedVideoUrl = s3.getSignedUrl("getObject", {
      Bucket: bucket,
      Key: v.s3_key,
      Expires: 3600,
    });
    const signedThumbUrl = v.thumbnail_key
      ? s3.getSignedUrl("getObject", {
          Bucket: bucket,
          Key: v.thumbnail_key,
          Expires: 3600,
        })
      : null;

    res.json({
      ...v,
      video_url: signedVideoUrl,
      thumbnail_url: signedThumbUrl,
    });
  } catch (e) {
    console.error("Get error:", e);
    res.status(500).json({ error: "Failed to get video" });
  }
}
