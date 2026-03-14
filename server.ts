import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  const chaptersFilePath = path.join(process.cwd(), 'chapters.json');

  // API to get chapters
  app.get("/api/chapters", (req, res) => {
    try {
      if (fs.existsSync(chaptersFilePath)) {
        const data = fs.readFileSync(chaptersFilePath, 'utf8');
        res.json(JSON.parse(data));
      } else {
        res.json([]);
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to read chapters" });
    }
  });

  // API to save chapters
  app.post("/api/chapters", (req, res) => {
    try {
      const chapters = req.body;
      fs.writeFileSync(chaptersFilePath, JSON.stringify(chapters, null, 2));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to save chapters" });
    }
  });

  // API to get cover image
  const coverFilePath = path.join(process.cwd(), 'cover_base64.txt');
  app.get("/api/cover", (req, res) => {
    try {
      if (fs.existsSync(coverFilePath)) {
        const data = fs.readFileSync(coverFilePath, 'utf8');
        res.json({ cover: data });
      } else {
        res.json({ cover: '/cover.png' });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to read cover" });
    }
  });

  // API to save cover image
  app.post("/api/cover", (req, res) => {
    try {
      const { cover } = req.body;
      fs.writeFileSync(coverFilePath, cover);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to save cover" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
