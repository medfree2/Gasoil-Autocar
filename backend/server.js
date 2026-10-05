const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config();

const gasoilRoutes = require("./routes/gasoil");
const avanceRoutes = require("./routes/Avance");
const authRoutes = require("./routes/auth");
const authMiddleware = require("./middleware/auth");

const app = express();

const PORT = process.env.PORT || 5000;

const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb://127.0.0.1:27017/suivi_gasoil";

if (!process.env.JWT_SECRET) {
  console.error("❌ JWT_SECRET manquant");
}

// ==========================================================
// DATABASE
// ==========================================================

let mongoConnectionPromise = null;

const connectDatabase = async () => {
  if (mongoose.connection.readyState === 1) {
    return;
  }

  if (!mongoConnectionPromise) {
    mongoConnectionPromise = mongoose
      .connect(MONGO_URI)
      .then(() => {
        console.log("✅ MongoDB connecté");
      })
      .catch((error) => {
        mongoConnectionPromise = null;

        console.error(
          "❌ Erreur connexion MongoDB :",
          error.message
        );

        throw error;
      });
  }

  return mongoConnectionPromise;
};

// ==========================================================
// CORS
// ==========================================================

const allowedOrigins = [
  "http://localhost:5173",
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(
        new Error(
          `Origine non autorisée par CORS : ${origin}`
        )
      );
    },

    credentials: true,
  })
);

// ==========================================================
// BODY
// ==========================================================

app.use(express.json());

app.use(
  express.urlencoded({
    extended: true,
  })
);

// ==========================================================
// DATABASE MIDDLEWARE
// ==========================================================

app.use(async (req, res, next) => {
  try {
    await connectDatabase();
    next();
  } catch (error) {
    res.status(500).json({
      message:
        "Impossible de se connecter à MongoDB.",
    });
  }
});

// ==========================================================
// TEMPORARY LOCAL UPLOADS
// ==========================================================

const uploadsDirectory =
  process.env.VERCEL === "1"
    ? path.join("/tmp", "uploads")
    : path.join(__dirname, "uploads");

app.use(
  "/uploads",
  express.static(uploadsDirectory)
);

// ==========================================================
// PUBLIC ROUTES
// ==========================================================

app.use(
  "/api/auth",
  authRoutes
);

// ==========================================================
// PROTECTED ROUTES
// ==========================================================

app.use(
  "/api/gasoil",
  authMiddleware,
  gasoilRoutes
);

app.use(
  "/api/avances",
  authMiddleware,
  avanceRoutes
);

// ==========================================================
// HEALTH
// ==========================================================

app.get(
  "/api/health",
  async (req, res) => {
    res.json({
      status: "OK",
      app: "SUIVI GASOIL AUTOCAR",
      mongodb:
        mongoose.connection.readyState === 1
          ? "CONNECTED"
          : "DISCONNECTED",
      environment:
        process.env.NODE_ENV ||
        "development",
    });
  }
);

// ==========================================================
// ROOT
// ==========================================================

app.get("/", (req, res) => {
  res.send(
    "🚌 SUIVI GASOIL AUTOCAR API"
  );
});

// ==========================================================
// ERROR HANDLER
// ==========================================================

app.use((error, req, res, next) => {
  console.error("❌ Erreur serveur :", error);

  if (res.headersSent) {
    return next(error);
  }

  res.status(500).json({
    message:
      error?.message ||
      "Erreur interne du serveur.",
  });
});

// ==========================================================
// LOCAL DEVELOPMENT
// ==========================================================

if (require.main === module) {
  connectDatabase()
    .then(() => {
      app.listen(
        PORT,
        () => {
          console.log("");
          console.log(
            "====================================="
          );
          console.log(
            "🚌 SUIVI GASOIL AUTOCAR"
          );
          console.log(
            "====================================="
          );
          console.log(
            `✅ Backend : http://localhost:${PORT}`
          );
          console.log(
            `✅ Health  : http://localhost:${PORT}/api/health`
          );
          console.log(
            "====================================="
          );
          console.log("");
        }
      );
    })
    .catch((error) => {
      console.error(
        "❌ Démarrage impossible :",
        error.message
      );
    });
}

// ==========================================================
// VERCEL / MODULE EXPORT
// ==========================================================

module.exports = app;
