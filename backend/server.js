const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config();

const gasoilRoutes = require("./routes/gasoil");
const avanceRoutes = require("./routes/avance");
const authRoutes = require("./routes/auth");
const authMiddleware = require("./middleware/auth");

const app = express();

const PORT =
  process.env.PORT || 5000;

const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb://127.0.0.1:27017/suivi_gasoil";

if (!process.env.JWT_SECRET) {
  console.error(
    "❌ JWT_SECRET manquant dans le fichier .env"
  );

  process.exit(1);
}

app.use(
  cors({
    origin: "http://localhost:5173",
  })
);

app.use(express.json());

app.use(
  express.urlencoded({
    extended: true,
  })
);

app.use(
  "/uploads",
  express.static(
    path.join(
      __dirname,
      "uploads"
    )
  )
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
  (req, res) => {
    res.json({
      status: "OK",
      app:
        "SUIVI GASOIL AUTOCAR",
      mongodb:
        mongoose.connection
          .readyState === 1
          ? "CONNECTED"
          : "DISCONNECTED",
    });
  }
);

app.get("/", (req, res) => {
  res.send(
    "🚌 SUIVI GASOIL AUTOCAR API"
  );
});

// ==========================================================
// DATABASE
// ==========================================================

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log(
      "✅ MongoDB connecté"
    );

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
          `✅ Backend  : http://localhost:${PORT}`
        );

        console.log(
          `✅ Auth     : http://localhost:${PORT}/api/auth/status`
        );

        console.log(
          `✅ Gasoil   : http://localhost:${PORT}/api/gasoil`
        );

        console.log(
          `✅ Avances  : http://localhost:${PORT}/api/avances`
        );

        console.log(
          `✅ Active   : http://localhost:${PORT}/api/avances/active`
        );

        console.log(
          `✅ Health   : http://localhost:${PORT}/api/health`
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
      "❌ Erreur connexion MongoDB :"
    );

    console.error(
      error.message
    );
  });
