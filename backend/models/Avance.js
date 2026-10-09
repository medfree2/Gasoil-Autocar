const mongoose = require("mongoose");

const avanceSchema = new mongoose.Schema(
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

    montant: {
      type: Number,
      required: true,
      min: 0,
    },

    numeroCheque: {
      type: String,
      required: true,
      trim: true,
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

avanceSchema.index(
  {
    centre: 1,
    numeroCheque: 1,
  },
  {
    unique: true,
    name: "centre_numeroCheque_unique",
  }
);

avanceSchema.index({
  centre: 1,
  statut: 1,
});

module.exports = mongoose.model("Avance", avanceSchema);
