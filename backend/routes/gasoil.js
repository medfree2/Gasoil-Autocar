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

const Gasoil = require("../models/Gasoil");
const Avance = require("../models/Avance");

const router = express.Router();

const getRemainingBalance =
  async (
    avance,
    excludeGasoilId = null
  ) => {
    const match = {
      avance: avance._id,
    };

    if (excludeGasoilId) {
      match._id = {
        $ne:
          excludeGasoilId,
      };
    }

    const result =
      await Gasoil.aggregate([
        {
          $match: match,
        },
        {
          $group: {
            _id: null,
            total: {
              $sum: "$prixTotal",
            },
          },
        },
      ]);

    const used =
      Number(
        result[0]?.total || 0
      );

    return {
      used,
      remaining:
        Number(avance.montant) -
        used,
    };
  };

// ==========================================================
// GET ALL
// ==========================================================

router.get(
  "/",
  async (req, res) => {
    try {
      const gasoils =
        await Gasoil.find()
          .populate(
            "avance",
            "numeroCheque montant station statut"
          )
          .sort({
            date: -1,
            createdAt: -1,
          });

      res.json(gasoils);
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message:
          "Erreur lors du chargement des données.",
      });
    }
  }
);

// ==========================================================
// GET ONE
// ==========================================================

router.get(
  "/:id",
  async (req, res) => {
    try {
      const gasoil =
        await Gasoil.findById(
          req.params.id
        ).populate(
          "avance",
          "numeroCheque montant station statut"
        );

      if (!gasoil) {
        return res.status(404).json({
          message:
            "Enregistrement introuvable.",
        });
      }

      res.json(gasoil);
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message:
          "Erreur serveur.",
      });
    }
  }
);

// ==========================================================
// CREATE
// ==========================================================

router.post(
  "/",
  upload.single("imageBon"),
  async (req, res) => {
    let uploadedImageUrl = "";

    try {
      const {
        date,
        autocar,
        depart,
        quantite,
        numeroBon,
        prixTotal,
        observation,
      } = req.body;

      if (
        !date ||
        !autocar ||
        !depart ||
        !quantite ||
        !numeroBon ||
        !prixTotal
      ) {
        return res.status(400).json({
          message:
            "Veuillez remplir tous les champs obligatoires.",
        });
      }

      const duplicate =
        await Gasoil.findOne({
          numeroBon:
            numeroBon.trim(),
        });

      if (duplicate) {
        return res.status(409).json({
          message:
            "Ce numéro de bon existe déjà.",
        });
      }

      const avance =
        await Avance.findOne({
          statut: "ACTIVE",
        }).sort({
          createdAt: -1,
        });

      if (!avance) {
        return res.status(400).json({
          code:
            "NO_ACTIVE_ADVANCE",

          message:
            "Aucune avance active. Ajoutez d'abord un nouveau chèque d'avance.",
        });
      }

      const quantiteNumber =
        Number(quantite);

      const prixTotalNumber =
        Number(prixTotal);

      if (
        !Number.isFinite(
          quantiteNumber
        ) ||
        quantiteNumber <= 0 ||
        !Number.isFinite(
          prixTotalNumber
        ) ||
        prixTotalNumber <= 0
      ) {
        return res.status(400).json({
          message:
            "Quantité ou prix invalide.",
        });
      }

      const {
        remaining,
      } =
        await getRemainingBalance(
          avance
        );

      if (
        prixTotalNumber >
        remaining
      ) {
        return res.status(409).json({
          code:
            "INSUFFICIENT_ADVANCE",

          message:
            "Solde de l'avance insuffisant.",

          solde:
            Math.max(
              remaining,
              0
            ),

          montantBon:
            prixTotalNumber,

          manque:
            prixTotalNumber -
            Math.max(
              remaining,
              0
            ),
        });
      }

      if (req.file) {
        const uploadResult =
          await uploadImageToCloudinary(
            req.file,
            "suivi-gasoil/bons"
          );

        uploadedImageUrl =
          uploadResult.secure_url;
      }

      const gasoil =
        new Gasoil({
          date,

          autocar:
            autocar.trim(),

          depart:
            depart.trim(),

          quantite:
            quantiteNumber,

          numeroBon:
            numeroBon.trim(),

          prixTotal:
            Number(
              prixTotalNumber.toFixed(
                2
              )
            ),

          observation:
            observation?.trim() ||
            "",

          imageBon:
            uploadedImageUrl,

          avance:
            avance._id,
        });

      await gasoil.save();

      const balanceAfter =
        remaining -
        prixTotalNumber;

      if (
        balanceAfter <= 0
      ) {
        avance.statut =
          "CLOTUREE";

        await avance.save();
      }

      const populated =
        await gasoil.populate(
          "avance",
          "numeroCheque montant station statut"
        );

      res.status(201).json(
        populated
      );
    } catch (error) {
      console.error(error);

      if (uploadedImageUrl) {
        await deleteCloudinaryImage(
          uploadedImageUrl
        );
      }

      if (
        error.code === 11000
      ) {
        return res.status(409).json({
          message:
            "Ce numéro de bon existe déjà.",
        });
      }

      res.status(500).json({
        message:
          "Erreur lors de l'enregistrement du bon.",
      });
    }
  }
);

