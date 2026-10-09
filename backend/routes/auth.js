const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("../models/User");
const Centre = require("../models/Centre");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

const centreIdOf = (centre) => {
  if (!centre) return null;

  return String(
    centre._id || centre
  );
};

const publicCentre = (centre) => {
  if (!centre) return null;

  if (
    typeof centre === "object" &&
    centre.name
  ) {
    return {
      id: centre._id,
      name: centre.name,
      code: centre.code,
      active: centre.active,
    };
  }

  return {
    id: centre,
  };
};

const createToken = (user) =>
  jwt.sign(
    {
      id: user._id.toString(),
      email: user.email || "",
      matricule:
        user.matricule || "",
      name: user.name || "",
      role: user.role,
      centre:
        centreIdOf(user.centre),
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
    }
  );

const publicUser = (user) => ({
  id: user._id,
  name: user.name || "",
  email: user.email || "",
  matricule:
    user.matricule || "",
  role: user.role,
  centre:
    publicCentre(user.centre),
  active: user.active,
  createdAt: user.createdAt,
});

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

const adminOnly = async (
  req,
  res,
  next
) => {
  try {
    const user =
      await getCurrentUser(req);

    if (
      !user ||
      user.active === false
    ) {
      return res.status(401).json({
        message:
          "Session utilisateur invalide.",
      });
    }

    if (
      ![
        "ADMIN",
        "SUPER_ADMIN",
      ].includes(user.role)
    ) {
      return res.status(403).json({
        message:
          "Accès réservé à l'administrateur.",
      });
    }

    req.currentUser = user;
    next();
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message:
        "Erreur lors de la vérification des autorisations.",
    });
  }
};

const getDefaultCentre = async () => {
  let centre =
    await Centre.findOne({
      code: "MRK",
    });

  if (!centre) {
    centre =
      await Centre.create({
        name: "Marrakech",
        code: "MRK",
        active: true,
      });
  }

  return centre;
};

// ==========================================================
// STATUS
// ==========================================================

router.get(
  "/status",
  async (req, res) => {
    try {
      const count =
        await User.countDocuments();

      res.json({
        setupRequired:
          count === 0,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message:
          "Erreur lors de la vérification de l'authentification.",
      });
    }
  }
);

// ==========================================================
// FIRST SUPER ADMIN SETUP
// ==========================================================

router.post(
  "/setup",
  async (req, res) => {
    try {
      const existingUsers =
        await User.countDocuments();

      if (
        existingUsers > 0
      ) {
        return res
          .status(403)
          .json({
            message:
              "La configuration initiale a déjà été effectuée.",
          });
      }

      const {
        name,
        email,
        password,
      } = req.body;

      if (
        !name ||
        !email ||
        !password
      ) {
        return res
          .status(400)
          .json({
            message:
              "Nom, e-mail et mot de passe sont obligatoires.",
          });
      }

      if (
        String(password).length <
        6
      ) {
        return res
          .status(400)
          .json({
            message:
              "Le mot de passe doit contenir au moins 6 caractères.",
          });
      }

      const centre =
        await getDefaultCentre();

      const normalizedEmail =
        String(email)
          .trim()
          .toLowerCase();

      const passwordHash =
        await bcrypt.hash(
          String(password),
          12
        );

      const user =
        await User.create({
          name: String(
            name
          ).trim(),
          email:
            normalizedEmail,
          passwordHash,
          role: "SUPER_ADMIN",
          centre: centre._id,
          active: true,
        });

      await user.populate(
        "centre",
        "name code active"
      );

      const token =
        createToken(user);

      res.status(201).json({
        token,
        user:
          publicUser(user),
      });
    } catch (error) {
      console.error(error);

      if (
        error.code === 11000
      ) {
        return res
          .status(409)
          .json({
            message:
              "Cet e-mail est déjà utilisé.",
          });
      }

      res.status(500).json({
        message:
          "Erreur lors de la création du compte super administrateur.",
      });
    }
  }
);

// ==========================================================
// LOGIN BY MATRICULE OR EMAIL
// ==========================================================

