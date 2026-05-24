const express = require("express");
const app = express();
const logger = require("morgan");
const path = require("path");
const mainRoutes = require("./routes/routes");

require("dotenv").config({ path: "./config/.env" });
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(logger("dev"));

app.use("/", mainRoutes);

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