// ==========================================================
// UPDATE
// ==========================================================

router.put(
  "/:id",
  upload.single("imageBon"),
  async (req, res) => {
    let newImageUrl = "";

    try {
      const gasoil =
        await Gasoil.findById(
          req.params.id
        );

      if (!gasoil) {
        return res.status(404).json({
          message:
            "Enregistrement introuvable.",
        });
      }

      const {
        date,
        autocar,
        depart,
        quantite,
        numeroBon,
        prixTotal,
        observation,
      } = req.body;

      if (
        !date ||
        !autocar ||
        !depart ||
        !quantite ||
        !numeroBon ||
        !prixTotal
      ) {
        return res.status(400).json({
          message:
            "Veuillez remplir tous les champs obligatoires.",
        });
      }

      const duplicate =
        await Gasoil.findOne({
          numeroBon:
            numeroBon.trim(),

          _id: {
            $ne:
              gasoil._id,
          },
        });

      if (duplicate) {
        return res.status(409).json({
          message:
            "Ce numéro de bon existe déjà.",
        });
      }

      const quantiteNumber =
        Number(quantite);

      const prixTotalNumber =
        Number(prixTotal);

      if (
        !Number.isFinite(
          quantiteNumber
        ) ||
        quantiteNumber <= 0 ||
        !Number.isFinite(
          prixTotalNumber
        ) ||
        prixTotalNumber <= 0
      ) {
        return res.status(400).json({
          message:
            "Quantité ou prix invalide.",
        });
      }

      const avance =
        await Avance.findById(
          gasoil.avance
        );

      if (!avance) {
        return res.status(400).json({
          message:
            "L'avance associée à ce bon est introuvable.",
        });
      }

      const {
        remaining,
      } =
        await getRemainingBalance(
          avance,
          gasoil._id
        );

      if (
        prixTotalNumber >
        remaining
      ) {
        return res.status(409).json({
          code:
            "INSUFFICIENT_ADVANCE",

          message:
            "Le nouveau prix dépasse le montant disponible sur l'avance de ce bon.",

          solde:
            Math.max(
              remaining,
              0
            ),

          montantBon:
            prixTotalNumber,

          manque:
            prixTotalNumber -
            Math.max(
              remaining,
              0
            ),
        });
      }

      const oldImageUrl =
        gasoil.imageBon || "";

      if (req.file) {
        const uploadResult =
          await uploadImageToCloudinary(
            req.file,
            "suivi-gasoil/bons"
          );

        newImageUrl =
          uploadResult.secure_url;
      }

      gasoil.date =
        date;

      gasoil.autocar =
        autocar.trim();

      gasoil.depart =
        depart.trim();

      gasoil.quantite =
        quantiteNumber;

      gasoil.numeroBon =
        numeroBon.trim();

      gasoil.prixTotal =
        Number(
          prixTotalNumber.toFixed(
            2
          )
        );

      gasoil.observation =
        observation?.trim() ||
        "";

      if (newImageUrl) {
        gasoil.imageBon =
          newImageUrl;
      }

      await gasoil.save();

      if (
        newImageUrl &&
        oldImageUrl
      ) {
        await deleteCloudinaryImage(
          oldImageUrl
        );
      }

      const populated =
        await gasoil.populate(
          "avance",
          "numeroCheque montant station statut"
        );

      res.json(populated);
    } catch (error) {
      console.error(error);

      if (newImageUrl) {
        await deleteCloudinaryImage(
          newImageUrl
        );
      }

      if (
        error.code === 11000
      ) {
        return res.status(409).json({
          message:
            "Ce numéro de bon existe déjà.",
        });
      }

      res.status(500).json({
        message:
          "Erreur lors de la modification du bon.",
      });
    }
  }
);

// ==========================================================
// DELETE
// ==========================================================

router.delete(
  "/:id",
  async (req, res) => {
    try {
      const gasoil =
        await Gasoil.findById(
          req.params.id
        );

      if (!gasoil) {
        return res.status(404).json({
          message:
            "Enregistrement introuvable.",
        });
      }

      const avance =
        await Avance.findById(
          gasoil.avance
        );

      const imageToDelete =
        gasoil.imageBon || "";

      await gasoil.deleteOne();

      if (imageToDelete) {
        await deleteCloudinaryImage(
          imageToDelete
        );
      }

      if (
        avance &&
        avance.statut ===
          "CLOTUREE"
      ) {
        const balance =
          await getRemainingBalance(
            avance
          );

        const activeAdvance =
          await Avance.findOne({
            statut: "ACTIVE",
          });

        if (
          balance.remaining > 0 &&
          !activeAdvance
        ) {
          avance.statut =
            "ACTIVE";

          await avance.save();
        }
      }

      res.json({
        message:
          "Bon supprimé.",
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message:
          "Erreur lors de la suppression.",
      });
    }
  }
);

module.exports = router;