router.post(
  "/login",
  async (req, res) => {
    try {
      const {
        identifier,
        email,
        password,
      } = req.body;

      const rawIdentifier =
        String(
          identifier ||
            email ||
            ""
        ).trim();

      if (
        !rawIdentifier ||
        !password
      ) {
        return res
          .status(400)
          .json({
            message:
              "Matricule/e-mail et mot de passe sont obligatoires.",
          });
      }

      const user =
        await User.findOne({
          $or: [
            {
              email:
                rawIdentifier.toLowerCase(),
            },
            {
              matricule:
                rawIdentifier.toUpperCase(),
            },
          ],
        }).populate(
          "centre",
          "name code active"
        );

      if (!user) {
        return res
          .status(401)
          .json({
            message:
              "Matricule/e-mail ou mot de passe incorrect.",
          });
      }

      if (
        user.active === false
      ) {
        return res
          .status(403)
          .json({
            message:
              "Ce compte utilisateur est désactivé.",
          });
      }

      if (
        user.centre &&
        user.centre.active ===
          false &&
        user.role !==
          "SUPER_ADMIN"
      ) {
        return res
          .status(403)
          .json({
            message:
              "Votre centre est désactivé.",
          });
      }

      const validPassword =
        await bcrypt.compare(
          String(password),
          user.passwordHash
        );

      if (!validPassword) {
        return res
          .status(401)
          .json({
            message:
              "Matricule/e-mail ou mot de passe incorrect.",
          });
      }

      const token =
        createToken(user);

      res.json({
        token,
        user:
          publicUser(user),
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message:
          "Erreur lors de la connexion.",
      });
    }
  }
);

// ==========================================================
// CURRENT USER
// ==========================================================

router.get(
  "/me",
  authMiddleware,
  async (req, res) => {
    try {
      const user =
        await User.findById(
          req.user.id
        )
          .select(
            "-passwordHash"
          )
          .populate(
            "centre",
            "name code active"
          );

      if (!user) {
        return res
          .status(404)
          .json({
            message:
              "Utilisateur introuvable.",
          });
      }

      if (
        user.active === false
      ) {
        return res
          .status(403)
          .json({
            message:
              "Ce compte utilisateur est désactivé.",
          });
      }

      res.json(
        publicUser(user)
      );
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message:
          "Erreur lors du chargement du profil.",
      });
    }
  }
);

// ==========================================================
// CURRENT USER - CHANGE OWN PASSWORD
// ==========================================================

router.put(
  "/change-password",
  authMiddleware,
  async (req, res) => {
    try {
      const {
        currentPassword,
        newPassword,
        confirmPassword,
      } = req.body;

      if (
        !currentPassword ||
        !newPassword ||
        !confirmPassword
      ) {
        return res
          .status(400)
          .json({
            message:
              "Mot de passe actuel, nouveau mot de passe et confirmation sont obligatoires.",
          });
      }

      if (
        String(newPassword)
          .length < 6
      ) {
        return res
          .status(400)
          .json({
            message:
              "Le nouveau mot de passe doit contenir au moins 6 caractères.",
          });
      }

      if (
        String(newPassword) !==
        String(confirmPassword)
      ) {
        return res
          .status(400)
          .json({
            message:
              "Les deux nouveaux mots de passe ne correspondent pas.",
          });
      }

      if (
        String(
          currentPassword
        ) ===
        String(newPassword)
      ) {
        return res
          .status(400)
          .json({
            message:
              "Le nouveau mot de passe doit être différent du mot de passe actuel.",
          });
      }

      const user =
        await User.findById(
          req.user.id
        );

      if (!user) {
        return res
          .status(404)
          .json({
            message:
              "Utilisateur introuvable.",
          });
      }

      const valid =
        await bcrypt.compare(
          String(
            currentPassword
          ),
          user.passwordHash
        );

      if (!valid) {
        return res
          .status(400)
          .json({
            message:
              "Le mot de passe actuel est incorrect.",
          });
      }

      user.passwordHash =
        await bcrypt.hash(
          String(newPassword),
          12
        );

      await user.save();

      res.json({
        message:
          "Mot de passe modifié avec succès.",
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message:
          "Erreur lors de la modification du mot de passe.",
      });
    }
  }
);

// ==========================================================
// ADMIN / SUPER_ADMIN - LIST USERS
// ==========================================================

router.get(
  "/users",
  authMiddleware,
  adminOnly,
  async (req, res) => {
    try {
      const current =
        req.currentUser;

      const query =
        current.role ===
        "SUPER_ADMIN"
          ? {}
          : {
              centre:
                current.centre?._id ||
                current.centre,
            };

      const users =
        await User.find(query)
          .select(
            "-passwordHash"
          )
          .populate(
            "centre",
            "name code active"
          )
          .sort({
            role: 1,
            createdAt: -1,
          });

      res.json(
        users.map(publicUser)
      );
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message:
          "Erreur lors du chargement des utilisateurs.",
      });
    }
  }
);

