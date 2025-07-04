const express = require('express');
const connectDb = require('./config/db');
const { authorizeB2 } = require('./config/backblaze');
const authRoutes = require('./routes/authRoutes');
const channelRoutes = require('./routes/channelRoutes');
const videoRoutes = require('./routes/videoRoutes');
const fileRoutes = require("./routes/fileRoutes");
const searchRoutes = require("./routes/searchRoutes");

const app = express();
const PORT = process.env.PORT;

app.use(express.json());

connectDb();
authorizeB2().catch(console.error);

app.use('/api', authRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/search', searchRoutes);

app.listen(PORT, () => {
    console.log('Server is running on port', PORT);
})