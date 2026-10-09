const express = require("express");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;

const Avance = require("../models/Avance");
const Gasoil = require("../models/Gasoil");
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

const getAvanceDetails = async (
  avance
) => {
  const avanceId = String(
    avance._id
  );

  const centreId =
    avance.centre?._id ||
    avance.centre;

  const bons =
    await Gasoil.find({
      centre: centreId,
      $or: [
        {
          "allocations.avance":
            avance._id,
        },
        {
          avance:
            avance._id,
        },
      ],
    })
      .select(
        "avance allocations prixTotal quantite"
      )
      .lean();

  let consomme = 0;
  let litres = 0;
  let nombreBons = 0;

  for (const bon of bons) {
    const allocations =
      Array.isArray(
        bon.allocations
      )
        ? bon.allocations
        : [];

    const matching =
      allocations.find(
        (item) =>
          String(
            item.avance
          ) === avanceId
      );

    let montantUtilise = 0;

    if (matching) {
      montantUtilise =
        Number(
          matching.montant ||
            0
        );
    } else if (
      allocations.length === 0 &&
      String(
        bon.avance || ""
      ) === avanceId
    ) {
      // Legacy bon created before multi-cheque allocation.
      montantUtilise =
        Number(
          bon.prixTotal || 0
        );
    }

    if (montantUtilise <= 0) {
      continue;
    }

    consomme +=
      montantUtilise;

    nombreBons += 1;

    const prixBon =
      Number(
        bon.prixTotal || 0
      );

    const quantiteBon =
      Number(
        bon.quantite || 0
      );

    if (prixBon > 0) {
      litres +=
        quantiteBon *
        (montantUtilise /
          prixBon);
    }
  }

  consomme =
    Number(
      consomme.toFixed(2)
    );

  litres =
    Number(
      litres.toFixed(2)
    );

  const solde = Math.max(
    Number(
      (
        Number(
          avance.montant
        ) - consomme
      ).toFixed(2)
    ),
    0
  );

  const pourcentage =
    Number(
      avance.montant
    ) > 0
      ? (consomme /
          Number(
            avance.montant
          )) *
        100
      : 0;

  const plain =
    avance.toObject();

  return {
    ...plain,
    consomme,
    solde,
    pourcentage,
    litres,
    nombreBons,
  };
};

const syncAvanceStatus = async (
  avance
) => {
  const details =
    await getAvanceDetails(
      avance
    );

  const expectedStatus =
    Number(details.solde) >
    0.005
      ? "ACTIVE"
      : "CLOTUREE";

  if (
    avance.statut !==
    expectedStatus
  ) {
    avance.statut =
      expectedStatus;

    await avance.save();
  }

  return {
    ...details,
    statut:
      expectedStatus,
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

      if (!currentUser) {
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

      const avances =
        await Avance.find(
          query
        )
          .populate(
            "centre",
            "name code active"
          )
          .sort({
            date: -1,
            createdAt: -1,
          });

      const result = [];

      for (
        const avance of avances
      ) {
        result.push(
          await syncAvanceStatus(
            avance
          )
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
  }
);

// ==========================================================
// GET ACTIVE FOR CURRENT / SELECTED CENTRE
// ==========================================================

router.get(
  "/active",
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

      const centreId =
        getRequestedCentreId(
          req,
          currentUser,
          {
            requiredForSuperAdmin:
              true,
          }
        );

      if (!centreId) {
        return res.json(null);
      }

      const avances =
        await Avance.find({
          centre: centreId,
        })
          .populate(
            "centre",
            "name code active"
          )
          .sort({
            date: 1,
            createdAt: 1,
          });

      let activeDetails = null;

      for (
        const avance of avances
      ) {
        const details =
          await syncAvanceStatus(
            avance
          );

        if (
          !activeDetails &&
          details.statut ===
            "ACTIVE"
        ) {
          activeDetails =
            details;
        }
      }

      res.json(
        activeDetails
      );
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message:
          "Erreur lors du chargement de l'avance active.",
      });
    }
  }
);

// ==========================================================
// CREATE NEW ADVANCE
// ==========================================================

router.post(
  "/",
  upload.single(
    "imageCheque"
  ),
  async (req, res) => {
    let uploadedImageUrl =
      "";

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

      if (
        currentUser.role ===
        "USER"
      ) {
        return res
          .status(403)
          .json({
            message:
              "Seuls les administrateurs peuvent créer une avance.",
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
              "Sélectionnez un centre avant de créer une avance.",
          });
      }

      const centre =
        await Centre.findById(
          centreId
        );

      if (
        !centre ||
        centre.active === false
      ) {
        return res
          .status(400)
          .json({
            message:
              "Centre invalide ou désactivé.",
          });
      }

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
        return res
          .status(400)
          .json({
            message:
              "Date, montant, numéro de chèque et station sont obligatoires.",
          });
      }

      const montantNumber =
        Number(montant);

      if (
        Number.isNaN(
          montantNumber
        ) ||
        montantNumber <= 0
      ) {
        return res
          .status(400)
          .json({
            message:
              "Le montant de l'avance est invalide.",
          });
      }

      const duplicate =
        await Avance.findOne({
          centre:
            centre._id,
          numeroCheque:
            String(
              numeroCheque
            ).trim(),
        });

      if (duplicate) {
        return res
          .status(409)
          .json({
            message:
              "Ce numéro de chèque existe déjà dans ce centre.",
          });
      }

      if (req.file) {
        const uploadResult =
          await uploadImageToCloudinary(
            req.file,
            `suivi-gasoil/${centre.code.toLowerCase()}/cheques`
          );

        uploadedImageUrl =
          uploadResult.secure_url;
      }

      const avance =
        new Avance({
          centre:
            centre._id,
          date,
          montant:
            montantNumber,
          numeroCheque:
            String(
              numeroCheque
            ).trim(),
          station:
            String(
              station
            ).trim(),
          banque:
            String(
              banque || ""
            ).trim(),
          observation:
            String(
              observation || ""
            ).trim(),
          imageCheque:
            uploadedImageUrl,
          statut:
            "ACTIVE",
        });

      await avance.save();

      await avance.populate(
        "centre",
        "name code active"
      );

      res.status(201).json(
        await getAvanceDetails(
          avance
        )
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
              "Ce numéro de chèque existe déjà dans ce centre.",
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
