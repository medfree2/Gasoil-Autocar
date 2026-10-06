const express = require("express");

const bcrypt = require("bcryptjs");

const jwt = require("jsonwebtoken");


const User = require("../models/User");

const authMiddleware = require("../middleware/auth");


const router = express.Router();


const createToken = (user) => {

  return jwt.sign(

    {

      id: user._id.toString(),

      email: user.email || "",

      matricule: user.matricule || "",

      name: user.name || "",

      role: user.role,

    },

    process.env.JWT_SECRET,

    {

      expiresIn: "7d",

    }

  );

};


const publicUser = (user) => ({

  id: user._id,

  name: user.name || "",

  email: user.email || "",

  matricule: user.matricule || "",

  role: user.role,

  active: user.active,

  createdAt: user.createdAt,

});


const adminOnly = (req, res, next) => {

  if (req.user?.role !== "ADMIN") {

    return res.status(403).json({

      message: "Accès réservé à l'administrateur.",

    });

  }


  next();

};


// ==========================================================

// STATUS

// ==========================================================


router.get("/status", async (req, res) => {

  try {

    const count = await User.countDocuments();


    res.json({

      setupRequired: count === 0,

    });

  } catch (error) {

    console.error(error);


    res.status(500).json({

      message:

        "Erreur lors de la vérification de l'authentification.",

    });

  }

});


// ==========================================================

// FIRST ADMIN SETUP

// ==========================================================


