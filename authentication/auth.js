import dotenv from "dotenv";
import jsonwebtoken from "jsonwebtoken";
import User from "../models/userSchema.js";

dotenv.config({ path: "./config.env" });

const verifyToken = async (token) => {
    try {

        const decryptToken = jsonwebtoken.verify(token, process.env.SECRET_KEY);

        const rootUser = await User.findOne({ _id: decryptToken._id, "tokens.token": token });

        if (!rootUser) {
            throw new Error("User Not Found");
        }

        return {    
            success: true,
            user: rootUser
        };

    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
};

export default verifyToken;