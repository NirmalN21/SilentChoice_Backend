import express from "express";
import cors from "cors"
import dbConnect from "./dbConnect.js";
import userRoutes from "./routes/userRoutes.js";

const app = express();

dbConnect()
    .then(() => console.log("Database Connected Successfully"))
    .catch((error) => {
        console.error("Error connecting to the database:", error);
    });

app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true
}));

app.use(express.json({ limit: "50mb" }));

app.use(userRoutes);

app.listen(5000, () => {
    console.log("Server started at Port 5000");
})