const mongoose = require("mongoose");

const gasoilSchema = new mongoose.Schema(
  {
    centre: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Centre",
      required: true,
      index: true,
    },

    date: {
      type: Date,
      required: true,
    },

    autocar: {
      type: String,
      required: true,
      trim: true,
    },

    depart: {
      type: String,
      required: true,
      trim: true,
    },

    quantite: {
      type: Number,
      required: true,
      min: 0,
    },

    numeroBon: {
      type: String,
      required: true,
      trim: true,
    },

    prixTotal: {
      type: Number,
      required: true,
      min: 0,
    },

    imageBon: {
      type: String,
      default: "",
    },

    observation: {
      type: String,
      default: "",
      trim: true,
    },

    // Primary/first advance kept for backward compatibility and existing UI.
    avance: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Avance",
      required: true,
    },

    // A bon can consume several cheques. Example:
    // 715.08 DH from the oldest cheque + 954.92 DH from the next cheque.
    allocations: {
      type: [
        {
          avance: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Avance",
            required: true,
          },
          montant: {
            type: Number,
            required: true,
            min: 0,
          },
        },
      ],
      default: [],
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    createdByName: {
      type: String,
      default: "",
      trim: true,
    },

    createdByMatricule: {
      type: String,
      default: "",
      trim: true,
    },

    createdByEmail: {
      type: String,
      default: "",
      trim: true,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    updatedByName: {
      type: String,
      default: "",
      trim: true,
    },

    updatedByMatricule: {
      type: String,
      default: "",
      trim: true,
    },

    updatedByEmail: {
      type: String,
      default: "",
      trim: true,
    },

    lastEditedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

gasoilSchema.index(
  {
    centre: 1,
    numeroBon: 1,
  },
  {
    unique: true,
    name: "centre_numeroBon_unique",
  }
);

module.exports = mongoose.model("Gasoil", gasoilSchema);
