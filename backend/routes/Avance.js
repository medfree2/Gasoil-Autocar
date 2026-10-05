const express = require("express");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const ensureCloudinaryConfig = () => {
  if (
    !process.env.CLOUDINARY_CLOUD_NAME ||
    !process.env.CLOUDINARY_API_KEY ||
    !process.env.CLOUDINARY_API_SECRET
  ) {
    throw new Error(
      "Configuration Cloudinary manquante."
    );
  }
};

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
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

const uploadImageToCloudinary = (
  file,
  folder
) =>
  new Promise((resolve, reject) => {
    ensureCloudinaryConfig();

    const stream =
      cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: "image",
          use_filename: false,
          unique_filename: true,
          overwrite: false,
        },
        (error, result) => {
          if (error) {
            reject(error);
            return;
          }

          resolve(result);
        }
      );

    stream.end(file.buffer);
  });

const getCloudinaryPublicId = (imageUrl) => {
  if (!imageUrl) {
    return null;
  }

  try {
    const parsed = new URL(imageUrl);

    if (
      !parsed.hostname.endsWith(
        "res.cloudinary.com"
      )
    ) {
      return null;
    }

    const parts =
      parsed.pathname
        .split("/")
        .filter(Boolean);

    const uploadIndex =
      parts.indexOf("upload");

    if (uploadIndex === -1) {
      return null;
    }

    const publicParts =
      parts.slice(uploadIndex + 1);

    if (
      publicParts[0] &&
      /^v\d+$/.test(publicParts[0])
    ) {
      publicParts.shift();
    }

    if (!publicParts.length) {
      return null;
    }

    const lastPart =
      publicParts.pop();

    const withoutExtension =
      lastPart.replace(
        /\.[^/.]+$/,
        ""
      );

    return [
      ...publicParts,
      withoutExtension,
    ].join("/");
  } catch {
    return null;
  }
};

const deleteCloudinaryImage = async (
  imageUrl
) => {
  const publicId =
    getCloudinaryPublicId(imageUrl);

  if (!publicId) {
    return;
  }

  try {
    ensureCloudinaryConfig();

    await cloudinary.uploader.destroy(
      publicId,
      {
        resource_type: "image",
      }
    );
  } catch (error) {
    console.error(
      "⚠️ Suppression Cloudinary impossible :",
      error.message
    );
  }
};

const Avance = require("../models/Avance");
const Gasoil = require("../models/Gasoil");

const router = express.Router();

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
    let uploadedImageUrl = "";

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
        return res.status(409).json({
          message:
            "Ce numéro de chèque existe déjà.",
        });
      }

      if (req.file) {
        const uploadResult =
          await uploadImageToCloudinary(
            req.file,
            "suivi-gasoil/cheques"
          );

        uploadedImageUrl =
          uploadResult.secure_url;
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
        imageCheque:
          uploadedImageUrl,
        statut: "ACTIVE",
      });

      await avance.save();

      const result =
        await getAvanceDetails(avance);

      res.status(201).json(result);
    } catch (error) {
      console.error(error);

      if (uploadedImageUrl) {
        await deleteCloudinaryImage(
          uploadedImageUrl
        );
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
