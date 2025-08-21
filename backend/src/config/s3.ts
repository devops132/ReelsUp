// s3.ts
import AWS from 'aws-sdk';

const s3 = new AWS.S3({
  accessKeyId: process.env.S3_ACCESS_KEY,
  secretAccessKey: process.env.S3_SECRET_KEY,
  endpoint: process.env.S3_ENDPOINT,
  s3ForcePathStyle: true,
  signatureVersion: 'v4',
});

// TS7006: указали тип параметру bucketName (string вместо implicit any)
export async function ensureBucket(bucketName: string): Promise<void> {
  try {
    const buckets = await s3.listBuckets().promise();
    // TS18048: если buckets.Buckets undefined, заменяем на пустой массив с помощью ?? []
    const exists = (buckets.Buckets ?? []).some(b => b.Name === bucketName);
    if (!exists) {
      await s3.createBucket({ Bucket: bucketName }).promise();
      console.log('Created bucket', bucketName);
    }
  } catch (e) {
    console.error('Error ensuring bucket', e);
    throw e;
  }
}

export default s3;