router.post("/setup", async (req, res) => {

  try {

    const existingUsers = await User.countDocuments();


    if (existingUsers > 0) {

      return res.status(403).json({

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

      return res.status(400).json({

        message:

          "Nom, e-mail et mot de passe sont obligatoires.",

      });

    }


    if (String(password).length < 6) {

      return res.status(400).json({

        message:

          "Le mot de passe doit contenir au moins 6 caractères.",

      });

    }


    const normalizedEmail =

      String(email).trim().toLowerCase();


    const passwordHash =

      await bcrypt.hash(

        String(password),

        12

      );


    const user = await User.create({

      name: String(name).trim(),

      email: normalizedEmail,

      passwordHash,

      role: "ADMIN",

      active: true,

    });


    const token =

      createToken(user);


    res.status(201).json({

      token,

      user: publicUser(user),

    });

  } catch (error) {

    console.error(error);


    if (error.code === 11000) {

      return res.status(409).json({

        message:

          "Cet e-mail est déjà utilisé.",

      });

    }


    res.status(500).json({

      message:

        "Erreur lors de la création du compte administrateur.",

    });

  }

});


// ==========================================================

// LOGIN BY MATRICULE OR EMAIL

// ==========================================================


router.post("/login", async (req, res) => {

  try {

    const {

      identifier,

      email,

      password,

    } = req.body;


    const rawIdentifier =

      String(identifier || email || "").trim();


    if (!rawIdentifier || !password) {

      return res.status(400).json({

        message:

          "Matricule/e-mail et mot de passe sont obligatoires.",

      });

    }


    const normalizedEmail =

      rawIdentifier.toLowerCase();


    const normalizedMatricule =

      rawIdentifier.toUpperCase();


    const user = await User.findOne({

      $or: [

        {

          email: normalizedEmail,

        },

        {

          matricule:

            normalizedMatricule,

        },

      ],

    });


    if (!user) {

      return res.status(401).json({

        message:

          "Matricule/e-mail ou mot de passe incorrect.",

      });

    }


    if (user.active === false) {

      return res.status(403).json({

        message:

          "Ce compte utilisateur est désactivé.",

      });

    }


    const validPassword =

      await bcrypt.compare(

        String(password),

        user.passwordHash

      );


    if (!validPassword) {

      return res.status(401).json({

        message:

          "Matricule/e-mail ou mot de passe incorrect.",

      });

    }


    const token =

      createToken(user);


    res.json({

      token,

      user: publicUser(user),

    });

  } catch (error) {

    console.error(error);


    res.status(500).json({

      message:

        "Erreur lors de la connexion.",

    });

  }

});


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

        ).select(

          "-passwordHash"

        );


      if (!user) {

        return res.status(404).json({

          message:

            "Utilisateur introuvable.",

        });

      }


      if (user.active === false) {

        return res.status(403).json({

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
        return res.status(400).json({
          message:
            "Mot de passe actuel, nouveau mot de passe et confirmation sont obligatoires.",
        });
      }

      if (String(newPassword).length < 6) {
        return res.status(400).json({
          message:
            "Le nouveau mot de passe doit contenir au moins 6 caractères.",
        });
      }

      if (
        String(newPassword) !==
        String(confirmPassword)
      ) {
        return res.status(400).json({
          message:
            "Les deux nouveaux mots de passe ne correspondent pas.",
        });
      }

      if (
        String(currentPassword) ===
        String(newPassword)
      ) {
        return res.status(400).json({
          message:
            "Le nouveau mot de passe doit être différent du mot de passe actuel.",
        });
      }

      const user =
        await User.findById(
          req.user.id
        );

      if (!user) {
        return res.status(404).json({
          message:
            "Utilisateur introuvable.",
        });
      }

      if (user.active === false) {
        return res.status(403).json({
          message:
            "Ce compte utilisateur est désactivé.",
        });
      }

      const validCurrentPassword =
        await bcrypt.compare(
          String(currentPassword),
          user.passwordHash
        );

      if (!validCurrentPassword) {
        return res.status(401).json({
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

// ADMIN - LIST USERS

// ==========================================================


router.get(

  "/users",

  authMiddleware,

  adminOnly,

  async (req, res) => {

    try {

      const users =

        await User.find()

          .select(

            "-passwordHash"

          )

          .sort({

            createdAt: -1,

          });


      res.json(

        users.map(

          publicUser

        )

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

// ADMIN - CREATE USER

// ==========================================================


router.post(

  "/users",

  authMiddleware,

  adminOnly,

  async (req, res) => {

    try {

      const {

        matricule,

        password,

        name,

        role,

      } = req.body;


      if (

        !matricule ||

        !password

      ) {

        return res.status(400).json({

          message:

            "Matricule et mot de passe sont obligatoires.",

        });

      }


      const normalizedMatricule =

        String(matricule)

          .trim()

          .toUpperCase();


      const normalizedRole =

        String(role || "USER")

          .trim()

          .toUpperCase();


      if (

        !["USER", "ADMIN"].includes(

          normalizedRole

        )

      ) {

        return res.status(400).json({

          message:

            "Le rôle doit être USER ou ADMIN.",

        });

      }


      if (!normalizedMatricule) {

        return res.status(400).json({

          message:

            "Le matricule est obligatoire.",

        });

      }


      if (

        String(password).length < 6

      ) {

        return res.status(400).json({

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

        return res.status(409).json({

          message:

            "Ce matricule existe déjà.",

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


          name:

            String(

              name || ""

            ).trim(),


          passwordHash,


          role:

            normalizedRole,


          active: true,

        });


      res.status(201).json(

        publicUser(user)

      );

    } catch (error) {

      console.error(error);


      if (error.code === 11000) {

        return res.status(409).json({

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

// ADMIN - UPDATE USER

// ==========================================================


router.put(

  "/users/:id",

  authMiddleware,

  adminOnly,

  async (req, res) => {

    try {

      const user =

        await User.findById(

          req.params.id

        );


      if (!user) {

        return res.status(404).json({

          message:

            "Utilisateur introuvable.",

        });

      }


      const {

        matricule,

        name,

        password,

        role,

      } = req.body;


      if (!matricule) {

        return res.status(400).json({

          message:

            "Le matricule est obligatoire.",

        });

      }


      const normalizedMatricule =

        String(matricule)

          .trim()

          .toUpperCase();


      const normalizedRole =

        String(role || user.role || "USER")

          .trim()

          .toUpperCase();


      if (

        !["USER", "ADMIN"].includes(

          normalizedRole

        )

      ) {

        return res.status(400).json({

          message:

            "Le rôle doit être USER ou ADMIN.",

        });

      }


      if (

        String(req.user.id) ===

          String(user._id) &&

        normalizedRole !== "ADMIN"

      ) {

        return res.status(400).json({

          message:

            "Vous ne pouvez pas retirer votre propre rôle administrateur.",

        });

      }


      if (!normalizedMatricule) {

        return res.status(400).json({

          message:

            "Le matricule est obligatoire.",

        });

      }


      const duplicate =

        await User.findOne({

          matricule:

            normalizedMatricule,


          _id: {

            $ne:

              user._id,

          },

        });


      if (duplicate) {

        return res.status(409).json({

          message:

            "Ce matricule existe déjà.",

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


      if (

        password !== undefined &&

        String(password).length > 0

      ) {

        if (

          String(password).length < 6

        ) {

          return res.status(400).json({

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


      res.json(

        publicUser(user)

      );

    } catch (error) {

      console.error(error);


      if (error.code === 11000) {

        return res.status(409).json({

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

// ADMIN - DELETE USER

// ==========================================================


router.delete(

  "/users/:id",

  authMiddleware,

  adminOnly,

  async (req, res) => {

    try {

      if (

        String(req.user.id) ===

        String(req.params.id)

      ) {

        return res.status(400).json({

          message:

            "Vous ne pouvez pas supprimer votre propre compte administrateur.",

        });

      }


      const user =

        await User.findById(

          req.params.id

        );


      if (!user) {

        return res.status(404).json({

          message:

            "Utilisateur introuvable.",

        });

      }


      if (

        user.role === "ADMIN"

      ) {

        const adminCount =

          await User.countDocuments({

            role: "ADMIN",

          });


        if (adminCount <= 1) {

          return res.status(400).json({

            message:

              "Impossible de supprimer le dernier administrateur.",

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
