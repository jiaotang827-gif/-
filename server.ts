import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from "firebase/firestore";
import firebaseConfig from "./firebase-applet-config.json";

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
    },
  });

  const PORT = 3000;

  // Initialize Firebase on the server
  const firebaseApp = initializeApp(firebaseConfig);
  const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

  app.use(express.json());

  // API Routes
  app.get("/api/reagents", async (req, res) => {
    // This is just a fallback, we use sockets for real-time
    res.json({ message: "Use WebSockets for real-time data" });
  });

  // Real-time sync with Firestore on the server
  const reagentsRef = collection(db, "reagents");
  const q = query(reagentsRef, orderBy("updatedAt", "desc"));

  onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    io.emit("reagents:update", data);
  }, (error) => {
    console.error("Firestore sync error:", error);
  });

  // Socket handlers for mutations
  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    socket.on("reagents:add", async (reagent) => {
      try {
        await addDoc(reagentsRef, reagent);
      } catch (error) {
        console.error("Error adding reagent:", error);
        socket.emit("error", "Failed to add reagent");
      }
    });

    socket.on("reagents:update", async ({ id, data }) => {
      try {
        await updateDoc(doc(db, "reagents", id), data);
      } catch (error) {
        console.error("Error updating reagent:", error);
        socket.emit("error", "Failed to update reagent");
      }
    });

    socket.on("reagents:delete", async (id) => {
      try {
        await deleteDoc(doc(db, "reagents", id));
      } catch (error) {
        console.error("Error deleting reagent:", error);
        socket.emit("error", "Failed to delete reagent");
      }
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
