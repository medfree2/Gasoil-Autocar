const express = require("express");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;

const Gasoil = require("../models/Gasoil");
const Avance = require("../models/Avance");
const User = require("../models/User");
const Centre = require("../models/Centre");

cloudinary.config({
  cloud_name:
    process.env.CLOUDINARY_CLOUD_NAME,
  api_key:
    process.env.CLOUDINARY_API_KEY,
  api_secret:
    process.env.CLOUDINARY_API_SECRET,
});

const router = express.Router();

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
  storage:
    multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize:
      10 * 1024 * 1024,
  },
});

const uploadImageToCloudinary = (
  file,
  folder
) =>
  new Promise(
    (resolve, reject) => {
      ensureCloudinaryConfig();

      const stream =
        cloudinary.uploader.upload_stream(
          {
            folder,
            resource_type:
              "image",
            use_filename:
              false,
            unique_filename:
              true,
            overwrite:
              false,
            transformation: [
              {
                width: 1800,
                height: 1800,
                crop: "limit",
                quality:
                  "auto:good",
              },
            ],
          },
          (
            error,
            result
          ) => {
            if (error) {
              reject(error);
              return;
            }

            resolve(result);
          }
        );

      stream.end(
        file.buffer
      );
    }
  );

const getCloudinaryPublicId = (
  imageUrl
) => {
  if (!imageUrl) {
    return null;
  }

  try {
    const parsed =
      new URL(imageUrl);

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
      parts.indexOf(
        "upload"
      );

    if (
      uploadIndex === -1
    ) {
      return null;
    }

    const publicParts =
      parts.slice(
        uploadIndex + 1
      );

    if (
      publicParts[0] &&
      /^v\d+$/.test(
        publicParts[0]
      )
    ) {
      publicParts.shift();
    }

    if (
      !publicParts.length
    ) {
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
    getCloudinaryPublicId(
      imageUrl
    );

  if (!publicId) {
    return;
  }

  try {
    ensureCloudinaryConfig();

    await cloudinary.uploader.destroy(
      publicId,
      {
        resource_type:
          "image",
      }
    );
  } catch (error) {
    console.error(
      "⚠️ Suppression Cloudinary impossible :",
      error.message
    );
  }
};

const getCurrentUser = async (
  req
) => {
  if (!req.user?.id) {
    return null;
  }

  return User.findById(
    req.user.id
  ).populate(
    "centre",
    "name code active"
  );
};

const getActionUserSnapshot = async (
  req,
  currentUser = null
) => {
  const user =
    currentUser ||
    (await getCurrentUser(
      req
    ));

  if (!user) {
    return {
      userId:
        req.user?.id ||
        null,
      name:
        req.user?.name ||
        "",
      matricule:
        req.user?.matricule ||
        "",
      email:
        req.user?.email ||
        "",
    };
  }

  return {
    userId: user._id,
    name: user.name || "",
    matricule:
      user.matricule || "",
    email:
      user.email || "",
  };
};

const getRequestedCentreId = (
  req,
  currentUser,
  {
    requiredForSuperAdmin =
      false,
    bodyFirst = false,
  } = {}
) => {
  if (
    currentUser.role !==
    "SUPER_ADMIN"
  ) {
    return String(
      currentUser.centre?._id ||
        currentUser.centre ||
        ""
    );
  }

  const queryCentre =
    req.query?.centre;

  const bodyCentre =
    req.body?.centre;

  const requested =
    bodyFirst
      ? bodyCentre ||
        queryCentre
      : queryCentre ||
        bodyCentre;

  if (
    requested &&
    requested !== "all"
  ) {
    return String(requested);
  }

  if (
    requiredForSuperAdmin
  ) {
    return "";
  }

  return null;
};

const assertCentreAvailable = async (
  centreId
) => {
  if (!centreId) {
    return null;
  }

  const centre =
    await Centre.findById(
      centreId
    );

  if (
    !centre ||
    centre.active === false
  ) {
    return null;
  }

  return centre;
};

const canAccessRecord = (
  currentUser,
  record
) => {
  if (
    currentUser.role ===
    "SUPER_ADMIN"
  ) {
    return true;
  }

  return (
    String(record.centre) ===
    String(
      currentUser.centre?._id ||
        currentUser.centre
    )
  );
};

const getRemainingBalance =
  async (
    avance,
    excludeGasoilId = null
  ) => {
    const match = {
      avance: avance._id,
      centre: avance.centre,
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
              $sum:
                "$prixTotal",
            },
          },
        },
      ]);

    const used =
      Number(
        result[0]?.total ||
          0
      );

    return {
      used,
      remaining:
        Number(
          avance.montant
        ) - used,
    };
  };

