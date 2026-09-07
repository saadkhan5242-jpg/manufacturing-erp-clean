import express from "express";
const router = express.Router();

router.post("/generate-module", (req, res) => {
  const { moduleName, description } = req.body;

  if (!moduleName || !description) {
    return res.status(400).json({ error: "moduleName and description are required" });
  }

  res.json({
    message: "Module generation simulated",
    moduleName,
    descriptionPreview: description.substring(0, 50)
  });
});

export default router;
