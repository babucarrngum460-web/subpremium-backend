const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const Mux = require("@mux/mux-node");
const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

dotenv.config();

initializeApp({
credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
});

const db = getFirestore();

const app = express();

app.use(cors());
app.use(express.json());

const mux = new Mux({
tokenId: process.env.MUX_TOKEN_ID,
tokenSecret: process.env.MUX_TOKEN_SECRET,
});

// Health Check
app.get("/", (req, res) => {
  res.json({
    ok: true,
    message: "SUB PREMIUM TV backend running",
  });
});

// Mux Test Route
app.get("/api/test-mux", (req, res) => {
  res.json({
    success: true,
    muxLoaded:
      !!process.env.MUX_TOKEN_ID &&
      !!process.env.MUX_TOKEN_SECRET,
    tokenIdFound: !!process.env.MUX_TOKEN_ID,
    tokenSecretFound: !!process.env.MUX_TOKEN_SECRET,
  });
});

// Create Upload URL
app.post("/api/mux/create-upload", async (req, res) => {
  try {
    const upload = await mux.video.uploads.create({
      cors_origin: "*",
      new_asset_settings: {
        playback_policy: ["public"],
      },
    });

    res.json({
      success: true,
      uploadId: upload.id,
      uploadUrl: upload.url,
      status: upload.status,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      error: "Failed to create Mux upload",
      details: error.message,
    });
  }
});

// Check Upload Status
app.get("/api/mux/upload-status/:uploadId", async (req, res) => {
  try {
    const cleanUploadId = req.params.uploadId
      .replaceAll('"', "")
      .replaceAll("'", "")
      .trim();

    const upload = await mux.video.uploads.retrieve(cleanUploadId);

    let playbackId = null;
    let assetStatus = null;

let playbackId = null;
let assetStatus = null;

if (upload.asset_id) {

  const asset = await mux.video.assets.retrieve(upload.asset_id);

  playbackId = asset.playback_ids?.[0]?.id || null;
  assetStatus = asset.status || null;

  if (asset.status === "ready" && playbackId) {

    await db.collection("videos")
      .doc(upload.id)
      .update({
        status: "ready",
        playbackId: playbackId,
        hlsUrl: `https://stream.mux.com/${playbackId}.m3u8`,
        thumbnailUrl: `https://image.mux.com/${playbackId}/thumbnail.jpg`
      });

  }
}

res.json({
    success: true,
    status: assetStatus,
    uploadId: upload.id,
    assetId: upload.asset_id,
    playbackId,
    hlsUrl: playbackId
        ? `https://stream.mux.com/${playbackId}.m3u8`
        : null,
    thumbnailUrl: playbackId
        ? `https://image.mux.com/${playbackId}/thumbnail.jpg`
        : null
});

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      error: "Failed to check upload",
      details: error.message,
    });
  }
});

// Server Start
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`SUB PREMIUM TV backend running on port ${PORT}`);
});
