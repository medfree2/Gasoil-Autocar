const mongoose = require("mongoose");

const avanceSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
    },

    montant: {
      type: Number,
      required: true,
      min: 0,
    },

    numeroCheque: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },

    station: {
      type: String,
      required: true,
      trim: true,
    },

    banque: {
      type: String,
      default: "",
      trim: true,
    },

    imageCheque: {
      type: String,
      default: "",
    },

    observation: {
      type: String,
      default: "",
      trim: true,
    },

    statut: {
      type: String,
      enum: ["ACTIVE", "CLOTUREE"],
      default: "ACTIVE",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Avance", avanceSchema);