// ==========================================================
// ADMIN / SUPER_ADMIN - CREATE USER
// ==========================================================

router.post(
  "/users",
  authMiddleware,
  adminOnly,
  async (req, res) => {
    try {
      const current =
        req.currentUser;

      const {
        matricule,
        password,
        name,
        role,
        centre,
      } = req.body;

      if (
        !matricule ||
        !password
      ) {
        return res
          .status(400)
          .json({
            message:
              "Matricule et mot de passe sont obligatoires.",
          });
      }

      const normalizedMatricule =
        String(matricule)
          .trim()
          .toUpperCase();

      const normalizedRole =
        String(
          role || "USER"
        )
          .trim()
          .toUpperCase();

      if (
        ![
          "USER",
          "ADMIN",
          "SUPER_ADMIN",
        ].includes(
          normalizedRole
        )
      ) {
        return res
          .status(400)
          .json({
            message:
              "Rôle invalide.",
          });
      }

      if (
        current.role !==
          "SUPER_ADMIN" &&
        normalizedRole ===
          "SUPER_ADMIN"
      ) {
        return res
          .status(403)
          .json({
            message:
              "Seul un super administrateur peut créer un autre super administrateur.",
          });
      }

      if (
        String(password).length <
        6
      ) {
        return res
          .status(400)
          .json({
            message:
              "Le mot de passe doit contenir au moins 6 caractères.",
          });
      }

      const duplicate =
        await User.findOne({
          matricule:
            normalizedMatricule,
        });

      if (duplicate) {
        return res
          .status(409)
          .json({
            message:
              "Ce matricule existe déjà.",
          });
      }

      let centreId;

      if (
        current.role ===
        "SUPER_ADMIN"
      ) {
        centreId =
          centre ||
          current.centre?._id ||
          current.centre;
      } else {
        centreId =
          current.centre?._id ||
          current.centre;
      }

      const targetCentre =
        await Centre.findById(
          centreId
        );

      if (
        !targetCentre ||
        targetCentre.active ===
          false
      ) {
        return res
          .status(400)
          .json({
            message:
              "Centre invalide ou désactivé.",
          });
      }

      const passwordHash =
        await bcrypt.hash(
          String(password),
          12
        );

      const user =
        await User.create({
          matricule:
            normalizedMatricule,
          name: String(
            name || ""
          ).trim(),
          passwordHash,
          role:
            normalizedRole,
          centre:
            targetCentre._id,
          active: true,
        });

      await user.populate(
        "centre",
        "name code active"
      );

      res.status(201).json(
        publicUser(user)
      );
    } catch (error) {
      console.error(error);

      if (
        error.code === 11000
      ) {
        return res
          .status(409)
          .json({
            message:
              "Ce matricule existe déjà.",
          });
      }

      res.status(500).json({
        message:
          "Erreur lors de la création de l'utilisateur.",
      });
    }
  }
);

// ==========================================================
// ADMIN / SUPER_ADMIN - UPDATE USER
// ==========================================================

