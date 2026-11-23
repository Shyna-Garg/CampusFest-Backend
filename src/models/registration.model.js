const mongoose = require("mongoose")

const registrationSchema = new mongoose.Schema({
    eventId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Event",
        required:true
    },
    userId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User",
        required:true
    },
    teamName:{
        type:String,
    },
    members:[
    {
      name:String,
      email:String
    }
    ],
    registrationStatus:{
        type:String,
        enum:["Pending","Approved","Rejected"],
        default:"Pending"
    },
},
    {
        timestamps: true
    })

const Registration = mongoose.model("Registration", registrationSchema)

module.exports = Registration