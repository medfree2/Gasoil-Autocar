const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config();

const gasoilRoutes = require("./routes/gasoil");
const avanceRoutes = require("./routes/Avance");
const authRoutes = require("./routes/auth");
const centreRoutes = require("./routes/centres");
const authMiddleware = require("./middleware/auth");

const Centre = require("./models/Centre");
const User = require("./models/User");
const Gasoil = require("./models/Gasoil");
const Avance = require("./models/Avance");

const app = express();

const PORT =
  process.env.PORT || 5000;

const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb://127.0.0.1:27017/suivi_gasoil";

if (
  !process.env.JWT_SECRET
) {
  console.error(
    "❌ JWT_SECRET manquant"
  );
}

// ==========================================================
// DATABASE
// ==========================================================

let mongoConnectionPromise =
  null;

let bootstrapPromise = null;

const dropLegacySingleFieldUniqueIndex =
  async (
    model,
    fieldName
  ) => {
    try {
      const indexes =
        await model.collection.indexes();

      for (
        const index of indexes
      ) {
        const keys =
          Object.keys(
            index.key || {}
          );

        if (
          index.unique === true &&
          keys.length === 1 &&
          keys[0] ===
            fieldName
        ) {
          await model.collection.dropIndex(
            index.name
          );

          console.log(
            `✅ Ancien index ${index.name} supprimé`
          );
        }
      }
    } catch (error) {
      if (
        !String(
          error.message || ""
        ).includes(
          "ns does not exist"
        )
      ) {
        console.warn(
          `⚠️ Index ${fieldName} :`,
          error.message
        );
      }
    }
  };

const bootstrapMultiCentre =
  async () => {
    if (bootstrapPromise) {
      return bootstrapPromise;
    }

    bootstrapPromise =
      (async () => {
        // 1) Ensure the Marrakech centre exists.
        const marrakech =
          await Centre.findOneAndUpdate(
            {
              code: "MRK",
            },
            {
              $setOnInsert: {
                name:
                  "Marrakech",
                code: "MRK",
                active: true,
              },
            },
            {
              upsert: true,
              new: true,
              setDefaultsOnInsert:
                true,
            }
          );

        // 2) ONE-TIME PRODUCTION MIGRATION.
        //
        // Only the users that exist when this migration runs for the
        // first time are assigned to Marrakech. The migration is then
        // permanently marked as completed in MongoDB, so users created
        // later for Casablanca, Fès, Agadir, etc. are NOT moved.
        //
        // The existing main account "MOHAMMED NOUREDDINE" is promoted
        // to SUPER_ADMIN.
        const migrationsCollection =
          mongoose.connection.collection(
            "app_migrations"
          );

        const migrationKey =
          "2026-10-existing-users-to-marrakech-v1";

        const migrationAlreadyDone =
          await migrationsCollection.findOne({
            _id: migrationKey,
          });

        if (!migrationAlreadyDone) {
          const existingUsers =
            await User.find({})
              .select("_id name role")
              .lean();

          const existingUserIds =
            existingUsers.map(
              (user) => user._id
            );

          if (existingUserIds.length) {
            await User.updateMany(
              {
                _id: {
                  $in: existingUserIds,
                },
              },
              {
                $set: {
                  centre:
                    marrakech._id,
                },
              }
            );
          }

          const mainAdmin =
            existingUsers.find(
              (user) =>
                String(
                  user.name || ""
                )
                  .trim()
                  .toUpperCase() ===
                "MOHAMMED NOUREDDINE"
            );

          if (mainAdmin) {
            await User.updateOne(
              {
                _id:
                  mainAdmin._id,
              },
              {
                $set: {
                  role:
                    "SUPER_ADMIN",
                  centre:
                    marrakech._id,
                },
              }
            );

            console.log(
              "✅ MOHAMMED NOUREDDINE promu SUPER_ADMIN"
            );
          } else {
            // Safety fallback: if the display name differs in production,
            // promote the oldest existing ADMIN only when no SUPER_ADMIN
            // already exists.
            const superAdminCount =
              await User.countDocuments({
                role:
                  "SUPER_ADMIN",
              });

            if (
              superAdminCount === 0
            ) {
              const firstExistingAdmin =
                await User.findOne({
                  _id: {
                    $in:
                      existingUserIds,
                  },
                  role:
                    "ADMIN",
                }).sort({
                  createdAt: 1,
                  _id: 1,
                });

              if (firstExistingAdmin) {
                firstExistingAdmin.role =
                  "SUPER_ADMIN";

                firstExistingAdmin.centre =
                  marrakech._id;

                await firstExistingAdmin.save();

                console.log(
                  "✅ Administrateur principal promu SUPER_ADMIN"
                );
              }
            }
          }

          await migrationsCollection.insertOne({
            _id: migrationKey,
            completedAt:
              new Date(),
            centreId:
              marrakech._id,
            usersMigrated:
              existingUserIds.length,
          });

          console.log(
            `✅ Migration unique terminée : ${existingUserIds.length} utilisateur(s) existant(s) affecté(s) à Marrakech`
          );
        }

        // 3) Legacy business data without a centre belongs to Marrakech.
        // This does NOT overwrite records already assigned to another centre.
        await Promise.all([
          Gasoil.updateMany(
            {
              $or: [
                {
                  centre: {
                    $exists:
                      false,
                  },
                },
                {
                  centre: null,
                },
              ],
            },
            {
              $set: {
                centre:
                  marrakech._id,
              },
            }
          ),

          Avance.updateMany(
            {
              $or: [
                {
                  centre: {
                    $exists:
                      false,
                  },
                },
                {
                  centre: null,
                },
              ],
            },
            {
              $set: {
                centre:
                  marrakech._id,
              },
            }
          ),
        ]);

        // 4) Replace old global unique indexes by per-centre indexes.
        await dropLegacySingleFieldUniqueIndex(
          Gasoil,
          "numeroBon"
        );

        await dropLegacySingleFieldUniqueIndex(
          Avance,
          "numeroCheque"
        );

        // 5) Sync current schema indexes.
        await Promise.all([
          Centre.syncIndexes(),
          User.syncIndexes(),
          Gasoil.syncIndexes(),
          Avance.syncIndexes(),
        ]);

        console.log(
          "✅ Architecture multi-centre initialisée"
        );
      })().catch(
        (error) => {
          bootstrapPromise =
            null;
          throw error;
        }
      );

    return bootstrapPromise;
  };

