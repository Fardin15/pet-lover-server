const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const port = process.env.PORT || 5000;

// middleware
app.use(
  cors({
    origin: ["http://localhost:5173"],
  })
);
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Pet Lover server is running");
});

app.listen(port, () => {
  console.log(`Pet Lover Server is running on port ${port}`);
});
