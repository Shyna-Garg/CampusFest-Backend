const mongoose = require("mongoose")

const orderSchema = new mongoose.Schema({

    userId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User",
        required:true
    },

    products:[
        {
            productId:{
                type:mongoose.Schema.Types.ObjectId,
                ref:"Product",
                required:true
            },

            quantity:{
                type:Number,
                required:true
            },

            price:{
                type:Number,
                required:true
            }
        }
    ],

    totalAmount:{
        type:Number,
        required:true
    },

    shippingAddress:{
        type:String,
        required:true
    },

    paymentMethod:{
        type:String,
        enum:["COD","UPI","Card"],
        default:"COD"
    },

    paymentStatus:{
        type:String,
        enum:["Pending","Paid","Failed"],
        default:"Pending"
    },

    orderStatus:{
        type:String,
        enum:[
            "Pending",
            "Confirmed",
            "Shipped",
            "Delivered",
            "Cancelled"
        ],
        default:"Pending"
    }

},{
    timestamps:true
})

const Order = mongoose.model("Order", orderSchema);

module.exports = Order;