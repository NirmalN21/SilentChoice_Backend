import mongoose from "mongoose";

const dbConnect = async()=>{
    try{
        await mongoose.connect("mongodb://127.0.0.1:27017/polls1");
        console.log("MongoDB Connection Established");
    }
    catch(err){
        console.log(err);
        console.log("Error Establishing Connection");
    }
}

export default dbConnect;   