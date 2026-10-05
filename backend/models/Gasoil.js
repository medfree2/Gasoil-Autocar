const mongoose = require("mongoose");

const gasoilSchema = new mongoose.Schema(
  {
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
      unique: true,
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

    avance: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Avance",
      required: true,
    },

    // Snapshot of the user who originally created the bon.
    // We keep the display fields too, so the history remains readable
    // even if the user is renamed later.
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

    // Snapshot of the last user who edited the bon.
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

module.exports = mongoose.model("Gasoil", gasoilSchema);