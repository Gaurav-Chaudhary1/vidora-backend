const mongoose = require('mongoose');
require('dotenv').config();

const connectDb = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB connected successfully...');
    } catch(error){
        console.log('MongoDB Failed:', error)
        process.exit(1);
    }
}

module.exports = connectDb;