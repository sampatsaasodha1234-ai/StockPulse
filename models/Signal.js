const mongoose = require("mongoose");

const signalSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true
    },

    category: {
      type: String,
      default: "stocks"
    },

    symbol: {
      type: String,
      required: true
    },

    name: {
      type: String,
      default: ""
    },

    type: {
      type: String,
      enum: ["BUY", "SELL"],
      required: true
    },

    exchange: {
      type: String,
      default: "NSE"
    },

    entry: {
      type: String,
      required: true
    },

    stopLoss: {
      type: String,
      required: true
    },

    target1: {
      type: String,
      required: true
    },

    target2: {
      type: String,
      required: true
    },

    target3: {
      type: String,
      required: true
    },

    risk: {
      type: String,
      default: "Medium"
    },

    note: {
      type: String,
      default: ""
    },

    setup: {
      type: String,
      default: ""
    },

    active: {
      type: Boolean,
      default: true
    },

    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: false
  }
);

module.exports = mongoose.model("Signal", signalSchema);