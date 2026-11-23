const cors = require("cors");
const corsOptions = require("./config/cors");
const trustedCors = corsOptions();
const express = require("express")
const cookieParser = require("cookie-parser")
const authRoutes = require("./routes/auth.routes")
const eventRoutes = require("./routes/event.routes")
const registrationRoutes = require("./routes/registration.routes")
const productRoutes = require("./routes/product.routes");
const cartRoutes = require("./routes/cart.routes");
const orderRoutes = require("./routes/order.routes");
const errorHandler = require("./middlewares/error.middleware");


const app = express()

app.use((req, res, next) => {
  res.vary("Origin");
  next();
});
app.use(cors(trustedCors));

app.use(express.json())
app.use(cookieParser())

app.use("/api/auth", authRoutes)

app.use("/api/events", eventRoutes)

app.use("/api/registrations", registrationRoutes);

app.use("/api/products", productRoutes);

app.use("/api/cart", cartRoutes);

app.use("/api/orders", orderRoutes);



app.use(errorHandler);

module.exports = app