// ==========================================================
// GET ALL
// ==========================================================

router.get(
  "/",
  async (req, res) => {
    try {
      const currentUser =
        await getCurrentUser(
          req
        );

      if (
        !currentUser ||
        currentUser.active ===
          false
      ) {
        return res
          .status(401)
          .json({
            message:
              "Session utilisateur invalide.",
          });
      }

      const centreId =
        getRequestedCentreId(
          req,
          currentUser
        );

      const query = {};

      if (centreId) {
        query.centre =
          centreId;
      }

      const gasoils =
        await Gasoil.find(
          query
        )
          .populate(
            "avance",
            "numeroCheque montant station statut centre"
          )
          .populate(
            "centre",
            "name code active"
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
      const currentUser =
        await getCurrentUser(
          req
        );

      if (!currentUser) {
        return res
          .status(401)
          .json({
            message:
              "Session utilisateur invalide.",
          });
      }

      const gasoil =
        await Gasoil.findById(
          req.params.id
        )
          .populate(
            "avance",
            "numeroCheque montant station statut centre"
          )
          .populate(
            "centre",
            "name code active"
          );

      if (!gasoil) {
        return res
          .status(404)
          .json({
            message:
              "Enregistrement introuvable.",
          });
      }

      if (
        !canAccessRecord(
          currentUser,
          gasoil
        )
      ) {
        return res
          .status(403)
          .json({
            message:
              "Vous n'avez pas accès à ce bon.",
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
  upload.single(
    "imageBon"
  ),
  async (req, res) => {
    let uploadedImageUrl =
      "";

    try {
      const currentUser =
        await getCurrentUser(
          req
        );

      if (
        !currentUser ||
        currentUser.active ===
          false
      ) {
        return res
          .status(401)
          .json({
            message:
              "Session utilisateur invalide.",
          });
      }

      const centreId =
        getRequestedCentreId(
          req,
          currentUser,
          {
            requiredForSuperAdmin:
              true,
            bodyFirst: true,
          }
        );

      if (!centreId) {
        return res
          .status(400)
          .json({
            message:
              "Sélectionnez un centre avant d'ajouter un bon.",
          });
      }

      const centre =
        await assertCentreAvailable(
          centreId
        );

      if (!centre) {
        return res
          .status(400)
          .json({
            message:
              "Centre invalide ou désactivé.",
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
        return res
          .status(400)
          .json({
            message:
              "Veuillez remplir tous les champs obligatoires.",
          });
      }

      const duplicate =
        await Gasoil.findOne({
          centre:
            centre._id,
          numeroBon:
            String(
              numeroBon
            ).trim(),
        });

      if (duplicate) {
        return res
          .status(409)
          .json({
            message:
              "Ce numéro de bon existe déjà dans ce centre.",
          });
      }

      const avance =
        await Avance.findOne({
          centre:
            centre._id,
          statut:
            "ACTIVE",
        }).sort({
          createdAt: -1,
        });

      if (!avance) {
        return res
          .status(400)
          .json({
            code:
              "NO_ACTIVE_ADVANCE",
            message:
              "Aucune avance active pour ce centre. Ajoutez d'abord un nouveau chèque d'avance.",
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
        return res
          .status(400)
          .json({
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
        return res
          .status(409)
          .json({
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
            `suivi-gasoil/${centre.code.toLowerCase()}/bons`
          );

        uploadedImageUrl =
          uploadResult.secure_url;
      }

      const actor =
        await getActionUserSnapshot(
          req,
          currentUser
        );

      const gasoil =
        new Gasoil({
          centre:
            centre._id,
          date,
          autocar:
            String(
              autocar
            ).trim(),
          depart:
            String(
              depart
            ).trim(),
          quantite:
            quantiteNumber,
          numeroBon:
            String(
              numeroBon
            ).trim(),
          prixTotal:
            Number(
              prixTotalNumber.toFixed(
                2
              )
            ),
          observation:
            String(
              observation || ""
            ).trim(),
          imageBon:
            uploadedImageUrl,
          avance:
            avance._id,
          createdBy:
            actor.userId,
          createdByName:
            actor.name,
          createdByMatricule:
            actor.matricule,
          createdByEmail:
            actor.email,
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
        await Gasoil.findById(
          gasoil._id
        )
          .populate(
            "avance",
            "numeroCheque montant station statut centre"
          )
          .populate(
            "centre",
            "name code active"
          );

      res.status(201).json(
        populated
      );
    } catch (error) {
      console.error(error);

      if (
        uploadedImageUrl
      ) {
        await deleteCloudinaryImage(
          uploadedImageUrl
        );
      }

      if (
        error.code === 11000
      ) {
        return res
          .status(409)
          .json({
            message:
              "Ce numéro de bon existe déjà dans ce centre.",
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
  upload.single(
    "imageBon"
  ),
  async (req, res) => {
    let newImageUrl = "";

    try {
      const currentUser =
        await getCurrentUser(
          req
        );

      if (!currentUser) {
        return res
          .status(401)
          .json({
            message:
              "Session utilisateur invalide.",
          });
      }

      const gasoil =
        await Gasoil.findById(
          req.params.id
        );

      if (!gasoil) {
        return res
          .status(404)
          .json({
            message:
              "Enregistrement introuvable.",
          });
      }

      if (
        !canAccessRecord(
          currentUser,
          gasoil
        )
      ) {
        return res
          .status(403)
          .json({
            message:
              "Vous ne pouvez modifier que les bons de votre centre.",
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
        return res
          .status(400)
          .json({
            message:
              "Veuillez remplir tous les champs obligatoires.",
          });
      }

      const duplicate =
        await Gasoil.findOne({
          centre:
            gasoil.centre,
          numeroBon:
            String(
              numeroBon
            ).trim(),
          _id: {
            $ne:
              gasoil._id,
          },
        });

      if (duplicate) {
        return res
          .status(409)
          .json({
            message:
              "Ce numéro de bon existe déjà dans ce centre.",
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
        return res
          .status(400)
          .json({
            message:
              "Quantité ou prix invalide.",
          });
      }

      const avance =
        await Avance.findById(
          gasoil.avance
        );

      if (!avance) {
        return res
          .status(400)
          .json({
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
        return res
          .status(409)
          .json({
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
        const centre =
          await Centre.findById(
            gasoil.centre
          );

        const folderCode =
          centre?.code
            ?.toLowerCase() ||
          "centre";

        const uploadResult =
          await uploadImageToCloudinary(
            req.file,
            `suivi-gasoil/${folderCode}/bons`
          );

        newImageUrl =
          uploadResult.secure_url;
      }

      gasoil.date = date;

      gasoil.autocar =
        String(
          autocar
        ).trim();

      gasoil.depart =
        String(
          depart
        ).trim();

      gasoil.quantite =
        quantiteNumber;

      gasoil.numeroBon =
        String(
          numeroBon
        ).trim();

      gasoil.prixTotal =
        Number(
          prixTotalNumber.toFixed(
            2
          )
        );

      gasoil.observation =
        String(
          observation || ""
        ).trim();

      if (newImageUrl) {
        gasoil.imageBon =
          newImageUrl;
      }

      const actor =
        await getActionUserSnapshot(
          req,
          currentUser
        );

      gasoil.updatedBy =
        actor.userId;

      gasoil.updatedByName =
        actor.name;

      gasoil.updatedByMatricule =
        actor.matricule;

      gasoil.updatedByEmail =
        actor.email;

      gasoil.lastEditedAt =
        new Date();

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
        await Gasoil.findById(
          gasoil._id
        )
          .populate(
            "avance",
            "numeroCheque montant station statut centre"
          )
          .populate(
            "centre",
            "name code active"
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
        return res
          .status(409)
          .json({
            message:
              "Ce numéro de bon existe déjà dans ce centre.",
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
// ADMIN / SUPER_ADMIN -> any bon in scope
// USER -> only their own bon
// ==========================================================

router.delete(
  "/:id",
  async (req, res) => {
    try {
      const currentUser =
        await getCurrentUser(
          req
        );

      if (!currentUser) {
        return res
          .status(401)
          .json({
            message:
              "Session utilisateur invalide.",
          });
      }

      const gasoil =
        await Gasoil.findById(
          req.params.id
        );

      if (!gasoil) {
        return res
          .status(404)
          .json({
            message:
              "Enregistrement introuvable.",
          });
      }

      if (
        !canAccessRecord(
          currentUser,
          gasoil
        )
      ) {
        return res
          .status(403)
          .json({
            message:
              "Vous ne pouvez supprimer que les bons de votre centre.",
          });
      }

      if (
        currentUser.role ===
          "USER" &&
        String(
          gasoil.createdBy ||
            ""
        ) !==
          String(
            currentUser._id
          )
      ) {
        return res
          .status(403)
          .json({
            message:
              "Vous ne pouvez pas supprimer un bon créé par un autre utilisateur.",
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
            centre:
              avance.centre,
            statut:
              "ACTIVE",
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
