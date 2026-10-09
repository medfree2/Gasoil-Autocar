const express = require("express");
const mongoose = require("mongoose");

const Centre = require("../models/Centre");
const User = require("../models/User");
const Gasoil = require("../models/Gasoil");
const Avance = require("../models/Avance");

const router = express.Router();

const isSuperAdmin = (req) => req.user?.role === "SUPER_ADMIN";

router.get("/", async (req, res) => {
  try {
    let filter = {};

    if (!isSuperAdmin(req)) {
      if (!req.user?.centre) {
        return res.status(403).json({
          message: "Aucun centre n'est associé à votre compte.",
        });
      }

      filter = {
        _id: req.user.centre,
        active: true,
      };
    }

    const centres = await Centre.find(filter).sort({ name: 1 }).lean();

    const centresWithStats = await Promise.all(
      centres.map(async (centre) => {
        const centreId = centre._id;

        const [
          usersCount,
          bonsCount,
          gasoilStats,
          avancesCount,
        ] = await Promise.all([
          User.countDocuments({ centre: centreId }),
          Gasoil.countDocuments({ centre: centreId }),
          Gasoil.aggregate([
            {
              $match: {
                centre: new mongoose.Types.ObjectId(centreId),
              },
            },
            {
              $group: {
                _id: null,
                litres: { $sum: "$quantite" },
                montant: { $sum: "$prixTotal" },
              },
            },
          ]),
          Avance.countDocuments({ centre: centreId }),
        ]);

        return {
          ...centre,
          stats: {
            usersCount,
            bonsCount,
            litres: gasoilStats[0]?.litres || 0,
            montant: gasoilStats[0]?.montant || 0,
            avancesCount,
          },
        };
      })
    );

    return res.json(centresWithStats);
  } catch (error) {
    console.error("GET /api/centres:", error);
    return res.status(500).json({
      message: "Erreur lors du chargement des centres.",
    });
  }
});

router.post("/", async (req, res) => {
  try {
    if (!isSuperAdmin(req)) {
      return res.status(403).json({
        message: "Accès réservé au SUPER_ADMIN.",
      });
    }

    const name = String(req.body.name || "").trim();
    const code = String(req.body.code || "").trim().toUpperCase();

    if (!name || !code) {
      return res.status(400).json({
        message: "Le nom et le code du centre sont obligatoires.",
      });
    }

    const existing = await Centre.findOne({
      $or: [
        { name: { $regex: `^${escapeRegex(name)}$`, $options: "i" } },
        { code },
      ],
    });

    if (existing) {
      return res.status(409).json({
        message: "Un centre avec ce nom ou ce code existe déjà.",
      });
    }

    const centre = await Centre.create({
      name,
      code,
      active: req.body.active !== false,
    });

    return res.status(201).json(centre);
  } catch (error) {
    console.error("POST /api/centres:", error);

    if (error?.code === 11000) {
      return res.status(409).json({
        message: "Un centre avec ce nom ou ce code existe déjà.",
      });
    }

    return res.status(500).json({
      message: "Erreur lors de la création du centre.",
    });
  }
});

router.put("/:id", async (req, res) => {
  try {
    if (!isSuperAdmin(req)) {
      return res.status(403).json({
        message: "Accès réservé au SUPER_ADMIN.",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        message: "Identifiant du centre invalide.",
      });
    }

    const centre = await Centre.findById(req.params.id);

    if (!centre) {
      return res.status(404).json({
        message: "Centre introuvable.",
      });
    }

    if (req.body.name !== undefined) {
      const name = String(req.body.name || "").trim();

      if (!name) {
        return res.status(400).json({
          message: "Le nom du centre est obligatoire.",
        });
      }

      centre.name = name;
    }

    if (req.body.code !== undefined) {
      const code = String(req.body.code || "").trim().toUpperCase();

      if (!code) {
        return res.status(400).json({
          message: "Le code du centre est obligatoire.",
        });
      }

      centre.code = code;
    }

    if (req.body.active !== undefined) {
      centre.active = Boolean(req.body.active);
    }

    await centre.save();

    return res.json(centre);
  } catch (error) {
    console.error("PUT /api/centres/:id:", error);

    if (error?.code === 11000) {
      return res.status(409).json({
        message: "Un centre avec ce nom ou ce code existe déjà.",
      });
    }

    return res.status(500).json({
      message: "Erreur lors de la modification du centre.",
    });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    if (!isSuperAdmin(req)) {
      return res.status(403).json({
        message: "Accès réservé au SUPER_ADMIN.",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        message: "Identifiant du centre invalide.",
      });
    }

    const centre = await Centre.findById(req.params.id);

    if (!centre) {
      return res.status(404).json({
        message: "Centre introuvable.",
      });
    }

    const [usersCount, bonsCount, avancesCount] = await Promise.all([
      User.countDocuments({ centre: centre._id }),
      Gasoil.countDocuments({ centre: centre._id }),
      Avance.countDocuments({ centre: centre._id }),
    ]);

    if (usersCount > 0 || bonsCount > 0 || avancesCount > 0) {
      return res.status(409).json({
        message:
          "Ce centre contient déjà des utilisateurs ou des données. Désactivez-le au lieu de le supprimer.",
      });
    }

    await centre.deleteOne();

    return res.json({
      message: "Centre supprimé avec succès.",
    });
  } catch (error) {
    console.error("DELETE /api/centres/:id:", error);
    return res.status(500).json({
      message: "Erreur lors de la suppression du centre.",
    });
  }
});

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = router;
