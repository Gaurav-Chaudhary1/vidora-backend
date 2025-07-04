// config/backblaze.js
const B2 = require('backblaze-b2');
require('dotenv').config();

const b2 = new B2({
  applicationKeyId: process.env.B2_KEY_ID,
  applicationKey:  process.env.B2_APP_KEY
});

/**
 * Authorizes (and refreshes) your B2 client.
 * Throws if anything goes wrong.
 */
async function authorizeB2() {
  try {
    await b2.authorize();
    console.log('✅ B2: authorized successfully');
  } catch (err) {
    // err.response may contain status, data, etc.
    const info = err.response?.data || err.message;
    console.error('❌ B2 authorization failed:', info);
    throw new Error(`B2 authorization failed: ${JSON.stringify(info)}`);
  }
}

/**
 * Uploads a file buffer to B2, returning the publicly‐accessible URL.
 *
 * @param {string} fileName    the key under your bucket
 * @param {Buffer} fileBuffer  the raw bytes
 * @param {string} contentType the MIME type (e.g. "video/mp4")
 * @returns {string}           a download URL
 */
async function uploadFileToB2(fileName, fileBuffer, contentType) {
  // 1) (re-)authorize on every upload, to keep your token fresh
  await authorizeB2();

  // 2) fetch an upload URL
  let uploadUrlResp;
  try {
    uploadUrlResp = await b2.getUploadUrl({
      bucketId: process.env.B2_BUCKET_ID
    });
  } catch (err) {
    const info = err.response?.data || err.message;
    console.error('❌ B2 getUploadUrl failed:', info);
    throw new Error(`B2 getUploadUrl failed: ${JSON.stringify(info)}`);
  }

  // 3) actually upload the file
  let uploadResp;
  try {
    uploadResp = await b2.uploadFile({
      uploadUrl: uploadUrlResp.data.uploadUrl,
      uploadAuthToken: uploadUrlResp.data.authorizationToken,
      fileName,
      data: fileBuffer,
      contentType
    });
  } catch (err) {
    const info = err.response?.data || err.message;
    console.error('❌ B2 uploadFile failed:', info);
    throw new Error(`B2 uploadFile failed: ${JSON.stringify(info)}`);
  }

  // 4) construct the public URL
  //    you can override DOWNLOAD_BASE in env, or use the default public domain
  const DOWNLOAD_BASE =
    process.env.B2_DOWNLOAD_URL ||
    `https://f000.backblazeb2.com/file/${process.env.B2_BUCKET_NAME}`;

  const publicUrl = `${DOWNLOAD_BASE}/${uploadResp.data.fileName}`;
  console.log('✅ B2 upload succeeded, public URL:', publicUrl);
  return publicUrl;
}

module.exports = { authorizeB2, uploadFileToB2 };
