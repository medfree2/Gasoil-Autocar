const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const Gasoil = require("../models/Gasoil");
const Avance = require("../models/Avance");

const router = express.Router();

const uploadDir = path.join(
  __dirname,
  "../uploads"
);

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, {
    recursive: true,
  });
}

const storage = multer.diskStorage({
  destination: function (
    req,
    file,
    cb
  ) {
    cb(null, uploadDir);
  },

  filename: function (
    req,
    file,
    cb
  ) {
    const uniqueName =
      `bon-${Date.now()}-` +
      Math.round(
        Math.random() * 1e9
      ) +
      path.extname(
        file.originalname
      );

    cb(null, uniqueName);
  },
});

const fileFilter = (
  req,
  file,
  cb
) => {
  const allowedTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
  ];

  if (
    allowedTypes.includes(
      file.mimetype
    )
  ) {
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
    fileSize:
      10 * 1024 * 1024,
  },
});

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
        if (
          req.file &&
          fs.existsSync(req.file.path)
        ) {
          fs.unlinkSync(
            req.file.path
          );
        }

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
        if (
          req.file &&
          fs.existsSync(req.file.path)
        ) {
          fs.unlinkSync(
            req.file.path
          );
        }

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
        if (
          req.file &&
          fs.existsSync(req.file.path)
        ) {
          fs.unlinkSync(
            req.file.path
          );
        }

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
        if (
          req.file &&
          fs.existsSync(req.file.path)
        ) {
          fs.unlinkSync(
            req.file.path
          );
        }

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
        if (
          req.file &&
          fs.existsSync(req.file.path)
        ) {
          fs.unlinkSync(
            req.file.path
          );
        }

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
            req.file
              ? `/uploads/${req.file.filename}`
              : "",

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

      if (
        req.file &&
        fs.existsSync(req.file.path)
      ) {
        try {
          fs.unlinkSync(
            req.file.path
          );
        } catch {}
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
    try {
      const gasoil =
        await Gasoil.findById(
          req.params.id
        );

      if (!gasoil) {
        if (
          req.file &&
          fs.existsSync(req.file.path)
        ) {
          fs.unlinkSync(
            req.file.path
          );
        }

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
        if (
          req.file &&
          fs.existsSync(req.file.path)
        ) {
          fs.unlinkSync(
            req.file.path
          );
        }

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
        if (
          req.file &&
          fs.existsSync(req.file.path)
        ) {
          fs.unlinkSync(
            req.file.path
          );
        }

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
        if (
          req.file &&
          fs.existsSync(req.file.path)
        ) {
          fs.unlinkSync(
            req.file.path
          );
        }

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
        if (
          req.file &&
          fs.existsSync(req.file.path)
        ) {
          fs.unlinkSync(
            req.file.path
          );
        }

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
        if (
          req.file &&
          fs.existsSync(req.file.path)
        ) {
          fs.unlinkSync(
            req.file.path
          );
        }

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

      const oldImagePath =
        gasoil.imageBon
          ? path.join(
              uploadDir,
              path.basename(
                gasoil.imageBon
              )
            )
          : null;

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

      if (req.file) {
        gasoil.imageBon =
          `/uploads/${req.file.filename}`;
      }

      await gasoil.save();

      if (
        req.file &&
        oldImagePath &&
        fs.existsSync(
          oldImagePath
        )
      ) {
        fs.unlinkSync(
          oldImagePath
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

      if (
        req.file &&
        fs.existsSync(req.file.path)
      ) {
        try {
          fs.unlinkSync(
            req.file.path
          );
        } catch {}
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

      if (gasoil.imageBon) {
        const fileName =
          path.basename(
            gasoil.imageBon
          );

        const imagePath =
          path.join(
            uploadDir,
            fileName
          );

        if (
          fs.existsSync(
            imagePath
          )
        ) {
          fs.unlinkSync(
            imagePath
          );
        }
      }

      await gasoil.deleteOne();

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