const connectDatabase =
  async () => {
    if (
      mongoose.connection
        .readyState === 1
    ) {
      await bootstrapMultiCentre();
      return;
    }

    if (
      !mongoConnectionPromise
    ) {
      mongoConnectionPromise =
        mongoose
          .connect(MONGO_URI)
          .then(
            async () => {
              console.log(
                "✅ MongoDB connecté"
              );

              await bootstrapMultiCentre();
            }
          )
          .catch(
            (error) => {
              mongoConnectionPromise =
                null;

              console.error(
                "❌ Erreur connexion MongoDB :",
                error.message
              );

              throw error;
            }
          );
    }

    return mongoConnectionPromise;
  };

// ==========================================================
// CORS
// ==========================================================

const allowedOrigins = [
  "http://localhost:5173",
  "https://gasoil-autocar-hazel.vercel.app",
  process.env.FRONTEND_URL,
].filter(Boolean);

const isAllowedOrigin = (
  origin
) => {
  if (!origin) {
    return true;
  }

  if (
    allowedOrigins.includes(
      origin
    )
  ) {
    return true;
  }

  try {
    const url =
      new URL(origin);

    if (
      url.protocol ===
        "https:" &&
      url.hostname.endsWith(
        ".vercel.app"
      )
    ) {
      return true;
    }
  } catch (error) {
    return false;
  }

  return false;
};

app.use(
  cors({
    origin(
      origin,
      callback
    ) {
      if (
        isAllowedOrigin(
          origin
        )
      ) {
        return callback(
          null,
          true
        );
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

app.use(
  async (
    req,
    res,
    next
  ) => {
    try {
      await connectDatabase();
      next();
    } catch (error) {
      res.status(500).json({
        message:
          "Impossible de se connecter à MongoDB.",
      });
    }
  }
);

// ==========================================================
// TEMPORARY LOCAL UPLOADS
// ==========================================================

const uploadsDirectory =
  process.env.VERCEL ===
  "1"
    ? path.join(
        "/tmp",
        "uploads"
      )
    : path.join(
        __dirname,
        "uploads"
      );

app.use(
  "/uploads",
  express.static(
    uploadsDirectory
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
  "/api/centres",
  authMiddleware,
  centreRoutes
);

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
      app:
        "SUIVI GASOIL AUTOCAR",
      mode:
        "MULTI_CENTRE",
      mongodb:
        mongoose.connection
          .readyState === 1
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

app.get(
  "/",
  (req, res) => {
    res.send(
      "🚌 SUIVI GASOIL AUTOCAR API - MULTI CENTRE"
    );
  }
);

// ==========================================================
// ERROR HANDLER
// ==========================================================

app.use(
  (
    error,
    req,
    res,
    next
  ) => {
    console.error(
      "❌ Erreur serveur :",
      error
    );

    if (
      res.headersSent
    ) {
      return next(error);
    }

    res.status(500).json({
      message:
        error?.message ||
        "Erreur interne du serveur.",
    });
  }
);

// ==========================================================
// LOCAL DEVELOPMENT
// ==========================================================

if (
  require.main === module
) {
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
            "🚌 SUIVI GASOIL AUTOCAR - MULTI CENTRE"
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
    .catch(
      (error) => {
        console.error(
          "❌ Démarrage impossible :",
          error.message
        );
      }
    );
}

// ==========================================================
// VERCEL / MODULE EXPORT
// ==========================================================

module.exports = app;
