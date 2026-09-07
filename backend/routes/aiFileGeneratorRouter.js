import express from "express";
const router = express.Router();

router.post("/generate-file", (req, res) => {
  const { filename, content } = req.body;

  if (!filename || !content) {
    return res.status(400).json({ error: "filename and content are required" });
  }

  res.json({
    message: "File generation simulated",
    filename,
    contentPreview: content.substring(0, 50)
  });
});

export default router;