router.put(
  "/users/:id",
  authMiddleware,
  adminOnly,
  async (req, res) => {
    try {
      const current =
        req.currentUser;

      const user =
        await User.findById(
          req.params.id
        );

      if (!user) {
        return res
          .status(404)
          .json({
            message:
              "Utilisateur introuvable.",
          });
      }

      if (
        current.role !==
          "SUPER_ADMIN" &&
        String(user.centre) !==
          centreIdOf(
            current.centre
          )
      ) {
        return res
          .status(403)
          .json({
            message:
              "Vous ne pouvez gérer que les utilisateurs de votre centre.",
          });
      }

      if (
        current.role !==
          "SUPER_ADMIN" &&
        user.role ===
          "SUPER_ADMIN"
      ) {
        return res
          .status(403)
          .json({
            message:
              "Vous ne pouvez pas modifier un super administrateur.",
          });
      }

      const {
        matricule,
        name,
        password,
        role,
        centre,
      } = req.body;

      const normalizedMatricule =
        String(
          matricule ||
            user.matricule ||
            ""
        )
          .trim()
          .toUpperCase();

      const normalizedRole =
        String(
          role ||
            user.role ||
            "USER"
        )
          .trim()
          .toUpperCase();

      if (
        !normalizedMatricule
      ) {
        return res
          .status(400)
          .json({
            message:
              "Le matricule est obligatoire.",
          });
      }

      if (
        ![
          "USER",
          "ADMIN",
          "SUPER_ADMIN",
        ].includes(
          normalizedRole
        )
      ) {
        return res
          .status(400)
          .json({
            message:
              "Rôle invalide.",
          });
      }

      if (
        current.role !==
          "SUPER_ADMIN" &&
        normalizedRole ===
          "SUPER_ADMIN"
      ) {
        return res
          .status(403)
          .json({
            message:
              "Seul un super administrateur peut attribuer ce rôle.",
          });
      }

      if (
        String(current._id) ===
          String(user._id) &&
        normalizedRole !==
          user.role
      ) {
        return res
          .status(400)
          .json({
            message:
              "Vous ne pouvez pas modifier votre propre rôle.",
          });
      }

      const duplicate =
        await User.findOne({
          matricule:
            normalizedMatricule,
          _id: {
            $ne: user._id,
          },
        });

      if (duplicate) {
        return res
          .status(409)
          .json({
            message:
              "Ce matricule existe déjà.",
          });
      }

      let targetCentreId =
        user.centre;

      if (
        current.role ===
          "SUPER_ADMIN" &&
        centre
      ) {
        targetCentreId =
          centre;
      } else if (
        current.role !==
        "SUPER_ADMIN"
      ) {
        targetCentreId =
          current.centre?._id ||
          current.centre;
      }

      const targetCentre =
        await Centre.findById(
          targetCentreId
        );

      if (!targetCentre) {
        return res
          .status(400)
          .json({
            message:
              "Centre invalide.",
          });
      }

      user.matricule =
        normalizedMatricule;

      user.name =
        String(
          name || ""
        ).trim();

      user.role =
        normalizedRole;

      user.centre =
        targetCentre._id;

      if (
        password !== undefined &&
        String(password).length >
          0
      ) {
        if (
          String(password).length <
          6
        ) {
          return res
            .status(400)
            .json({
              message:
                "Le nouveau mot de passe doit contenir au moins 6 caractères.",
            });
        }

        user.passwordHash =
          await bcrypt.hash(
            String(password),
            12
          );
      }

      await user.save();

      await user.populate(
        "centre",
        "name code active"
      );

      res.json(
        publicUser(user)
      );
    } catch (error) {
      console.error(error);

      if (
        error.code === 11000
      ) {
        return res
          .status(409)
          .json({
            message:
              "Ce matricule existe déjà.",
          });
      }

      res.status(500).json({
        message:
          "Erreur lors de la modification de l'utilisateur.",
      });
    }
  }
);

// ==========================================================
// ADMIN / SUPER_ADMIN - DELETE USER
// ==========================================================

router.delete(
  "/users/:id",
  authMiddleware,
  adminOnly,
  async (req, res) => {
    try {
      const current =
        req.currentUser;

      if (
        String(current._id) ===
        String(req.params.id)
      ) {
        return res
          .status(400)
          .json({
            message:
              "Vous ne pouvez pas supprimer votre propre compte.",
          });
      }

      const user =
        await User.findById(
          req.params.id
        );

      if (!user) {
        return res
          .status(404)
          .json({
            message:
              "Utilisateur introuvable.",
          });
      }

      if (
        current.role !==
          "SUPER_ADMIN" &&
        String(user.centre) !==
          centreIdOf(
            current.centre
          )
      ) {
        return res
          .status(403)
          .json({
            message:
              "Vous ne pouvez supprimer que les utilisateurs de votre centre.",
          });
      }

      if (
        current.role !==
          "SUPER_ADMIN" &&
        user.role ===
          "SUPER_ADMIN"
      ) {
        return res
          .status(403)
          .json({
            message:
              "Vous ne pouvez pas supprimer un super administrateur.",
          });
      }

      if (
        user.role ===
        "SUPER_ADMIN"
      ) {
        const superCount =
          await User.countDocuments({
            role: "SUPER_ADMIN",
          });

        if (superCount <= 1) {
          return res
            .status(400)
            .json({
              message:
                "Impossible de supprimer le dernier super administrateur.",
            });
        }
      }

      await user.deleteOne();

      res.json({
        message:
          "Utilisateur supprimé.",
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message:
          "Erreur lors de la suppression de l'utilisateur.",
      });
    }
  }
);

module.exports = router;
