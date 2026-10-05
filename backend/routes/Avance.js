const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const Avance = require("../models/Avance");
const Gasoil = require("../models/Gasoil");

const router = express.Router();

const uploadDir =
  process.env.VERCEL === "1"
    ? path.join("/tmp", "uploads")
    : path.join(__dirname, "../uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, {
    recursive: true,
  });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },

  filename: function (req, file, cb) {
    const uniqueName =
      `cheque-${Date.now()}-` +
      Math.round(Math.random() * 1e9) +
      path.extname(file.originalname);

    cb(null, uniqueName);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Seules les images JPG, PNG et WEBP sont autorisées."
      )
    );
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

const getAvanceDetails = async (avance) => {
  const result = await Gasoil.aggregate([
    {
      $match: {
        avance: avance._id,
      },
    },
    {
      $group: {
        _id: null,
        consomme: {
          $sum: "$prixTotal",
        },
        litres: {
          $sum: "$quantite",
        },
        nombreBons: {
          $sum: 1,
        },
      },
    },
  ]);

  const stats = result[0] || {
    consomme: 0,
    litres: 0,
    nombreBons: 0,
  };

  const consomme = Number(stats.consomme || 0);

  const solde = Math.max(
    Number(avance.montant) - consomme,
    0
  );

  const pourcentage =
    Number(avance.montant) > 0
      ? (consomme / Number(avance.montant)) * 100
      : 0;

  return {
    ...avance.toObject(),
    consomme,
    solde,
    pourcentage,
    litres: Number(stats.litres || 0),
    nombreBons: Number(stats.nombreBons || 0),
  };
};

// ==========================================================
// GET ALL
// ==========================================================

router.get("/", async (req, res) => {
  try {
    const avances = await Avance.find().sort({
      date: -1,
      createdAt: -1,
    });

    const result = [];

    for (const avance of avances) {
      result.push(
        await getAvanceDetails(avance)
      );
    }

    res.json(result);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message:
        "Erreur lors du chargement des avances.",
    });
  }
});

// ==========================================================
// GET ACTIVE
// ==========================================================

router.get("/active", async (req, res) => {
  try {
    const avance = await Avance.findOne({
      statut: "ACTIVE",
    }).sort({
      createdAt: -1,
    });

    if (!avance) {
      return res.json(null);
    }

    const result =
      await getAvanceDetails(avance);

    res.json(result);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message:
        "Erreur lors du chargement de l'avance active.",
    });
  }
});

// ==========================================================
// CREATE NEW ADVANCE
// ==========================================================

router.post(
  "/",
  upload.single("imageCheque"),
  async (req, res) => {
    try {
      const {
        date,
        montant,
        numeroCheque,
        station,
        banque,
        observation,
      } = req.body;

      if (
        !date ||
        !montant ||
        !numeroCheque ||
        !station
      ) {
        if (
          req.file &&
          fs.existsSync(req.file.path)
        ) {
          fs.unlinkSync(req.file.path);
        }

        return res.status(400).json({
          message:
            "Date, montant, numéro de chèque et station sont obligatoires.",
        });
      }

      const montantNumber =
        Number(montant);

      if (
        Number.isNaN(montantNumber) ||
        montantNumber <= 0
      ) {
        if (
          req.file &&
          fs.existsSync(req.file.path)
        ) {
          fs.unlinkSync(req.file.path);
        }

        return res.status(400).json({
          message:
            "Le montant de l'avance est invalide.",
        });
      }

      const duplicate =
        await Avance.findOne({
          numeroCheque:
            numeroCheque.trim(),
        });

      if (duplicate) {
        if (
          req.file &&
          fs.existsSync(req.file.path)
        ) {
          fs.unlinkSync(req.file.path);
        }

        return res.status(409).json({
          message:
            "Ce numéro de chèque existe déjà.",
        });
      }

      // Close any previous active advance
      await Avance.updateMany(
        {
          statut: "ACTIVE",
        },
        {
          $set: {
            statut: "CLOTUREE",
          },
        }
      );

      const avance = new Avance({
        date,
        montant: montantNumber,
        numeroCheque:
          numeroCheque.trim(),
        station: station.trim(),
        banque:
          banque?.trim() || "",
        observation:
          observation?.trim() || "",
        imageCheque: req.file
          ? `/uploads/${req.file.filename}`
          : "",
        statut: "ACTIVE",
      });

      await avance.save();

      const result =
        await getAvanceDetails(avance);

      res.status(201).json(result);
    } catch (error) {
      console.error(error);

      if (
        req.file &&
        fs.existsSync(req.file.path)
      ) {
        try {
          fs.unlinkSync(req.file.path);
        } catch {}
      }

      if (error.code === 11000) {
        return res.status(409).json({
          message:
            "Ce numéro de chèque existe déjà.",
        });
      }

      res.status(500).json({
        message:
          "Erreur lors de l'enregistrement de l'avance.",
      });
    }
  }
);

module.exports = router;