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
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Gasoil", gasoilSchema);