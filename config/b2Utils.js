// utils/b2Utils.js

const B2 = require("backblaze-b2");
require("dotenv").config();
const { URL } = require("url");

const b2 = new B2({
  applicationKeyId: process.env.B2_KEY_ID,
  applicationKey:   process.env.B2_APP_KEY
});

/**
 * Ensure we have fresh credentials and return the
 * canonical download host (e.g. "https://f005.backblazeb2.com")
 */
async function authorizeB2() {
  const { data } = await b2.authorize();
  return data.downloadUrl;  
}

/**
 * Given a public-style fileUrl:
 *   https://{downloadUrl}/file/{bucketName}/{path}
 * returns a signed URL valid for `validDurationInSeconds`.
 */
async function getSecureDownloadLink(fileUrl, validDurationInSeconds = 3600) {
  // 1) authorize and get the bucket's download host
  const downloadHost = await authorizeB2(); 
  //    e.g. "https://f005.backblazeb2.com"

  // 2) parse the URL and pull its pathname
  const { pathname } = new URL(fileUrl);
  //    e.g. "/file/vidora-uploads/images/avatar.png"

  // 3) verify and strip the expected prefix
  const prefix = `/file/${process.env.B2_BUCKET_NAME}/`;
  if (!pathname.startsWith(prefix)) {
    throw new Error(`Invalid B2 URL path: ${pathname}`);
  }
  const rawFileName = pathname.slice(prefix.length);
  //    e.g. "images/avatar.png"

  // 4) request a time‑limited download auth token for exactly that file
  const { data } = await b2.getDownloadAuthorization({
    bucketId:               process.env.B2_BUCKET_ID,
    fileNamePrefix:         rawFileName,
    validDurationInSeconds
  });

  // 5) build and return the signed URL
  const signedUrl =  
    `${downloadHost}${prefix}` +
    `${encodeURIComponent(rawFileName)}` +
    `?Authorization=${data.authorizationToken}`;

  return signedUrl;
}

module.exports = { getSecureDownloadLink };
